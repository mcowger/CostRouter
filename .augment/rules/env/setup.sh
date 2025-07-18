#!/bin/bash
set -e

echo "Setting up LLM Gateway development environment..."

# Install Node.js 22 (LTS) using NodeSource repository
echo "Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install pnpm globally
echo "Installing pnpm..."
npm install -g pnpm

# Add pnpm to PATH in user's profile
echo 'export PATH="$HOME/.local/share/pnpm:$PATH"' >> $HOME/.profile

# Verify pnpm installation
pnpm --version

# Navigate to workspace directory
cd /mnt/persist/workspace

# Install all dependencies using pnpm
echo "Installing project dependencies..."
pnpm install

# Create a basic config file for the server to prevent build errors
echo "Creating basic config file..."
cp config.example.jsonc config.jsonc

echo "Setup completed successfully!"