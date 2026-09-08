import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";


// Elements

const terminalElement = document.getElementById("terminal");

const statusElement = document.getElementById("status");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const restartBtn = document.getElementById("restartBtn");

const commandForm = document.getElementById("commandForm");
const commandInput = document.getElementById("commandInput");


// Terminal

const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    convertEol: true
});

term.open(terminalElement);


// WebSocket

const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${location.host}`;

console.log("[WS] Connecting to:", wsUrl);

const ws = new WebSocket(wsUrl);

ws.onopen = () => {
    console.log("[WS] Connected:", wsUrl);

    term.writeln("\r\n[PMPMan] WebSocket connected");
};

ws.onmessage = (event) => {
    console.log("[WS] Message:", event.data);

    term.write(event.data);
};

ws.onerror = (event) => {
    console.error("[WS] ERROR:", event);
    console.error("[WS] URL:", wsUrl);
    console.error("[WS] ReadyState:", ws.readyState);

    term.writeln("\r\n[PMPMan] WebSocket error");
};

ws.onclose = (event) => {
    console.warn("[WS] CLOSED");
    console.warn("[WS] Code:", event.code);
    console.warn("[WS] Reason:", event.reason);
    console.warn("[WS] Clean:", event.wasClean);

    term.writeln(
        `\r\n[PMPMan] WebSocket disconnected (${event.code})`
    );
};


// Status

function setStatus(online) {

    if (online) {

        statusElement.textContent = "Online";
        statusElement.className = "status online";

    } else {

        statusElement.textContent = "Offline";
        statusElement.className = "status offline";

    }

}


// API

async function sendCommand(command, input = null) {

    const body = {
        command: command
    };

    if (input !== null) {
        body.input = input;
    }

    const response = await fetch("/v1/sendCommand", {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}


// Start

startBtn.addEventListener("click", async () => {

    try {

        await sendCommand("start");

        setStatus(true);

    } catch (error) {

        term.writeln(`\r\n[PMPMan] ${error.message}`);

    }

});


// Stop

stopBtn.addEventListener("click", async () => {

    try {

        await sendCommand("stop");

        setStatus(false);

    } catch (error) {

        term.writeln(`\r\n[PMPMan] ${error.message}`);

    }

});


// Restart

restartBtn.addEventListener("click", async () => {

    try {

        await sendCommand("restart");

        setStatus(true);

    } catch (error) {

        term.writeln(`\r\n[PMPMan] ${error.message}`);

    }

});


// Minecraft command

commandForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const input = commandInput.value.trim();

    if (!input) {
        return;
    }

    try {

        await sendCommand("command", input);

        commandInput.value = "";
        commandInput.focus();

    } catch (error) {

        term.writeln(`\r\n[PMPMan] ${error.message}`);

    }

});
