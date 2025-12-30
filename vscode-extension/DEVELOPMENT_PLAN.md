# VS Code Extension Development Plan

A phased roadmap for bringing the CK3 Language Support extension to full production readiness. This plan coordinates with the [Language Server Development Plan](../DEVELOPMENT_PLAN.md) but focuses on VS Code-specific features and UX.

---

## Design Principles

> **Client-Server Separation.** The extension is a thin client; intelligence lives in the language server. The extension handles VS Code integration, UI/UX, and user configuration.

### Key Design Goals

1. **Minimal client logic** — Delegate all language intelligence to the LSP server
2. **Rich configuration** — Expose server capabilities through intuitive settings
3. **Excellent UX** — Provide clear feedback, helpful commands, and polished UI
4. **Robust error handling** — Gracefully handle server failures, missing dependencies
5. **Multi-workspace support** — Work correctly with multi-root workspaces and mod folders
6. **Marketplace ready** — Proper icons, documentation, and publishing setup

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
├─────────────────────────────────────────────────────────────┤
│  extension.ts          │ Entry point, lifecycle management  │
│  commands/             │ User-facing commands               │
│  configuration/        │ Settings validation & management   │
│  statusBar/            │ Status indicators & quick actions  │
│  webviews/             │ Custom UI panels (scope viewer)    │
│  syntaxHighlighting/   │ TextMate grammar definitions       │
│  snippets/             │ Code snippet definitions           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ JSON-RPC (stdio)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  pychivalry LSP Server                       │
│              (See ../DEVELOPMENT_PLAN.md)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Current State

The extension currently provides:
- ✅ Language client connecting to pychivalry server via stdio
- ✅ Basic language configuration (brackets, comments, folding)
- ✅ File type associations (.txt, .gui, .gfx, .asset)
- ✅ Configuration for Python path and server arguments
- ✅ Restart command for the language server
- ✅ Output channel for logging

**Limitations:**
- ❌ No syntax highlighting (TextMate grammar)
- ❌ No code snippets
- ❌ No status bar integration
- ❌ No workspace/mod detection
- ❌ No extension icon or branding
- ❌ No marketplace publishing setup
- ❌ No automated tests
- ❌ Limited error handling for missing Python/server

---

## Phase 1: Syntax Highlighting (Week 1-2)
**Priority: Critical | Complexity: Medium**

TextMate grammar provides syntax highlighting before the LSP server even starts. This is the most visible feature for first impressions.

### 1.1 Create TextMate Grammar

Create `syntaxes/ck3.tmLanguage.json`:

```json
{
    "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
    "name": "CK3",
    "scopeName": "source.ck3",
    "patterns": [
        { "include": "#comments" },
        { "include": "#strings" },
        { "include": "#numbers" },
        { "include": "#operators" },
        { "include": "#keywords" },
        { "include": "#scopes" },
        { "include": "#blocks" }
    ],
    "repository": {
        "comments": {
            "name": "comment.line.number-sign.ck3",
            "match": "#.*$"
        },
        "strings": {
            "name": "string.quoted.double.ck3",
            "begin": "\"",
            "end": "\"",
            "patterns": [
                { "name": "constant.character.escape.ck3", "match": "\\\\." }
            ]
        },
        "numbers": {
            "name": "constant.numeric.ck3",
            "match": "-?\\b\\d+(\\.\\d+)?\\b"
        },
        "keywords": {
            "patterns": [
                {
                    "name": "keyword.control.ck3",
                    "match": "\\b(if|else|else_if|while|switch|trigger_switch|limit|break)\\b"
                },
                {
                    "name": "keyword.other.event.ck3",
                    "match": "\\b(trigger|effect|immediate|option|desc|title|theme)\\b"
                }
            ]
        }
    }
}
```

### 1.2 Token Categories

| Category | Color Intent | Examples |
|----------|--------------|----------|
| `keyword.control` | Purple | if, else, while, limit |
| `keyword.other.event` | Blue | trigger, effect, immediate |
| `entity.name.function` | Yellow | scripted effects/triggers |
| `variable.other.scope` | Cyan | scope:target, root, liege |
| `constant.numeric` | Light Green | 100, -50, 3.14 |
| `constant.language` | Orange | yes, no |
| `string.quoted` | Brown/Tan | "my_string" |
| `comment` | Gray/Green | # comments |
| `support.function` | Light Blue | add_gold, has_trait |
| `entity.name.type` | Gold | character_event, namespace |

### 1.3 Register Grammar in package.json

