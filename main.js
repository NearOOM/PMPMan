// Made By NearOOM

// Modules (DO NOT CHANGE)
const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const TOML = require("smol-toml");

// Builtin libs
const playit = require("./lib/playit")
const { monitor } = require('./lib/monitor');

// DO NOT CHANGE
let logBuffer = [];
const MAX_BUFFER_LINES = 1000;


// Config Processing
function createConf(name, content) {
  try {
    fs.writeFileSync(name, content, 'utf8');
  } catch (error) {
      console.log(error);
  }
}

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

const DEFCONF_TOML = `
[server]
port = 3000
host = "0.0.0.0"
apiVer = "1"

[pumpkin]
bin = "pumpkin"

[playit]
enabled = false
`

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.warn(`[!] config.toml not found at ${CONFIG_PATH}, using defaults.`);
        createConf(CONFIG_PATH, DEFCONF_TOML);
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

// Server Config
const app = express();
const httpServer = http.createServer(app);
const wss = new WebSocket.Server({
    server: httpServer
});
let server = null;

// Express Config
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Handle WS connections
setInterval(() => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "ping" }));
        }
    });
}, 30000);

function handleConnection(ws) {
    ws.send(JSON.stringify({
        type: "output",
        data: "[PMPMan] Connected to log stream\r\n"
    }));
    if (logBuffer.length > 0) {
        ws.send(JSON.stringify({
            type: "output",
            data: logBuffer.join("")
        }));
    }

    ws.on("close", () => {
        // ignore
    });
}

wss.on("connection", handleConnection);

function broadcastOutput(text) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "output", data: text }));
        }
    });
}

function broadcastStats(stats) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "stats", data: stats }));
        }
    });
}

function attachServerListeners() {
    server.stdout.on("data", (data) => {
        const text = data.toString();
        logBuffer.push(text);
        if (logBuffer.length > MAX_BUFFER_LINES) {
            logBuffer.shift();
        }

        broadcastOutput(text);
    });

    server.stderr.on("data", (data) => {
        const text = data.toString();
        
        logBuffer.push(text);
        if (logBuffer.length > MAX_BUFFER_LINES) {
            logBuffer.shift();
        }

        broadcastOutput(text);
    });

    server.on("close", (code, signal) => {
        const exitText = `[PMPMan] Pumpkin exited: code=${code}, signal=${signal}\r\n`;
        
        logBuffer.push(exitText);
        if (logBuffer.length > MAX_BUFFER_LINES) logBuffer.shift();

        broadcastOutput(exitText);
        server = null;
    });
}


// Server Commands
function start() {
    if (server) {
        return false;
    }

    server = spawn(`./${pumpkinBin}`, [], {
        cwd: path.join(__dirname, "pumpkin_data"),
        stdio: ["pipe", "pipe", "pipe"],
        env: {
            ...process.env,
            CLICOLOR_FORCE: "1",
            FORCE_COLOR: "1",
            TERM: "xterm-256color"
        }
    });

    attachServerListeners();
    return true;
}

function stop() {
    if (!server) {
        return false;
    }

    let killTimeout = setTimeout(() => {
        if (server) {
            console.warn("[PMPMan] Pumpkin did not stop gracefully. Forcing kill...");
            server.kill("SIGKILL");
        }
    }, 5000);

    server.once("close", () => {
        clearTimeout(killTimeout);
    });

    server.stdin.write("stop\n");
    return true;
}

function restart() {
    if (!server) {
        logBuffer = [];
        start();
        return true;
    }

    let killTimeout = setTimeout(() => {
        if (server) {
            console.warn("[PMPMan] Pumpkin did not stop gracefully during restart. Forcing kill...");
            server.kill("SIGKILL");
        }
    }, 5000);

    server.once("close", () => {
        clearTimeout(killTimeout);
        logBuffer = [];
        setTimeout(() => {
            start();
        }, 100);
    });

    server.stdin.write("stop\n");
    return true;
}


// Utils
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

function startMonitoring(intervalMs = 1000) {
    async function tick() {
        try {
            const pid = server ? server.pid : null;
            const stats = await monitor(pid);
            broadcastStats(stats);
        } catch (err) {
            console.error("[monitor] failed:", err.message);
        } finally {
            setTimeout(tick, intervalMs);
        }
    }

    tick();
}

startMonitoring(1000);

function getServerStatus() {
    if (server) {
        return true;
    }
    return false
};

// Routes
app.get(`/v${apiVer}/status`, (req, res) => {
    const serverStatus = getServerStatus();
    return res.status(200).json({
        "online": serverStatus
    });
});

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

// MAIN
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
