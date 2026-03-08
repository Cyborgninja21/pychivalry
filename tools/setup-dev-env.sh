#!/bin/bash
# Development environment setup script

set -e

echo "🔧 Setting up development environment for ck3-language-support..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

node_version=$(node --version | sed 's/^v//')
node_major=$(echo "$node_version" | cut -d'.' -f1)

if [ "$node_major" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: v$node_version"
    exit 1
fi

echo "✓ Node.js version: v$node_version"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. It should come with Node.js."
    exit 1
fi

npm_version=$(npm --version)
echo "✓ npm version: v$npm_version"

# Install VS Code extension dependencies
echo ""
echo "📦 Installing VS Code extension dependencies..."
cd vscode-extension
npm ci --quiet
cd ..
echo "✓ VS Code extension dependencies installed"

# Install pre-commit hooks
if command -v pre-commit &> /dev/null; then
    echo ""
    echo "🪝 Installing pre-commit hooks..."
    pre-commit install

    # Run initial pre-commit on all files (optional, can be slow)
    echo ""
    echo "🔍 Running pre-commit hooks on all files (this may take a minute)..."
    pre-commit run --all-files || true
else
    echo ""
    echo "⚠️  pre-commit not found. Skipping hook installation."
    echo "   Install pre-commit to enable automatic linting on commit:"
    echo "   https://pre-commit.com/#install"
fi

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "   - Run 'task build' to compile the extension"
echo "   - Run 'task test:unit' to run unit tests"
echo "   - Run 'task lint' to lint the source code"
echo "   - Press F5 in VS Code to launch the extension in debug mode"
echo "   - See CONTRIBUTING.md for more information"