```json
{
    "contributes": {
        "grammars": [
            {
                "language": "ck3",
                "scopeName": "source.ck3",
                "path": "./syntaxes/ck3.tmLanguage.json"
            }
        ]
    }
}
```

### 1.4 Scope-Specific Highlighting

Advanced patterns for CK3-specific constructs:

| Pattern | Scope | Example |
|---------|-------|---------|
| `namespace = xxx` | entity.name.namespace | `namespace = my_mod` |
| `xxx.0001 = { }` | entity.name.event | `my_mod.0001 = { }` |
| `scope:xxx` | variable.other.saved-scope | `scope:target` |
| `var:xxx` | variable.other.variable | `var:counter` |
| `$PARAM$` | variable.parameter | `$GOLD_AMOUNT$` |
| `every_xxx` / `any_xxx` | keyword.control.iterator | `every_vassal` |

---

## Phase 2: Code Snippets (Week 2-3)
**Priority: High | Complexity: Low**

Snippets dramatically improve productivity. They work even without the LSP server.

### 2.1 Create Snippet File

Create `snippets/ck3.json`:

```json
{
    "Character Event": {
        "prefix": "event",
        "body": [
            "${1:namespace}.${2:0001} = {",
            "\ttype = character_event",
            "\ttitle = ${1:namespace}.${2:0001}.t",
            "\tdesc = ${1:namespace}.${2:0001}.desc",
            "\ttheme = ${3|default,diplomacy,intrigue,martial,stewardship,learning,seduction|}",
            "\t",
            "\tleft_portrait = root",
            "\t",
            "\ttrigger = {",
            "\t\t$4",
            "\t}",
            "\t",
            "\timmediate = {",
            "\t\t$5",
            "\t}",
            "\t",
            "\toption = {",
            "\t\tname = ${1:namespace}.${2:0001}.a",
            "\t\t$0",
            "\t}",
            "}"
        ],
        "description": "Create a new character event"
    },
    "Trigger Block": {
        "prefix": "trigger",
        "body": [
            "trigger = {",
            "\t$0",
            "}"
        ],
        "description": "Create a trigger block"
    },
    "If Block": {
        "prefix": "if",
        "body": [
            "if = {",
            "\tlimit = {",
            "\t\t$1",
            "\t}",
            "\t$0",
            "}"
        ],
        "description": "Create an if block with limit"
    },
    "Option": {
        "prefix": "option",
        "body": [
            "option = {",
            "\tname = ${1:event_id}.${2:a}",
            "\t$0",
            "}"
        ],
        "description": "Create an event option"
    },
    "Every Iterator": {
        "prefix": "every",
        "body": [
            "every_${1|vassal,courtier,child,spouse,ally,realm_province|} = {",
            "\tlimit = {",
            "\t\t$2",
            "\t}",
            "\t$0",
            "}"
        ],
        "description": "Create an every_ iterator"
    },
    "Random Iterator": {
        "prefix": "random",
        "body": [
            "random_${1|vassal,courtier,child,spouse,ally,realm_province|} = {",
            "\tlimit = {",
            "\t\t$2",
            "\t}",
            "\tweight = {",
            "\t\tbase = 1",
            "\t\t$3",
            "\t}",
            "\t$0",
            "}"
        ],
        "description": "Create a random_ iterator with weight"
    },
    "Save Scope": {
        "prefix": "savescope",
        "body": "save_scope_as = ${1:scope_name}",
        "description": "Save current scope for later reference"
    },
    "Scripted Effect Call": {
        "prefix": "scriptedeffect",
        "body": [
            "${1:effect_name} = {",
            "\t${2:PARAM} = ${3:value}",
            "}"
        ],
        "description": "Call a scripted effect with parameters"
    },
    "Trigger Event": {
        "prefix": "triggerevent",
        "body": [
            "trigger_event = {",
            "\tid = ${1:namespace}.${2:0001}",
            "\tdays = ${3:1}",
            "}"
        ],
        "description": "Trigger another event"
    },
    "Portrait Block": {
        "prefix": "portrait",
        "body": [
            "${1|left_portrait,right_portrait,lower_left_portrait,lower_center_portrait,lower_right_portrait|} = {",
            "\tcharacter = ${2:scope:target}",
            "\tanimation = ${3|idle,happiness,sadness,anger,fear,disgust,shock,scheme,flirtation,boredom|}",
            "}"
        ],
        "description": "Create a portrait block"
    },
    "Namespace Declaration": {
        "prefix": "namespace",
        "body": "namespace = ${1:my_mod}",
        "description": "Declare event namespace"
    },
    "Opinion Modifier": {
        "prefix": "opinion",
        "body": [
            "add_opinion = {",
            "\ttarget = ${1:root}",
            "\tmodifier = ${2:opinion_modifier_name}",
            "}"
        ],
        "description": "Add an opinion modifier"
    },
    "Set Variable": {
        "prefix": "setvar",
        "body": [
            "set_variable = {",
            "\tname = ${1:variable_name}",
            "\tvalue = ${2:value}",
            "}"
        ],
        "description": "Set a variable"
    }
}
```

