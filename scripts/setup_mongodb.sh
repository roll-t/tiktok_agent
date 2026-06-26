#!/bin/bash

# Exit on error
set -e

PROJECT_DIR="/Users/phamtruong/Documents/Code/tiktok_agent"
DATA_DIR="$PROJECT_DIR/data"
BIN_DIR="$DATA_DIR/mongodb-bin"
DB_PATH="$DATA_DIR/mongodb-data"
LOG_PATH="$DATA_DIR/mongodb.log"

mkdir -p "$DATA_DIR"
mkdir -p "$DB_PATH"

if [ ! -f "$BIN_DIR/bin/mongod" ]; then
  echo "MongoDB binaries not found. Downloading pre-compiled binaries for macOS arm64..."
  TEMP_TGZ="$DATA_DIR/mongodb.tgz"
  curl -L -o "$TEMP_TGZ" https://fastdl.mongodb.org/osx/mongodb-macos-arm64-7.0.37.tgz
  
  echo "Extracting..."
  mkdir -p "$BIN_DIR"
  tar -zxvf "$TEMP_TGZ" -C "$BIN_DIR" --strip-components=1
  rm "$TEMP_TGZ"
  
  echo "Removing macOS Gatekeeper quarantine attribute..."
  xattr -r -d com.apple.quarantine "$BIN_DIR" || true
  
  echo "MongoDB binaries installed successfully at $BIN_DIR/bin/"
else
  echo "MongoDB binaries already installed at $BIN_DIR/bin/"
fi

echo "Starting MongoDB in the background..."
# Kiểm tra xem mongod có đang chạy không
if ps aux | grep "$BIN_DIR/bin/mongod" | grep -v grep > /dev/null; then
  echo "MongoDB is already running."
else
  "$BIN_DIR/bin/mongod" --dbpath "$DB_PATH" --logpath "$LOG_PATH" --fork
  echo "MongoDB started successfully!"
fi
