#!/usr/bin/env bash
set -euo pipefail

echo "=== Android SDK / Rust mobile toolchain setup (macOS) ==="
AUTO=${AUTO:-1} # set AUTO=0 to disable auto-install attempts

# --- Pre-flight checks ---
echo "[1/5] Checking Java (JDK 17 recommended)..."
if command -v java >/dev/null 2>&1; then
  # Some macOS systems have a stub /usr/bin/java that exits non-zero if JDK missing.
  if JAVA_OUT=$(java -version 2>&1 | head -n1); then
    echo " Java detected: $JAVA_OUT"
    JAVA_OK=1
  else
    echo " Java stub found but no real JDK installed. Will install."
    JAVA_OK=0
  fi
else
  JAVA_OK=0
fi

if [ "${JAVA_OK:-0}" = "0" ]; then
  if [ "$AUTO" = "1" ]; then
    echo " Java NOT found. Attempting automatic install (Homebrew Temurin17)..."
    if ! command -v brew >/dev/null 2>&1; then
      echo "  Homebrew not found. Bootstrapping Homebrew (NONINTERACTIVE)..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" </dev/null || {
        echo "  Failed to install Homebrew automatically."; exit 1; }
      # Update PATH for new brew (Apple Silicon default path)
      if [ -d "/opt/homebrew/bin" ]; then
        export PATH="/opt/homebrew/bin:$PATH"
      fi
    fi
    # Try specific JDK 17 cask names
    if ! brew list --cask temurin@17 >/dev/null 2>&1; then
      brew install --cask temurin@17 || brew install --cask temurin || brew install openjdk@17 || {
        echo "  Failed to install any JDK 17 (tried temurin@17, temurin, openjdk@17)."; exit 1; }
    fi
    if command -v java >/dev/null 2>&1; then
      echo " Java installed successfully."; else echo " Java still missing."; exit 1; fi
  else
    echo " Java NOT found. Install Temurin17 (brew install --cask temurin17) then re-run."
    exit 1
  fi
fi

# Set JAVA_HOME if possible (after ensuring Java)
if [ -z "${JAVA_HOME:-}" ]; then
  DETECTED_JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null || echo "")
  if [ -n "$DETECTED_JAVA_HOME" ]; then
    export JAVA_HOME="$DETECTED_JAVA_HOME"
  fi
fi

echo "[2/5] Checking rustup..."
if ! command -v rustup >/dev/null 2>&1; then
  if [ "$AUTO" = "1" ]; then
    echo " rustup not found. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y || { echo " rustup install failed"; exit 1; }
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env" 2>/dev/null || true
    if ! command -v rustup >/dev/null 2>&1; then
      echo " rustup still not available in PATH. Add: source \"$HOME/.cargo/env\" to your shell rc."
      exit 1
    fi
  else
    echo " rustup not found. Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"
    exit 1
  fi
fi

SDK_ROOT="$HOME/Library/Android/sdk"
CMDLINE_DIR="${SDK_ROOT}/cmdline-tools/latest"
ZSHRC="$HOME/.zshrc"

mkdir -p "$SDK_ROOT"

if [ ! -d "$CMDLINE_DIR" ]; then
  echo "[3/5] Downloading Android cmdline-tools (latest)..."
  TMP_ZIP=$(mktemp /tmp/cmdline-tools-XXXX.zip)
  curl -L "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip" -o "$TMP_ZIP"
  mkdir -p "$SDK_ROOT/cmdline-tools"
  unzip -q "$TMP_ZIP" -d "$SDK_ROOT/cmdline-tools"
  mv "$SDK_ROOT/cmdline-tools/cmdline-tools" "$CMDLINE_DIR"
  rm "$TMP_ZIP"
else
  echo "[3/5] Cmdline-tools already present."
fi

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
PATH_UPDATE="${CMDLINE_DIR}/bin:${SDK_ROOT}/platform-tools"
export PATH="$PATH_UPDATE:$PATH"

echo "[4/5] Installing required SDK components (you may need to accept licenses)..."
yes | sdkmanager --licenses >/dev/null 2>&1 || true

# Try desired API 36 first; fallback to 35 if not listed.
DESIRED_API=36
if ! sdkmanager --list | grep -q "platforms;android-${DESIRED_API}"; then
  echo " API ${DESIRED_API} not found in current channel, falling back to 35."
  DESIRED_API=35
fi

# Determine build-tools version: prefer matching major, fallback to highest available.
BUILD_TOOLS_VER="${DESIRED_API}.0.0"
if ! sdkmanager --list | grep -q "build-tools;${BUILD_TOOLS_VER}"; then
  BUILD_TOOLS_VER=$(sdkmanager --list | awk '/build-tools;[0-9]+\.[0-9]+\.[0-9]+/{print $1}' | sed 's/build-tools;//' | sort -V | tail -n1)
  echo " Using latest available build-tools: ${BUILD_TOOLS_VER}" 
fi

sdkmanager \
  "platform-tools" \
  "platforms;android-${DESIRED_API}" \
  "build-tools;${BUILD_TOOLS_VER}" \
  "sources;android-${DESIRED_API}" \
  "ndk;27.2.12479018" \
  "cmake;3.22.1" || true

echo "[5/5] Ensuring Rust targets..."
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android >/dev/null

NDK_PATH=$(ls -d "$SDK_ROOT"/ndk/* | sort -V | tail -n1 || true)
if [ -n "${NDK_PATH}" ]; then
  export ANDROID_NDK_HOME="$NDK_PATH"
  export ANDROID_NDK_ROOT="$NDK_PATH"
  export NDK_HOME="$NDK_PATH"
fi

append_once() {
  local line="$1"
  grep -F "$line" "$ZSHRC" >/dev/null 2>&1 || echo "$line" >>"$ZSHRC"
}

echo "Updating $ZSHRC with environment variables (idempotent)..."
append_once "# Android SDK setup (training-planner)"
append_once "export ANDROID_HOME=\"$SDK_ROOT\""
append_once "export ANDROID_SDK_ROOT=\"$SDK_ROOT\""
if [ -n "${NDK_PATH}" ]; then
  append_once "export ANDROID_NDK_HOME=\"$NDK_PATH\""
  append_once "export ANDROID_NDK_ROOT=\"$NDK_PATH\""
  append_once "export NDK_HOME=\"$NDK_PATH\""
fi
append_once "export PATH=\"$PATH_UPDATE:\$PATH\""

echo "Summary:" 
echo "  ANDROID_HOME=$ANDROID_HOME"
echo "  ANDROID_NDK_HOME=${ANDROID_NDK_HOME:-'(not set yet)'}"
echo "  Installed API Level: ${DESIRED_API} (build-tools ${BUILD_TOOLS_VER})"
echo "  Rust mobile targets installed."
echo "Reload your shell: 'exec zsh' or open a new terminal."
echo "Then run: npm run android:dev"

echo "Done."