### 2.2 Register Snippets

```json
{
    "contributes": {
        "snippets": [
            {
                "language": "ck3",
                "path": "./snippets/ck3.json"
            }
        ]
    }
}
```

### 2.3 Snippet Categories

| Category | Prefixes | Count |
|----------|----------|-------|
| Events | event, option, portrait | 3 |
| Control Flow | if, else, switch, limit | 4 |
| Iterators | every, any, random, ordered | 4 |
| Scopes | savescope, scope | 2 |
| Effects | triggerevent, opinion, setvar | 5+ |
| Structures | trigger, effect, immediate | 3 |
| Localization | loc, desc | 2 |

**Target: 25+ snippets covering common patterns**

---

## Phase 3: Status Bar Integration (Week 3-4)
**Priority: High | Complexity: Low**

Provide at-a-glance server status and quick actions.

### 3.1 Status Bar Item

Create status bar showing server state:

```typescript
// src/statusBar.ts
import * as vscode from 'vscode';

export class CK3StatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private state: 'starting' | 'running' | 'stopped' | 'error' = 'stopped';
    
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'ck3LanguageServer.showMenu';
    }
    
    updateState(state: 'starting' | 'running' | 'stopped' | 'error', message?: string) {
        this.state = state;
        switch (state) {
            case 'starting':
                this.statusBarItem.text = '$(sync~spin) CK3';
                this.statusBarItem.tooltip = 'CK3 Language Server starting...';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'running':
                this.statusBarItem.text = '$(check) CK3';
                this.statusBarItem.tooltip = 'CK3 Language Server running';
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'stopped':
                this.statusBarItem.text = '$(circle-slash) CK3';
                this.statusBarItem.tooltip = 'CK3 Language Server stopped';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                break;
            case 'error':
                this.statusBarItem.text = '$(error) CK3';
                this.statusBarItem.tooltip = message || 'CK3 Language Server error';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground'
                );
                break;
        }
        this.statusBarItem.show();
    }
    
    dispose() {
        this.statusBarItem.dispose();
    }
}
```

### 3.2 Status Bar Menu Command

Quick actions from status bar click:

```typescript
vscode.commands.registerCommand('ck3LanguageServer.showMenu', async () => {
    const items: vscode.QuickPickItem[] = [
        { label: '$(refresh) Restart Server', description: 'Restart the language server' },
        { label: '$(output) Show Output', description: 'Open output channel' },
        { label: '$(gear) Open Settings', description: 'Configure extension' },
        { label: '$(book) Documentation', description: 'Open CK3 modding docs' },
    ];
    
    const selected = await vscode.window.showQuickPick(items);
    if (selected) {
        switch (selected.label) {
            case '$(refresh) Restart Server':
                vscode.commands.executeCommand('ck3LanguageServer.restart');
                break;
            case '$(output) Show Output':
                outputChannel.show();
                break;
            case '$(gear) Open Settings':
                vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'ck3LanguageServer'
                );
                break;
            case '$(book) Documentation':
                vscode.env.openExternal(
                    vscode.Uri.parse('https://ck3.paradoxwikis.com/Modding')
                );
                break;
        }
    }
});
```

### 3.3 Progress Indicators

Show progress during workspace indexing:

```typescript
await vscode.window.withProgress({
    location: vscode.ProgressLocation.Window,
    title: 'CK3: Indexing workspace...',
    cancellable: false
}, async (progress) => {
    // Report progress as server sends updates
    client.onProgress('$/ck3/indexProgress', 'index', (params) => {
        progress.report({
            message: `${params.indexed}/${params.total} files`,
            increment: params.increment
        });
    });
});
```

---

## Phase 4: Enhanced Error Handling (Week 4-5)
**Priority: High | Complexity: Medium**

Gracefully handle all failure modes with helpful recovery options.

### 4.1 Python Detection

Check Python availability before starting server:

