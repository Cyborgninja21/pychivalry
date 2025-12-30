# CK3 Language Support for VS Code

Language support extension for Crusader Kings 3 scripting language, powered by a Language Server Protocol (LSP) implementation.

## Features

### 🎨 Syntax Highlighting

Advanced TextMate grammar providing rich syntax highlighting for CK3 scripts:

- **Keywords**: Control flow (`if`, `else`, `while`, `limit`), event keywords (`trigger`, `effect`, `immediate`)
- **Scope References**: `scope:target`, `root`, `prev`, `liege`, etc.
- **Variables**: `var:counter`, `$PARAM$` style parameters
- **Functions**: Built-in effects (`add_gold`, `add_trait`) and triggers (`has_trait`, `is_adult`)
- **Event Definitions**: Event IDs like `namespace.0001`
- **Iterators**: `every_vassal`, `any_courtier`, `random_child`
- **Comments**: `#` line comments
- **Strings & Numbers**: Properly highlighted

### 📝 Code Snippets

30+ snippets for common CK3 patterns to boost productivity:

| Snippet | Prefix | Description |
|---------|--------|-------------|
| Character Event | `event` | Full event template with all blocks |
| If Block | `if` | Conditional with limit |
| Option | `option` | Event option block |
| Trigger Block | `trigger` | Trigger conditions |
| Every Iterator | `every` | Loop through entities |
| Random Iterator | `random` | Random selection with weights |
| Portrait | `portrait` | Portrait configuration |
| Trigger Event | `triggerevent` | Schedule another event |
| Add Trait | `addtrait` | Add character trait |
| Save Scope | `savescope` | Save scope for later use |

...and many more!

### 📊 Status Bar Integration

Visual server status indicator in the status bar:

- 🟢 **Running**: Server active and ready
- 🔵 **Starting**: Server initializing
- ⚠️ **Stopped**: Server not running
- 🔴 **Error**: Server encountered an issue

Click the status bar item for quick actions:
- Restart server
- Show output logs
- Open settings
- Open CK3 modding documentation

### 🛡️ Enhanced Error Handling

Intelligent error detection and recovery:

- **Python Detection**: Automatically finds Python 3.9+ installation
- **Module Check**: Verifies `pychivalry` is installed
- **Helpful Actions**: One-click solutions for common issues
  - Configure Python path
  - Install Python
  - Install pychivalry server
- **Workspace Trust**: Respects VS Code workspace trust settings

### 🚀 Real-time Language Features

- **Syntax Support**: File association and basic syntax recognition for CK3 script files
- **Real-time Synchronization**: Automatic tracking of document changes
- **Extensible Architecture**: Built on LSP for future language features

### Supported File Types

- `.txt` - CK3 script files (events, decisions, etc.)
- `.gui` - GUI definition files
- `.gfx` - Graphics definition files
- `.asset` - Asset definition files

### Coming Soon

- Auto-completion for CK3 keywords and scopes
- Syntax diagnostics and error checking
- Hover documentation for game concepts
- Go-to-definition for scripted effects and triggers
- Symbol search across files

## Requirements

- **Python 3.9 or higher** - The extension will help you install it if missing
- **pychivalry LSP server** - Install with: `pip install pychivalry`

The extension will automatically detect Python and guide you through setup if anything is missing.

## Installation

### From Source

1. Clone the repository
2. Navigate to `vscode-extension` directory
3. Install dependencies: `npm install`
4. Compile: `npm run compile`
5. Press F5 in VS Code to run the extension in development mode

## Extension Settings

This extension contributes the following settings:

* `ck3LanguageServer.enable`: Enable/disable the CK3 language server (default: `true`)
* `ck3LanguageServer.pythonPath`: Path to Python executable (default: `python`)
* `ck3LanguageServer.args`: Additional arguments to pass to the language server (default: `[]`)
* `ck3LanguageServer.trace.server`: Trace LSP communication for debugging (`off`, `messages`, `verbose`)

## Commands

Access these commands from the Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

* **CK3: Restart Language Server** - Restart the language server
* **CK3: Show Output Channel** - View server logs and diagnostics
* **CK3: Open CK3 Modding Documentation** - Open official CK3 modding wiki

You can also click the CK3 status bar item for a quick action menu.

## Usage

1. **Install Prerequisites**:
   - Ensure Python 3.9+ is installed
   - Install pychivalry: `pip install pychivalry`

2. **Open Your CK3 Mod**:
   - Open a CK3 mod folder in VS Code
   - The extension activates automatically for CK3 files

3. **Check Status**:
   - Look for the CK3 icon in the status bar (bottom right)
   - Green checkmark = ready to use
   - Click for quick actions

4. **Start Coding**:
   - Type snippet prefixes (e.g., `event`, `if`, `option`) and press Tab
   - Enjoy syntax highlighting for all CK3 constructs
   - Use the Command Palette for additional actions

### Quick Tips

- **Snippets**: Type a prefix like `event` and press Tab to expand
- **Status Bar**: Click the CK3 status indicator for quick actions
- **Logs**: Use "CK3: Show Output Channel" to view server logs
- **Settings**: Search for "CK3" in VS Code settings to configure

## Troubleshooting

### Python Not Found

The extension will prompt you to:
1. Configure Python path in settings
2. Install Python from python.org

Set a custom Python path:
```json
{
    "ck3LanguageServer.pythonPath": "/path/to/python"
}
```

### pychivalry Not Installed

The extension will offer to:
1. Open a terminal to run `pip install pychivalry`
2. View installation documentation

### Server Won't Start

1. Check the CK3 status bar icon for error details
2. Open "CK3: Show Output Channel" for full logs
3. Try "CK3: Restart Language Server"
4. Enable verbose logging:
   ```json
   {
       "ck3LanguageServer.trace.server": "verbose"
   }
   ```

### Workspace Not Trusted

The extension respects VS Code workspace trust. If your workspace isn't trusted, the server won't start. Click "Trust Workspace" in VS Code to enable the extension.

## Development

### Building

```bash
npm install
npm run compile
```

### Packaging

```bash
npm run package
```

### Debugging

1. Open the extension folder in VS Code
2. Press F5 to launch Extension Development Host
3. Open a CK3 project in the new window
4. Check output panels for logs

## License

Apache-2.0

## Contributing

Issues and pull requests welcome at: https://github.com/Cyborgninja21/pychivalry
