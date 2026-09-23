#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "=============================================="
echo "   🤖 Jena Autonomous AI Agent Setup"
echo "=============================================="

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$DIR"
BIN_TARGET="/data/data/com.termux/files/usr/bin/jena"
HOME_DIR="/data/data/com.termux/files/home"

chmod +x "$AGENT_DIR/main.py"

# Create symlink in usr/bin if possible
if [ -d "/data/data/com.termux/files/usr/bin" ]; then
    ln -sf "$AGENT_DIR/main.py" "$BIN_TARGET"
    echo "✅ Global command '$BIN_TARGET' ban gaya hai."
fi

# Add or update alias to .bashrc and .zshrc
for rc in "$HOME_DIR/.bashrc" "$HOME_DIR/.zshrc"; do
    if [ -f "$rc" ]; then
        if grep -q "alias jena=" "$rc"; then
            sed -i "s|alias jena=.*|alias jena='python3 $AGENT_DIR/main.py'|g" "$rc"
            echo "✅ Alias '$rc' mein update kar diya gaya hai."
        else
            echo "" >> "$rc"
            echo "# Jena Autonomous AI Agent" >> "$rc"
            echo "alias jena='python3 $AGENT_DIR/main.py'" >> "$rc"
            echo "✅ Alias '$rc' mein shamil kar diya gaya hai."
        fi
    fi
done

# Create ~/.jena directory
mkdir -p "$HOME_DIR/.jena"

echo ""
echo "🎉 Mubarak ho! Jena Autonomous Agent kamyabi se install ho gaya hai."
echo ""
echo "Istemal karne ka tareeqa:"
echo "1. Apna API key set karein:"
echo "   jena --config"
echo "   (Ya export GEMINI_API_KEY='your_key' / export GROQ_API_KEY='your_key')"
echo ""
echo "2. Jena se baat cheet karein (Interactive mode):"
echo "   jena"
echo ""
echo "3. Direct task execute karwayein:"
echo "   jena 'mera folder check karo aur ek backup script bana kar do'"
echo "=============================================="