```typescript
async function findPython(): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration('ck3LanguageServer');
    const configuredPath = config.get<string>('pythonPath');
    
    // Try configured path first
    if (configuredPath && configuredPath !== 'python') {
        if (await checkPythonPath(configuredPath)) {
            return configuredPath;
        }
    }
    
    // Try common paths
    const candidates = [
        'python3',
        'python',
        process.platform === 'win32' ? 'py' : undefined,
    ].filter(Boolean);
    
    for (const candidate of candidates) {
        if (await checkPythonPath(candidate)) {
            return candidate;
        }
    }
    
    return undefined;
}

async function checkPythonPath(pythonPath: string): Promise<boolean> {
    try {
        const { stdout } = await execAsync(`${pythonPath} --version`);
        const version = stdout.match(/Python (\d+)\.(\d+)/);
        if (version) {
            const major = parseInt(version[1]);
            const minor = parseInt(version[2]);
            return major >= 3 && minor >= 9;
        }
    } catch {
        return false;
    }
    return false;
}
```

### 4.2 Server Installation Check

Verify pychivalry is installed:

```typescript
async function checkServerInstalled(pythonPath: string): Promise<boolean> {
    try {
        await execAsync(`${pythonPath} -c "import pychivalry"`);
        return true;
    } catch {
        return false;
    }
}
```

### 4.3 Error Recovery UI

Provide helpful actions when things go wrong:

```typescript
async function handleServerError(error: Error): Promise<void> {
    const pythonMissing = error.message.includes('ENOENT');
    const moduleMissing = error.message.includes('No module named');
    
    if (pythonMissing) {
        const action = await vscode.window.showErrorMessage(
            'Python not found. The CK3 Language Server requires Python 3.9+.',
            'Configure Python Path',
            'Install Python'
        );
        
        if (action === 'Configure Python Path') {
            vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'ck3LanguageServer.pythonPath'
            );
        } else if (action === 'Install Python') {
            vscode.env.openExternal(
                vscode.Uri.parse('https://www.python.org/downloads/')
            );
        }
    } else if (moduleMissing) {
        const action = await vscode.window.showErrorMessage(
            'pychivalry language server not installed.',
            'Install Server',
            'View Documentation'
        );
        
        if (action === 'Install Server') {
            const terminal = vscode.window.createTerminal('Install CK3 Server');
            terminal.show();
            terminal.sendText('pip install pychivalry');
        }
    } else {
        vscode.window.showErrorMessage(
            `CK3 Language Server error: ${error.message}`,
            'Show Output'
        ).then(action => {
            if (action === 'Show Output') {
                outputChannel.show();
            }
        });
    }
}
```

### 4.4 Automatic Retry

Retry server connection with backoff:

```typescript
async function startServerWithRetry(maxRetries = 3): Promise<void> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await startServer();
            return;
        } catch (error) {
            lastError = error as Error;
            outputChannel.appendLine(
                `Server start attempt ${attempt}/${maxRetries} failed: ${lastError.message}`
            );
            
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    await handleServerError(lastError!);
}
```

---

## Phase 5: Mod Workspace Detection (Week 5-6)
**Priority: Medium | Complexity: Medium**

Automatically detect and configure CK3 mod workspaces.

### 5.1 Descriptor File Detection

Find `.mod` files to identify CK3 mod folders:

```typescript
interface ModDescriptor {
    name: string;
    path: string;
    version?: string;
    supportedVersion?: string;
    dependencies?: string[];
    replacePaths?: string[];
}

async function findModDescriptors(): Promise<ModDescriptor[]> {
    const modFiles = await vscode.workspace.findFiles('**/*.mod', '**/node_modules/**');
    const descriptors: ModDescriptor[] = [];
    
    for (const file of modFiles) {
        try {
            const content = await vscode.workspace.fs.readFile(file);
            const descriptor = parseModDescriptor(content.toString());
            descriptor.path = path.dirname(file.fsPath);
            descriptors.push(descriptor);
        } catch {
            // Skip invalid descriptors
        }
    }
    
    return descriptors;
}
```

### 5.2 Game Installation Detection

Find CK3 game installation for vanilla file references:

```typescript
const STEAM_PATHS = {
    win32: [
        'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Crusader Kings III',
        'C:\\Program Files\\Steam\\steamapps\\common\\Crusader Kings III',
    ],
    darwin: [
        '~/Library/Application Support/Steam/steamapps/common/Crusader Kings III',
    ],
    linux: [
        '~/.steam/steam/steamapps/common/Crusader Kings III',
        '~/.local/share/Steam/steamapps/common/Crusader Kings III',
    ],
};

async function findGameInstallation(): Promise<string | undefined> {
    const platform = process.platform as keyof typeof STEAM_PATHS;
    const candidates = STEAM_PATHS[platform] || [];
    
    for (const candidate of candidates) {
        const expanded = candidate.replace('~', os.homedir());
        if (await pathExists(expanded)) {
            return expanded;
        }
    }
    
    // Allow manual configuration
    return vscode.workspace.getConfiguration('ck3LanguageServer')
        .get<string>('gameInstallPath');
}
```

