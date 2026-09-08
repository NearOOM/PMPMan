// Made By NearOOM

const express = require("express");
const path = require("path");
const { spawn } = require("child_process");

// Config <needs change>
const app = express();
const port = 3000;
const host = "0.0.0.0";
const apiVer = "1";
const pumpkinBin = "pumpkin";

// Express config
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// DO NOT CHANGE
let server = null;

// Server Output are sent through websocket for realtime
server.stdout.on("data", (data) => {
    console.log("[PUMPKIN]", data.toString());
});
    
server.stderr.on("data", (data) => {
    console.error("[PUMPKIN ERROR]", data.toString());
});
    
server.on("close", (code) => {
    console.log(`Pumpkin exited with code ${code}`);
});

// utils
function start() {
    const server = spawn(`./pumpkin/${pumpkinBin}`, [], {stdio: ["pipe", "pipe", "pipe"]});
};

function stop() {
    server.kill()
};

function restart() {
    server.kill()
    const server = spawn(`./pumpkin/${pumpkinBin}`, [], {stdio: ["pipe", "pipe", "pipe"]});
};


function runCommand(command) {
    server.stdin.write(command + "\n");
};

// Routes
app.post(`/v${apiVer}/sendCommand`, (req, res) => {
    const command = req.body.command;

    if (!command) {
        return res.status(400).json({
            error: "Missing command"
        });
    }
    
    switch (command) {
        case "start":
            start()
            break;
    
        case "stop":
            stop()
            break;
    
        case "restart":
            restart()
            break;
    
        case "command":
            if (!req.body.input) {
                return res.status(400).json({
                    error: "Missing input"
                });
            }
    
            runCommand(req.body.input + "\n");
            break;
    
        default:
            return res.status(400).json({
                error: "Unknown command"
            });
    }
});

// Main
app.listen(port, host, () => {
    console.log(`PMPMan is running on ${host}:${port}`);
});