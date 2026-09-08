// Made By NearOOM

// Modules (DO NOT CHANGE)
const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const http = require("http");
const playit = require("./lib/playit")
const fs = require("fs");
const TOML = require("smol-toml");

// Config <needs change>
// Config
const CONFIG_PATH = path.join(__dirname, "config.toml");

const DEFAULT_CONFIG = {
    server: {
        port: 3000,
        host: "0.0.0.0",
        apiVer: "1"
    },
    pumpkin: {
        bin: "pumpkin"
    },
    playit: {
        enabled: false
    }
};

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.warn(`[!] config.toml not found at ${CONFIG_PATH}, using defaults.`);
        return DEFAULT_CONFIG;
    }

    try {
        const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
        const parsed = TOML.parse(raw);

        return {
            server: { ...DEFAULT_CONFIG.server, ...(parsed.server || {}) },
            pumpkin: { ...DEFAULT_CONFIG.pumpkin, ...(parsed.pumpkin || {}) },
            playit: { ...DEFAULT_CONFIG.playit, ...(parsed.playit || {}) }
        };
    } catch (err) {
        console.error(`[-] Failed to parse config.toml: ${err.message}`);
        console.warn("[!] Falling back to default config.");
        return DEFAULT_CONFIG;
    }
}

const config = loadConfig();

const port = config.server.port;
const host = config.server.host;
const apiVer = config.server.apiVer;
const pumpkinBin = config.pumpkin.bin;
const isPlayit = config.playit.enabled;

// DO NOT CHANGE
const app = express();
const httpServer = http.createServer(app);
const wss = new WebSocket.Server({
    server: httpServer
});
let server = null;

// Express config
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());


// WebSocket connection event

function handleConnection(ws) {
    ws.send("[PMPMan] Connected to log stream");

    ws.on("close", () => {
        console.log("Client disconnected");
    });
}

wss.on("connection", handleConnection);

function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function attachServerListeners() {
    server.stdout.on("data", (data) => {
        broadcast(data.toString());
    });

    server.stderr.on("data", (data) => {
        broadcast(data.toString());
    });

    server.on("close", (code, signal) => {
        broadcast(
            `[PMPMan] Pumpkin exited: code=${code}, signal=${signal}`
        );

        server = null;
    });
}

// Server Command
function start() {
    if (server) {
        return false;
    }

    server = spawn(`./${pumpkinBin}`, [], {
        cwd: path.join(__dirname, "pumpkin_data"),
        stdio: ["pipe", "pipe", "pipe"]
    });

    attachServerListeners();
    return true;
}

function stop() {
    if (!server) {
        return false;
    }

    server.kill();
    return true;
}

function restart() {
    if (!server) {
        start();
        return true;
    }

    server.once("close", () => {
        start();
    });

    server.kill();
    return true;
}

// utils

function runCommand(command) {
    if (!server) {
        return false;
    }

    server.stdin.write(command + "\n");
    return true;
}

function retOk(res) {
    return res.status(200).json({
        success: true
    });
}

function retError(res, message) {
    return res.status(400).json({
        success: false,
        error: message
    });
}

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
            if (!start()) {
                return retError(res, "Pumpkin is already running.");
            }
        
            return retOk(res);
    
        case "stop":
            if (!stop()) {
                return retError(res, "Pumpkin is not running");
            }
        
            return retOk(res);
    
        case "restart":
            restart()
             return retOk(res);
    
        case "command":
            if (!req.body.input) {
                return res.status(400).json({
                    success: false,
                    error: "Missing input"
                });
            }
        
            if (!runCommand(req.body.input)) {
                return retError(res, "Pumpkin is not running");
            }
        
            return retOk(res);
    
        default:
            return res.status(400).json({
                error: "Unknown command"
            });
    }
});

// Main
httpServer.listen(port, host, () => {
    console.log(`PMPMan is running on ${host}:${port}`);
    start();
    if (isPlayit) {
        const playitEvents = playit.start();

        playitEvents.on("claim", url => {
            console.log(`Playit claim URL: ${url}`);
        });

        playitEvents.on("ready", () => {
            console.log("Playit tunnel ready");
        });

        playitEvents.on("stderr", text => {
            console.error(`[playit] ${text}`);
        });

        playitEvents.on("error", err => {
            console.error("Playit failed to start:", err.message);
        });

        playitEvents.on("exit", (code, signal) => {
            console.log(`Playit exited (code=${code}, signal=${signal})`);
        });
    }
});