### 5.3 Configuration Settings

Add workspace-aware settings:

```json
{
    "ck3LanguageServer.gameInstallPath": {
        "type": "string",
        "default": "",
        "description": "Path to CK3 game installation (for vanilla file references)"
    },
    "ck3LanguageServer.modPaths": {
        "type": "array",
        "default": [],
        "description": "Additional mod paths to include for cross-mod references",
        "items": { "type": "string" }
    },
    "ck3LanguageServer.excludePatterns": {
        "type": "array",
        "default": ["**/node_modules/**", "**/.git/**"],
        "description": "Glob patterns to exclude from indexing"
    }
}
```

### 5.4 Workspace Info Command

Show detected workspace configuration:

```typescript
vscode.commands.registerCommand('ck3LanguageServer.showWorkspaceInfo', async () => {
    const descriptors = await findModDescriptors();
    const gamePath = await findGameInstallation();
    
    const panel = vscode.window.createWebviewPanel(
        'ck3WorkspaceInfo',
        'CK3 Workspace Info',
        vscode.ViewColumn.One,
        {}
    );
    
    panel.webview.html = generateWorkspaceInfoHtml(descriptors, gamePath);
});
```

---

## Phase 6: Commands & Keybindings (Week 6-7)
**Priority: Medium | Complexity: Low**

Provide useful commands for CK3 modding workflows.

### 6.1 Command Palette Commands

```json
{
    "contributes": {
        "commands": [
            {
                "command": "ck3LanguageServer.restart",
                "title": "Restart Language Server",
                "category": "CK3"
            },
            {
                "command": "ck3LanguageServer.showOutput",
                "title": "Show Output Channel",
                "category": "CK3"
            },
            {
                "command": "ck3LanguageServer.openDocumentation",
                "title": "Open CK3 Modding Documentation",
                "category": "CK3"
            },
            {
                "command": "ck3LanguageServer.generateLocalization",
                "title": "Generate Missing Localization Keys",
                "category": "CK3"
            },
            {
                "command": "ck3LanguageServer.createEvent",
                "title": "Create New Event File",
                "category": "CK3"
            },
            {
                "command": "ck3LanguageServer.validateMod",
                "title": "Validate Entire Mod",
                "category": "CK3"
            },
            {
                "command": "ck3LanguageServer.copyConsoleCommand",
                "title": "Copy Event Console Command",
                "category": "CK3"
            },
            {
                "command": "ck3LanguageServer.showWorkspaceInfo",
                "title": "Show Workspace Info",
                "category": "CK3"
            }
        ]
    }
}
```

### 6.2 Context Menu Items

Right-click menu for CK3 files:

```json
{
    "contributes": {
        "menus": {
            "editor/context": [
                {
                    "command": "ck3LanguageServer.copyConsoleCommand",
                    "when": "resourceLangId == ck3 && editorTextFocus",
                    "group": "ck3@1"
                },
                {
                    "command": "ck3LanguageServer.generateLocalization",
                    "when": "resourceLangId == ck3",
                    "group": "ck3@2"
                }
            ],
            "explorer/context": [
                {
                    "command": "ck3LanguageServer.createEvent",
                    "when": "explorerResourceIsFolder",
                    "group": "ck3@1"
                }
            ]
        }
    }
}
```

### 6.3 Keybindings

```json
{
    "contributes": {
        "keybindings": [
            {
                "command": "ck3LanguageServer.copyConsoleCommand",
                "key": "ctrl+shift+c",
                "mac": "cmd+shift+c",
                "when": "resourceLangId == ck3 && editorTextFocus"
            }
        ]
    }
}
```

### 6.4 Copy Console Command Implementation

Copy event test command to clipboard:

```typescript
vscode.commands.registerCommand('ck3LanguageServer.copyConsoleCommand', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    
    const document = editor.document;
    const position = editor.selection.active;
    
    // Find event ID at cursor or in current block
    const eventId = await findEventIdAtPosition(document, position);
    
    if (eventId) {
        const command = `event ${eventId}`;
        await vscode.env.clipboard.writeText(command);
        vscode.window.showInformationMessage(`Copied: ${command}`);
    } else {
        vscode.window.showWarningMessage('No event ID found at cursor position');
    }
});
```

---

## Phase 7: Testing Infrastructure (Week 7-8)
**Priority: High | Complexity: Medium**

Automated testing ensures extension reliability.

