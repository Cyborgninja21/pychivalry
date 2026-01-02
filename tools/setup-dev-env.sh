#!/bin/bash
# Development environment setup script

set -e

echo "🔧 Setting up development environment for PyChivalry..."

# Check Python version
python_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
required_version="3.9"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.9 or higher is required. Current version: $python_version"
    exit 1
fi

echo "✓ Python version: $python_version"

# Install Python dependencies
echo ""
echo "📦 Installing Python dependencies..."
pip install -e ".[dev]" -q

# Install pre-commit hooks
echo ""
echo "🪝 Installing pre-commit hooks..."
pre-commit install

# Install VS Code extension dependencies (if Node.js is available)
if command -v npm &> /dev/null; then
    echo ""
    echo "📦 Installing VS Code extension dependencies..."
    cd vscode-extension
    npm ci --quiet
    cd ..
    echo "✓ VS Code extension dependencies installed"
else
    echo ""
    echo "⚠️  npm not found. Skipping VS Code extension setup."
    echo "   Install Node.js to set up the VS Code extension."
fi

# Run initial pre-commit on all files (optional, can be slow)
echo ""
echo "🔍 Running pre-commit hooks on all files (this may take a minute)..."
pre-commit run --all-files || true

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "   - Pre-commit hooks are now active and will run automatically on git commit"
echo "   - Run 'pytest' to run the Python tests"
echo "   - Run 'pre-commit run --all-files' to manually run all hooks"
echo "   - See CONTRIBUTING.md for more information"
