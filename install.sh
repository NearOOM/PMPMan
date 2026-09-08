#!/usr/bin/env bash
set -euo pipefail

REPO="Pumpkin-MC/Pumpkin"
BASE_URL="https://github.com/${REPO}/releases/latest/download"

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

mkdir -p "./pumpkin_data"

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

echo "[+] Installing Pumpkin Binary..."
echo "[-] Detected: ${OS} / ${ARCH}"
echo "[-] Downloading ${ASSET}..."

curl -fL --progress-bar -o "${OUT}" "${URL}"

if [[ "${ASSET}" != *.exe ]]; then
    chmod +x "${OUT}"
fi

echo "[+] Saved to ${OUT}"
echo "[+] PMPMan is ready!"
echo "[+] To run: npm start or node main.js"
