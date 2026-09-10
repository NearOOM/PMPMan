// Made By NearOOM

// Modules
const fs = require("fs");
const TOML = require("smol-toml");
const path = require("path");


// Config processing
const CONFIG_PATH = path.join(__dirname, "..", "config.toml");

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

function getDefConf(json) {
    const jsObject = JSON.parse(json);
    return TOML.stringify(jsObject);
}

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
        saveConfig(DEFAULT_CONFIG);
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

function validateConfig(input) {
    if (!input || typeof input !== "object") {
        throw new Error("Invalid configuration.");
    }

    const config = {
        server: {},
        pumpkin: {},
        playit: {}
    };

    if (input.server) {
        if (
            input.server.port !== undefined &&
            (
                !Number.isInteger(Number(input.server.port)) ||
                Number(input.server.port) < 1 ||
                Number(input.server.port) > 65535
            )
        ) {
            throw new Error("Server port must be between 1 and 65535.");
        }

        if (
            input.server.host !== undefined &&
            typeof input.server.host !== "string"
        ) {
            throw new Error("Server host must be a string.");
        }

        config.server.port = Number(input.server.port);
        config.server.host = input.server.host;
        config.server.apiVer = String(input.server.apiVer || "1");
    }

    if (input.pumpkin) {
        if (
            input.pumpkin.bin !== undefined &&
            typeof input.pumpkin.bin !== "string"
        ) {
            throw new Error("Pumpkin binary must be a string.");
        }

        config.pumpkin.bin = input.pumpkin.bin;
    }

    if (input.playit) {
        if (input.playit.enabled !== undefined) {
            if (typeof input.playit.enabled !== "boolean") {
                throw new Error("Playit enabled must be a boolean.");
            }

            config.playit.enabled = input.playit.enabled;
        }
    }

    return config;
}

function updateConfig(input) {
    const current = loadConfig();
    const validated = validateConfig(input);

    const updated = {
        server: {
            ...current.server,
            ...(validated.server || {})
        },
        pumpkin: {
            ...current.pumpkin,
            ...(validated.pumpkin || {})
        },
        playit: {
            ...current.playit,
            ...(validated.playit || {})
        }
    };

    saveConfig(updated);

    return updated;
}

module.exports = {
    loadConfig,
    saveConfig,
    updateConfig,
    validateConfig,
    CONFIG_PATH
};