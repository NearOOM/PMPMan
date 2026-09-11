#!/usr/bin/env bash
set -euo pipefail

REPO="Pumpkin-MC/Pumpkin"
BASE_URL="https://github.com/${REPO}/releases/latest/download"
PLAYIT_VERSION="1.0.10"
PLAYIT_BASE_URL="https://builds.playit.gg/${PLAYIT_VERSION}"

detect_os() {
    if command -v termux-info >/dev/null 2>&1 || [ -n "${TERMUX_VERSION:-}" ] || uname -o 2>/dev/null | grep -qi android; then
        echo "android"
        return
    fi
    case "$(uname -s)" in
        Linux) echo "linux" ;;
        Darwin) echo "macos" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *) echo "unknown" ;;
    esac
}

detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64) echo "x64" ;;
        aarch64|arm64) echo "arm64" ;;
        armv7l|armv7) echo "armv7" ;;
        *) echo "unknown" ;;
    esac
}

OS="$(detect_os)"
ARCH="$(detect_arch)"

case "${OS}-${ARCH}" in
    android-arm64) ASSET="pumpkin-aarch64-android" ;;
    linux-x64) ASSET="pumpkin-X64-Linux" ;;
    linux-arm64) ASSET="pumpkin-ARM64-Linux" ;;
    macos-arm64) ASSET="pumpkin-ARM64-macOS" ;;
    windows-x64) ASSET="pumpkin-X64-Windows.exe" ;;
    windows-arm64) ASSET="pumpkin-ARM64-Windows.exe" ;;
    *)
        echo "Unsupported platform: OS=${OS} ARCH=${ARCH}" >&2
        exit 1
        ;;
esac

URL="${BASE_URL}/${ASSET}"
OUT="./pumpkin_data/pumpkin"
PLAYIT_OUT="./playit/playit"
CONFIG_FILE="./config.toml"

mkdir -p "./pumpkin_data"

install_playit() {
    echo "[+] Installing playit (tunnel, required)..."

    if [[ "$OS" == "android" ]]; then
        pkg install tur-repo -y > /dev/null 2>&1
        pkg install playit -y > /dev/null 2>&1
        echo "[+] playit installed via pkg (Termux)"
        return
    fi

    local playit_asset=""
    case "${OS}-${ARCH}" in
        linux-x64)   playit_asset="playit-linux-amd64" ;;
        linux-arm64) playit_asset="playit-linux-aarch64" ;;
        linux-armv7) playit_asset="playit-linux-armv7" ;;
        *)
            echo "[-] playit binary not available for OS=${OS} ARCH=${ARCH}, skipping."
            return
            ;;
    esac

    local playit_url="${PLAYIT_BASE_URL}/${playit_asset}"
    echo "[-] Downloading ${playit_asset}..."
    curl -fL --progress-bar -o "${PLAYIT_OUT}" "${playit_url}"
    chmod +x "${PLAYIT_OUT}"
    echo "[+] playit saved to ${PLAYIT_OUT}"
}

generate_config() {
    if [[ -f "${CONFIG_FILE}" ]]; then
        return
    fi
    cat > "${CONFIG_FILE}" <<EOF
[server]
port = 3000
host = "127.0.0.1"

[pumpkin]
bin = "pumpkin"

# WARNING: if you enable playit below, only tunnel Pumpkin's game port
# in your playit dashboard. Do NOT tunnel this manager's port, or
# anyone with the tunnel URL gets access to it too.
[playit]
enabled = false
EOF
}

echo "[+] Installing nodejs..."
if [[ "$OS" == "android" ]]; then
    pkg install nodejs -y > /dev/null 2>&1
else
    if command -v apt >/dev/null 2>&1; then
        sudo apt install nodejs -y > /dev/null 2>&1
    else
        echo "[-] 'apt' package manager not found. Please ensure Node.js is installed manually."
    fi
fi

echo "[+] Installing modules..."
npm install > /dev/null 2>&1

echo "[+] Building Bundle.js..."
npm run build > /dev/null 2>&1

echo "[+] Installing Pumpkin Binary..."
echo "[-] Detected: ${OS} / ${ARCH}"
echo "[-] Downloading ${ASSET}..."

curl -fL --progress-bar -o "${OUT}" "${URL}"

if [[ "${ASSET}" != *.exe ]]; then
    chmod +x "${OUT}"
fi

echo "[+] Saved to ${OUT}"

install_playit
generate_config

echo "[+] PMPMan is ready!"
echo "[+] To run: npm start or node main.js"