### 7.1 Test Framework Setup

Configure VS Code extension testing:

```typescript
// src/test/suite/index.ts
import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000, // Extension tests can be slow
    });

    const testsRoot = path.resolve(__dirname, '..');
    
    return new Promise((resolve, reject) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) return reject(err);
            
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
            
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        });
    });
}
```

### 7.2 Extension Activation Tests

```typescript
// src/test/suite/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('cyborgninja21.ck3-language-support'));
    });

    test('Extension should activate on CK3 file', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'ck3',
            content: 'namespace = test'
        });
        await vscode.window.showTextDocument(doc);
        
        // Wait for activation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const ext = vscode.extensions.getExtension('cyborgninja21.ck3-language-support');
        assert.ok(ext?.isActive, 'Extension should be active');
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('ck3LanguageServer.restart'));
        assert.ok(commands.includes('ck3LanguageServer.showMenu'));
    });
});
```

### 7.3 Language Configuration Tests

```typescript
suite('Language Configuration', () => {
    test('CK3 language should be registered', () => {
        const languages = vscode.languages.getLanguages();
        // Languages is a Thenable
        return languages.then(langs => {
            assert.ok(langs.includes('ck3'));
        });
    });

    test('File extensions should map to CK3', async () => {
        const extensions = ['.txt', '.gui', '.gfx', '.asset'];
        for (const ext of extensions) {
            const doc = await vscode.workspace.openTextDocument({
                language: 'ck3',
                content: ''
            });
            // Check document language
        }
    });
});
```

### 7.4 CI Configuration

Update GitHub Actions for extension tests:

```yaml
# .github/workflows/extension.yml
name: Extension CI

on:
  push:
    paths:
      - 'vscode-extension/**'
  pull_request:
    paths:
      - 'vscode-extension/**'

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        working-directory: vscode-extension
        
      - name: Lint
        run: npm run lint
        working-directory: vscode-extension
        
      - name: Compile
        run: npm run compile
        working-directory: vscode-extension
        
      - name: Run tests
        run: xvfb-run -a npm test
        if: runner.os == 'Linux'
        working-directory: vscode-extension
        
      - name: Run tests
        run: npm test
        if: runner.os != 'Linux'
        working-directory: vscode-extension
```

---

## Phase 8: Marketplace Preparation (Week 8-9)
**Priority: Medium | Complexity: Low**

Prepare for VS Code Marketplace publishing.

### 8.1 Extension Icon

Create `images/icon.png` (128x128 minimum, 256x256 recommended):
- Design: Shield or crown motif with CK3 colors
- Format: PNG with transparency
- Colors: Gold (#c9a227), Dark Blue (#1a1a2e)

### 8.2 Gallery Banner

Create banner image for marketplace:
- Size: 1280x640 or similar
- Include mod screenshots
- Show syntax highlighting in action

### 8.3 Enhanced package.json

```json
{
    "icon": "images/icon.png",
    "galleryBanner": {
        "color": "#1a1a2e",
        "theme": "dark"
    },
    "badges": [
        {
            "url": "https://img.shields.io/github/v/release/Cyborgninja21/pychivalry",
            "href": "https://github.com/Cyborgninja21/pychivalry/releases",
            "description": "Latest Release"
        },
        {
            "url": "https://img.shields.io/github/license/Cyborgninja21/pychivalry",
            "href": "https://github.com/Cyborgninja21/pychivalry/blob/main/LICENSE",
            "description": "License"
        }
    ],
    "preview": true,
    "qna": "https://github.com/Cyborgninja21/pychivalry/discussions"
}
```

### 8.4 Comprehensive README

Expand README with:
- GIF demos of features
- Installation instructions
- Feature showcase
- Configuration reference
- Troubleshooting FAQ
- Contributing guidelines
- Changelog link

### 8.5 VSIX Packaging

```bash
# Install vsce
npm install -g @vscode/vsce

# Package extension
vsce package

# Publish to marketplace
vsce publish
```

### 8.6 Publisher Account

1. Create Azure DevOps organization
2. Create Personal Access Token with Marketplace scope
3. Create publisher ID on marketplace.visualstudio.com
4. Configure publisher in package.json

---

## Phase 9: Advanced Language Features (Week 9-11)
**Priority: Medium | Complexity: High**

Features that enhance the LSP client experience.

### 9.1 Custom Request Handlers

Handle custom LSP notifications from server:

```typescript
// Register custom notifications
client.onNotification('$/ck3/scopeInfo', (params: ScopeInfoParams) => {
    // Update scope viewer panel if open
    scopeViewerProvider.updateScopes(params.scopes);
});

client.onNotification('$/ck3/eventGraph', (params: EventGraphParams) => {
    // Update event flow visualization
    eventGraphProvider.updateGraph(params);
});
```

### 9.2 Scope Viewer Panel

WebView panel showing scope hierarchy:

```typescript
class ScopeViewerProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    
    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
        };
        webviewView.webview.html = this.getHtml();
    }
    
    updateScopes(scopes: ScopeInfo[]) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateScopes',
                scopes: scopes
            });
        }
    }
    
    private getHtml(): string {
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                .scope { padding: 4px; margin: 2px; }
                .scope-character { background: #2d4a3e; }
                .scope-title { background: #4a2d3e; }
                .scope-province { background: #3e4a2d; }
            </style>
        </head>
        <body>
            <div id="scope-tree"></div>
            <script>
                const vscode = acquireVsCodeApi();
                window.addEventListener('message', event => {
                    const { type, scopes } = event.data;
                    if (type === 'updateScopes') {
                        renderScopes(scopes);
                    }
                });
                
                function renderScopes(scopes) {
                    const container = document.getElementById('scope-tree');
                    container.innerHTML = scopes.map(s => 
                        \`<div class="scope scope-\${s.type}">\${s.name}: \${s.type}</div>\`
                    ).join('');
                }
            </script>
        </body>
        </html>`;
    }
}
```

### 9.3 Event Flow Visualization

Show event chain connections:

```typescript
vscode.commands.registerCommand('ck3LanguageServer.showEventFlow', async () => {
    const document = vscode.window.activeTextEditor?.document;
    if (!document) return;
    
    // Request event graph from server
    const graph = await client.sendRequest('$/ck3/getEventGraph', {
        uri: document.uri.toString()
    });
    
    // Show in webview
    EventGraphPanel.createOrShow(context.extensionUri, graph);
});
```

### 9.4 Inline Decorations

Show scope types inline (before LSP inlay hints):

```typescript
const scopeDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em'
    }
});

