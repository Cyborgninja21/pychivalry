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

- **Automatic Recovery**: Detects server crashes and restarts automatically
- **Helpful Actions**: One-click solutions for common issues
  - Restart server
  - Show output logs
  - Open settings
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

## Requirements

- **VS Code 1.75 or higher**

The language server is embedded in the extension — no separate installation is required.

## Installation

### From Source

1. Clone the repository
2. Navigate to `vscode-extension` directory
3. Install dependencies: `npm install`
4. Compile: `npm run compile`
5. Press F5 in VS Code to run the extension in development mode

## Extension Settings

This extension contributes the following settings:

### General

* `ck3LanguageServer.enable`: Enable/disable the CK3 language server (default: `true`)
* `ck3LanguageServer.args`: Additional arguments to pass to the language server (default: `[]`)
* `ck3LanguageServer.trace.server`: Trace LSP communication for debugging (`off`, `messages`, `verbose`)
* `ck3LanguageServer.logLevel`: Log level for the server — `debug`, `info`, `warning`, `error` (default: `info`)

### Formatting

* `ck3LanguageServer.formatting.enabled`: Enable document formatting (default: `true`)
* `ck3LanguageServer.formatting.insertSpaces`: Use spaces instead of tabs (default: `false`)
* `ck3LanguageServer.formatting.tabSize`: Number of spaces per tab (default: `4`)

### Inlay Hints

* `ck3LanguageServer.inlayHints.enabled`: Enable inlay hints (default: `true`)
* `ck3LanguageServer.inlayHints.showScopeTypes`: Show type hints for saved scopes (default: `true`)
* `ck3LanguageServer.inlayHints.showChainTypes`: Show type hints for scope chains (default: `true`)
* `ck3LanguageServer.inlayHints.showIteratorTypes`: Show type hints for iterators (default: `true`)
* `ck3LanguageServer.inlayHints.maxHintsPerLine`: Max hints per line, 1–10 (default: `3`)

### Game Log Watcher

* `ck3LanguageServer.logWatcher.enabled`: Enable game log watcher (default: `true`)
* `ck3LanguageServer.logWatcher.autoStart`: Auto-start watching on workspace open (default: `false`)
* `ck3LanguageServer.logWatcher.logPath`: Custom path to CK3 logs directory (default: auto-detect)
* `ck3LanguageServer.logWatcher.showInOutput`: Show log entries in GameLogs output channel (default: `true`)
* `ck3LanguageServer.logWatcher.maxLogSize`: Max game.log size to process in MB (default: `100`)
* `ck3LanguageServer.logWatcher.debounceDelay`: Delay in ms before processing changes (default: `500`)
* `ck3LanguageServer.logWatcher.patterns`: Custom regex patterns for error detection (default: `[]`)

## Commands

Access these commands from the Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

* **CK3: Restart Language Server** - Restart the language server
* **CK3: Show Output Channel** - View server logs and diagnostics
* **CK3: Open CK3 Modding Documentation** - Open official CK3 modding wiki

You can also click the CK3 status bar item for a quick action menu.

## Usage

1. **Open Your CK3 Mod**:
   - Open a CK3 mod folder in VS Code
   - The extension activates automatically for CK3 files

2. **Check Status**:
   - Look for the CK3 icon in the status bar (bottom right)
   - Green checkmark = ready to use
   - Click for quick actions

3. **Start Coding**:
   - Type snippet prefixes (e.g., `event`, `if`, `option`) and press Tab
   - Enjoy syntax highlighting for all CK3 constructs
   - Use the Command Palette for additional actions

### Quick Tips

- **Snippets**: Type a prefix like `event` and press Tab to expand
- **Status Bar**: Click the CK3 status indicator for quick actions
- **Logs**: Use "CK3: Show Output Channel" to view server logs
- **Settings**: Search for "CK3" in VS Code settings to configure

## Troubleshooting

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
