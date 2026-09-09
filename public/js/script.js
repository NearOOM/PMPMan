import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const terminalElement = document.getElementById("terminal");
const terminalContainer = document.querySelector(".terminal-container");
const statusElement = document.getElementById("status");
const connLabelElement = document.getElementById("connLabel");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const restartBtn = document.getElementById("restartBtn");
const commandForm = document.getElementById("commandForm");
const commandInput = document.getElementById("commandInput");

const term = new Terminal({
    cursorBlink: true,
    fontSize: 13.5,
    fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
    convertEol: true,
    scrollback: 5000,
    theme: {
        background: "#000000",
        foreground: "#dde1e6",
        cursor: "#3ddc97"
    }
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(terminalElement);

function safeFit() {
    try {
        fitAddon.fit();
    } catch (error) {
        console.error("[Terminal] Failed to fit:", error);
    }
}

requestAnimationFrame(() => requestAnimationFrame(safeFit));
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(safeFit);
}

let resizeTimeout = null;
function resizeTerminal() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(safeFit, 50);
}

window.addEventListener("resize", resizeTerminal);

if (typeof ResizeObserver !== "undefined") {
    const terminalObserver = new ResizeObserver(() => {
        resizeTerminal();
    });
    terminalObserver.observe(terminalElement);
}

let touchLastY = null;
let touchAccumPx = 0;

function rowHeightPx() {
    return term.rows > 0 ? terminalContainer.clientHeight / term.rows : 16;
}

terminalContainer.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return;
    touchLastY = event.touches[0].clientY;
    touchAccumPx = 0;
}, { passive: true });

terminalContainer.addEventListener("touchmove", event => {
    if (touchLastY === null || event.touches.length !== 1) return;

    const currentY = event.touches[0].clientY;
    const deltaY = touchLastY - currentY;
    touchLastY = currentY;
    touchAccumPx += deltaY;

    const rowPx = rowHeightPx();
    if (Math.abs(touchAccumPx) >= rowPx) {
        const lines = Math.trunc(touchAccumPx / rowPx);
        term.scrollLines(lines);
        touchAccumPx -= lines * rowPx;
    }

    event.preventDefault();
}, { passive: false });

function endTouch() {
    touchLastY = null;
    touchAccumPx = 0;
}
terminalContainer.addEventListener("touchend", endTouch, { passive: true });
terminalContainer.addEventListener("touchcancel", endTouch, { passive: true });

let userScrolledUp = false;

const scrollToBottomBtn = document.createElement("button");
scrollToBottomBtn.type = "button";
scrollToBottomBtn.className = "scroll-bottom-btn";
scrollToBottomBtn.textContent = "↓";
scrollToBottomBtn.style.display = "none";
terminalContainer.appendChild(scrollToBottomBtn);

scrollToBottomBtn.addEventListener("click", () => {
    term.scrollToBottom();
});

term.onScroll(() => {
    const buffer = term.buffer.active;
    userScrolledUp = buffer.viewportY < buffer.baseY;
    scrollToBottomBtn.style.display = userScrolledUp ? "block" : "none";
});

term.writeln("\x1b[32m[PMPMan] ANSI color support: OK\x1b[0m");