function updateDecorations(editor: vscode.TextEditor) {
    const decorations: vscode.DecorationOptions[] = [];
    
    // Parse document for scope: references
    const text = editor.document.getText();
    const scopeRegex = /scope:(\w+)/g;
    let match;
    
    while ((match = scopeRegex.exec(text))) {
        const startPos = editor.document.positionAt(match.index);
        const endPos = editor.document.positionAt(match.index + match[0].length);
        
        // Get scope type from server
        const scopeType = scopeTypes.get(match[1]) || 'unknown';
        
        decorations.push({
            range: new vscode.Range(startPos, endPos),
            renderOptions: {
                after: { contentText: `: ${scopeType}` }
            }
        });
    }
    
    editor.setDecorations(scopeDecorationType, decorations);
}
```

---

## Phase 10: Performance & Polish (Week 11-12)
**Priority: Medium | Complexity: Medium**

Optimize extension performance and user experience.

### 10.1 Lazy Activation

Only start server when needed:

```json
{
    "activationEvents": [
        "onLanguage:ck3",
        "workspaceContains:**/*.mod",
        "onCommand:ck3LanguageServer.restart"
    ]
}
```

### 10.2 Debounced Operations

Prevent excessive server requests:

```typescript
import { debounce } from './utils';

const debouncedValidate = debounce(async (document: vscode.TextDocument) => {
    await client.sendRequest('$/ck3/validate', {
        uri: document.uri.toString()
    });
}, 500);

vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document.languageId === 'ck3') {
        debouncedValidate(event.document);
    }
});
```

### 10.3 Workspace Trust

Handle untrusted workspaces:

```typescript
if (!vscode.workspace.isTrusted) {
    outputChannel.appendLine('Workspace not trusted, server disabled');
    statusBar.updateState('stopped', 'Workspace not trusted');
    return;
}

vscode.workspace.onDidGrantWorkspaceTrust(() => {
    startServer(context);
});
```

### 10.4 Telemetry (Optional)

Track usage for improvement:

```typescript
import TelemetryReporter from '@vscode/extension-telemetry';

const reporter = new TelemetryReporter(connectionString);

