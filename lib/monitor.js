// Made By NearOOM
// Assisted By AI

// Modules
const os = require("os");
const fs = require("fs");

const CLK_TCK = 100;

const cpuSamples = new Map();

function readChildCpuTicks(pid) {
    const raw = fs.readFileSync(`/proc/${pid}/stat`, "utf-8");
    const afterComm = raw.slice(raw.lastIndexOf(")") + 2);
    const fields = afterComm.trim().split(/\s+/);

    const utime = parseInt(fields[11], 10);
    const stime = parseInt(fields[12], 10);

    return utime + stime;
}

function getChildCpuUsage(pid) {
    if (!pid) {
        return 0;
    }

    let ticks;

    try {
        ticks = readChildCpuTicks(pid);
    } catch (err) {
        cpuSamples.delete(pid);
        return 0;
    }

    const now = Date.now();
    const prev = cpuSamples.get(pid);

    cpuSamples.set(pid, { ticks, time: now });

    if (!prev) {
        return 0;
    }

    const tickDelta = ticks - prev.ticks;
    const elapsedSec = (now - prev.time) / 1000;

    if (elapsedSec <= 0) {
        return 0;
    }

    const cpuSeconds = tickDelta / CLK_TCK;

    return (cpuSeconds / elapsedSec) * 100;
}

function getChildMemMb(pid) {
    if (!pid) {
        return 0;
    }

    try {
        const raw = fs.readFileSync(`/proc/${pid}/status`, "utf-8");
        const match = raw.match(/^VmRSS:\s+(\d+)\s+kB$/m);

        if (!match) {
            return 0;
        }

        return parseInt(match[1], 10) / 1024;
    } catch (err) {
        return 0;
    }
}

function getSystemMemInfo() {
    const totalMemMb = os.totalmem() / 1024 / 1024;
    const freeMemMb = os.freemem() / 1024 / 1024;
    const usedMemMb = totalMemMb - freeMemMb;

    return {
        totalMemMb,
        usedMemMb,
        usedMemPercentage: (usedMemMb / totalMemMb) * 100
    };
}

async function monitor(pid) {
    const systemMem = getSystemMemInfo();
    const cpuUsage = getChildCpuUsage(pid);
    const pumpkinMemMb = getChildMemMb(pid);

    return {
        cpuUsage,
        totalMemMb: systemMem.totalMemMb,
        usedMemMb: systemMem.usedMemMb,
        usedMemPercentage: systemMem.usedMemPercentage,
        pumpkinMemMb
    };
}

module.exports = { monitor };