const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${location.host}`;
let ws = null;
let reconnectTimeout = null;

function setConnLabel(connected) {
    connLabelElement.textContent = connected ? "Connected" : "Disconnected";
    connLabelElement.className = `conn-label ${connected ? "conn-connected" : "conn-disconnected"}`;
}

function connectWebSocket() {
    console.log("[WS] Connecting to:", wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log("[WS] Connected:", wsUrl);
        setConnLabel(true);
        term.writeln("\r\n[PMPMan] WebSocket connected");
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
    };

    ws.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (err) {
            console.error("[WS] Received non-JSON message:", event.data);
            return;
        }

        switch (msg.type) {
            case "output":
                if (typeof msg.data === "string") {
                    term.write(msg.data);
                }
                break;
            case "stats":
                updateStatsUI(msg.data);
                break;
            case "ping":
                break;
            default:
                console.warn("[WS] Unknown message type:", msg.type);
        }
    };

    ws.onerror = (event) => {
        console.error("[WS] ERROR:", event);
    };

    ws.onclose = (event) => {
        setConnLabel(false);
        term.writeln(`\r\n[PMPMan] WebSocket disconnected (${event.code}). Reconnecting...`);
        if (!reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                connectWebSocket();
            }, 3000);
        }
    };
}

connectWebSocket();

const cpuValueEl = document.getElementById("cpuValue");
const cpuBarEl = document.getElementById("cpuBar");
const memValueEl = document.getElementById("memValue");
const memBarEl = document.getElementById("memBar");
const pumpkinMemValueEl = document.getElementById("pumpkinMemValue");
const pumpkinMemBarEl = document.getElementById("pumpkinMemBar");

function levelClass(percentage) {
    if (percentage >= 85) return "stat-danger";
    if (percentage >= 60) return "stat-warn";
    return "";
}

function updateStatsUI(stats) {
    if (!stats) return;

    const cpuPercent = Number(stats.cpuUsage) || 0;
    cpuValueEl.textContent = `${cpuPercent.toFixed(1)}%`;
    cpuBarEl.style.width = `${Math.min(Math.max(cpuPercent, 0), 100)}%`;
    cpuBarEl.className = `stat-bar-fill ${levelClass(cpuPercent)}`.trim();

    const memPercent = Number(stats.usedMemPercentage) || 0;
    const usedMemMb = Number(stats.usedMemMb) || 0;
    const totalMemMb = Number(stats.totalMemMb) || 0;
    memValueEl.textContent = `${Math.round(usedMemMb)} MB / ${Math.round(totalMemMb)} MB`;
    memBarEl.style.width = `${Math.min(Math.max(memPercent, 0), 100)}%`;
    memBarEl.className = `stat-bar-fill ${levelClass(memPercent)}`.trim();

    const pumpkinMemMb = Number(stats.pumpkinMemMb) || 0;
    const pumpkinMemPercent = totalMemMb > 0 ? (pumpkinMemMb / totalMemMb) * 100 : 0;
    pumpkinMemValueEl.textContent = `${Math.round(pumpkinMemMb)} MB`;
    pumpkinMemBarEl.style.width = `${Math.min(Math.max(pumpkinMemPercent, 0), 100)}%`;
    pumpkinMemBarEl.className = `stat-bar-fill ${levelClass(pumpkinMemPercent)}`.trim();
}

function setStatus(online) {
    if (online) {
        statusElement.innerHTML = '<span class="status-dot"></span>Online';
        statusElement.className = "status-pill status-online";
    } else {
        statusElement.innerHTML = '<span class="status-dot"></span>Offline';
        statusElement.className = "status-pill status-offline";
    }
}

async function sendCommand(command, input = null) {
    const body = { command: command };
    if (input !== null) body.input = input;

    const response = await fetch("/v1/sendCommand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error("Invalid server response");
    }

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }
    return data;
}

startBtn.addEventListener("click", async () => {
    try {
        const res = await sendCommand("start");
        if (res.success) setStatus(true);
    } catch (error) {
        term.writeln(`\r\n[PMPMan] ${error.message}`);
    }
});

stopBtn.addEventListener("click", async () => {
    try {
        await sendCommand("stop");
        setStatus(false);
    } catch (error) {
        term.writeln(`\r\n[PMPMan] ${error.message}`);
    }
});

restartBtn.addEventListener("click", async () => {
    try {
        term.clear();
        await sendCommand("restart");
        setStatus(true);
    } catch (error) {
        term.writeln(`\r\n[PMPMan] ${error.message}`);
    }
});

commandForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = commandInput.value.trim();
    if (!input) return;

    if (input === "clear") {
        term.clear();
        commandInput.value = "";
        commandInput.focus();
        await sendCommand("command", "clear");
        return;
    }

    term.writeln(`\r\n\x1b[38;2;61;220;151m$\x1b[0m ${input}`);
    commandInput.value = "";
    commandInput.focus();

    try {
        await sendCommand("command", input);
    } catch (error) {
        term.writeln(`\r\n[PMPMan] ${error.message}`);
    }
});