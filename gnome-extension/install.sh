#!/bin/bash

# Pucoti GNOME Extension Installer
# This script installs/updates the Pucoti GNOME Shell extension

# TODO: make the app run this automatically on install or first run

set -e

EXTENSION_UUID="pucoti@pucoti.dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/$EXTENSION_UUID"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

echo "Installing Pucoti GNOME Extension..."

# Check if source exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Extension source not found at $SOURCE_DIR"
    exit 1
fi

# Create extensions directory if needed
mkdir -p "$(dirname "$INSTALL_DIR")"

# Remove existing installation
if [ -d "$INSTALL_DIR" ] || [ -L "$INSTALL_DIR" ]; then
    echo "Removing existing installation..."
    rm -rf "$INSTALL_DIR"
fi

# Copy extension files
echo "Copying extension files..."
cp -r "$SOURCE_DIR" "$INSTALL_DIR"

echo "Extension installed to: $INSTALL_DIR"
echo ""
echo "To enable the extension:"
echo "  1. Log out and log back in (or restart GNOME Shell with Alt+F2, type 'r', press Enter on X11)"
echo "  2. Run: gnome-extensions enable $EXTENSION_UUID"
echo ""
echo "To check extension status:"
echo "  gnome-extensions info $EXTENSION_UUID"
echo ""
echo "To view logs:"
echo "  journalctl -f -o cat /usr/bin/gnome-shell | grep -i pucoti"
