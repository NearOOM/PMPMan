// Made By NearOOM
// Assisted By AI

// Modules
const { spawn } = require("child_process");
const { EventEmitter } = require("events");
const path = require("path");

const playitBin = "playit";
const playitDir = "playit";

function start() {
    const events = new EventEmitter();
    const playit = spawn(path.join(__dirname, playitDir, playitBin), [], {
        stdio: ["ignore", "pipe", "pipe"]
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let claimFound = false;
    let readyFired = false;

    playit.stdout.on("data", data => {
        const text = data.toString();
        stdoutBuffer += text;

    
        events.emit("log", text);

        if (!claimFound) {
            const match = stdoutBuffer.match(
                /https?:\/\/(?:www\.)?playit\.gg\/[^\s]+/i
            );

            if (match) {
                claimFound = true;
                events.emit("claim", match[0]);
            }
        }

        if (
            !readyFired &&
            claimFound &&
            /ready|connected|online/i.test(stdoutBuffer)
        ) {
            readyFired = true;
            events.emit("ready");
        }

        if (stdoutBuffer.length > 4096) {
            stdoutBuffer = stdoutBuffer.slice(-1024);
        }
    });

    playit.stderr.on("data", data => {
        const text = data.toString();
        stderrBuffer += text;

        
        
        events.emit("stderr", text);

        if (stderrBuffer.length > 4096) {
            stderrBuffer = stderrBuffer.slice(-1024);
        }
    });

    playit.on("error", err => {
        
        
        events.emit("error", err);
    });

    playit.on("exit", (code, signal) => {
        events.emit("exit", code, signal);
    });

    events.process = playit;

    events.stop = () => {
        if (!playit.killed) {
            playit.kill();
        }
    };

    return events;
}

module.exports = {
    start
};