// Track feature usage
reporter.sendTelemetryEvent('commandExecuted', { command: 'restart' });
reporter.sendTelemetryEvent('serverStarted', { version: serverVersion });
reporter.sendTelemetryErrorEvent('serverCrashed', { error: message });
```

### 10.5 Memory Management

Clean up resources properly:

```typescript
context.subscriptions.push(
    client,
    statusBar,
    scopeViewerProvider,
    outputChannel,
    ...decorationTypes,
    { dispose: () => reporter.dispose() }
);
```

---

## Phase 11: Localization File Support (Week 12-13)
**Priority: Low-Medium | Complexity: Medium**

Enhanced support for CK3 localization files (.yml).

### 11.1 Localization Language Definition

Register separate language for localization:

```json
{
    "contributes": {
        "languages": [
            {
                "id": "ck3-localization",
                "aliases": ["CK3 Localization"],
                "extensions": [],
                "filenamePatterns": ["*_l_english.yml", "*_l_german.yml", "*_l_french.yml"],
                "configuration": "./language-configuration-yml.json"
            }
        ]
    }
}
```

### 11.2 Localization Syntax Highlighting

Create `syntaxes/ck3-localization.tmLanguage.json`:

```json
{
    "scopeName": "source.ck3-localization",
    "patterns": [
        {
            "name": "entity.name.tag.ck3-loc",
            "match": "^\\s*([\\w.]+):(\\d+)\\s+"
        },
        {
            "name": "support.function.ck3-loc",
            "match": "\\[([\\w.]+)\\]"
        },
        {
            "name": "constant.other.color.ck3-loc",
            "match": "#[PNFWHSEIO]|#!"
        }
    ]
}
```

### 11.3 Localization Snippets

```json
{
    "Localization Entry": {
        "prefix": "loc",
        "body": "${1:key}:0 \"${2:text}\"",
        "description": "Create a localization entry"
    },
    "Localization with GetName": {
        "prefix": "locname",
        "body": "${1:key}:0 \"[${2:character}.GetFirstName]${3: text}\"",
        "description": "Localization with character name"
    },
    "Positive Text": {
        "prefix": "positive",
        "body": "#P ${1:text}#!",
        "description": "Green positive text"
    },
    "Negative Text": {
        "prefix": "negative", 
        "body": "#N ${1:text}#!",
        "description": "Red negative text"
    }
}
```

---

## Phase 12: Future Enhancements (Ongoing)
**Priority: Low | Complexity: Varies**

Ideas for future development after core features are stable.

### 12.1 Debug Adapter Protocol

Implement DAP for in-game debugging:
- Set breakpoints in events
- Step through effect execution
- Inspect scope values

### 12.2 Task Provider

Custom task definitions for mod building:

```typescript
class CK3TaskProvider implements vscode.TaskProvider {
    provideTasks(): vscode.Task[] {
        return [
            new vscode.Task(
                { type: 'ck3', task: 'validate' },
                vscode.TaskScope.Workspace,
                'Validate Mod',
                'ck3',
                new vscode.ShellExecution('python -m pychivalry.validate ${workspaceFolder}')
            )
        ];
    }
}
```

### 12.3 Notebook Support

Jupyter-like notebooks for CK3 scripting experiments:
- Interactive script execution
- Immediate feedback on triggers
- Documentation cells

### 12.4 AI Integration

GitHub Copilot / AI completions trained on CK3 patterns:
- Event structure suggestions
- Effect recommendations based on context
- Natural language to script conversion

---

## Implementation Timeline Summary

| Phase | Focus | Duration | Dependencies |
|-------|-------|----------|--------------|
| 1 | Syntax Highlighting | 2 weeks | None |
| 2 | Code Snippets | 1 week | None |
| 3 | Status Bar | 1 week | None |
| 4 | Error Handling | 2 weeks | None |
| 5 | Mod Detection | 2 weeks | None |
| 6 | Commands | 1 week | Phase 3 |
| 7 | Testing | 2 weeks | Phases 1-6 |
| 8 | Marketplace | 1 week | Phase 7 |
| 9 | Advanced Features | 3 weeks | LSP Server Phases 8-10 |
| 10 | Polish | 2 weeks | Phases 1-9 |
| 11 | Localization | 2 weeks | Phase 1 |
| 12 | Future | Ongoing | All |

**Total: ~19 weeks to marketplace-ready release**

---

## Quality Checklist

Before each release:

### Functionality
- [ ] Server starts successfully on all platforms
- [ ] All commands work as expected
- [ ] Snippets expand correctly
- [ ] Syntax highlighting covers all constructs
- [ ] Error handling shows helpful messages

### Performance
- [ ] Extension activates in < 2 seconds
- [ ] No memory leaks over extended use
- [ ] Responsive during workspace indexing

### Documentation
- [ ] README covers all features
- [ ] CHANGELOG updated
- [ ] Settings documented
- [ ] Troubleshooting guide current

### Publishing
- [ ] Version bumped appropriately
- [ ] Icon and banner images included
- [ ] All tests passing
- [ ] VSIX builds without errors
