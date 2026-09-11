// Made By NearOOM 

// Modules
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

const SESSION_COOKIE_NAME = "pmpman_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory session store. Resets on restart (users just log in again).
const sessions = new Map();

// Creates a default admin account on first run and prints the generated
// password once. Does nothing if data/users.json already exists.
function ensureUser() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(USERS_FILE)) {
        return;
    }

    const username = "admin";
    const password = crypto.randomBytes(9).toString("hex");
    const passwordHash = bcrypt.hashSync(password, 10);

    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify({ username, passwordHash }, null, 2),
        "utf8"
    );

    console.log("=================================================");
    console.log("[PMPMan] No account found, created a default one:");
    console.log(`[PMPMan]   username: ${username}`);
    console.log(`[PMPMan]   password: ${password}`);
    console.log("[PMPMan] Change it by editing data/users.json");
    console.log("=================================================");
}

function loadUser() {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function verifyLogin(username, password) {
    if (!username || !password) {
        return false;
    }

    let user;
    try {
        user = loadUser();
    } catch (err) {
        return false;
    }

    if (username !== user.username) {
        return false;
    }

    return bcrypt.compareSync(password, user.passwordHash);
}

function createSession(username) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
    return token;
}

function destroySession(token) {
    sessions.delete(token);
}

// Works on both Express req and the raw http.IncomingMessage the WS
// upgrade handshake gives us - both just need req.headers.cookie.
function getCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) {
        return null;
    }

    const parts = header.split(";");
    for (const part of parts) {
        const idx = part.indexOf("=");
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) {
            return decodeURIComponent(part.slice(idx + 1).trim());
        }
    }

    return null;
}

function isAuthenticated(req) {
    const token = getCookie(req, SESSION_COOKIE_NAME);
    if (!token) {
        return false;
    }

    const session = sessions.get(token);
    if (!session) {
        return false;
    }

    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return false;
    }

    return true;
}

function requireAuth(req, res, next) {
    if (!isAuthenticated(req)) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    next();
}

module.exports = {
    ensureUser,
    verifyLogin,
    createSession,
    destroySession,
    getCookie,
    isAuthenticated,
    requireAuth,
    SESSION_COOKIE_NAME
};
