// Made By NearOOM
// Assisted By AI

// Modules
const fs = require("fs");
const TOML = require("smol-toml");
const path = require("path");


// Config processing
const CONFIG_PATH = path.join(__dirname, "..", "config.toml");

const DEFAULT_CONFIG = {
    server: {
        port: 3000,
        host: "127.0.0.1"
    },
    pumpkin: {
        bin: "pumpkin"
    },
    playit: {
        enabled: false
    }
};

// Only used for the first-run bootstrap write, so the generated file keeps
// the playit warning as a comment (TOML.stringify() below can't do that).
const DEFAULT_CONFIG_TOML = `[server]
port = 3000
host = "127.0.0.1"

[pumpkin]
bin = "pumpkin"

# WARNING: if you enable playit below, only tunnel Pumpkin's game port
# in your playit dashboard. Do NOT tunnel this manager's port, or
# anyone with the tunnel URL gets access to it too.
[playit]
enabled = false
`;

function saveConfig(config) {
    fs.writeFileSync(
        CONFIG_PATH,
        TOML.stringify(config),
        "utf8"
    );
}

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.warn(`[!] config.toml not found at ${CONFIG_PATH}, using defaults.`);
        fs.writeFileSync(CONFIG_PATH, DEFAULT_CONFIG_TOML, "utf8");
        return structuredClone(DEFAULT_CONFIG);
    }

    try {
        const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
        const parsed = TOML.parse(raw);

        return {
            server: {
                ...DEFAULT_CONFIG.server,
                ...(parsed.server || {})
            },
            pumpkin: {
                ...DEFAULT_CONFIG.pumpkin,
                ...(parsed.pumpkin || {})
            },
            playit: {
                ...DEFAULT_CONFIG.playit,
                ...(parsed.playit || {})
            }
        };
    } catch (err) {
        console.error(`[-] Failed to parse config.toml: ${err.message}`);
        console.warn("[!] Falling back to default config.");
        return structuredClone(DEFAULT_CONFIG);
    }
}

module.exports = {
    loadConfig,
    saveConfig,
    CONFIG_PATH
};
