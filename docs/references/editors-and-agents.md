# Reference: VS Code, Claude Code and the Model Context Protocol

The facts about the editor and the AI harnesses that the design rests on. Each was checked
against the product's own documentation on 2026-11-21. These go stale faster than anything
about the game: check again before relying on one.

## VS Code

- **Chat participants are deprecated**, as of 2026-11-18, and the harness that hosted them is
  due to be removed in February 2027. pychivalry has no chat participant.
- **An extension registers a local agent server** (MCP) with the contribution point
  `contributes.mcpServerDefinitionProviders` (an `id` and a `label`) and
  `vscode.lm.registerMcpServerDefinitionProvider(id, provider)` during activation; the provider
  returns `vscode.McpStdioServerDefinition(label, command, args, env, version)` with an optional
  `cwd`. VS Code calls the provider eagerly, so it must ask the user nothing. Its API says a
  Node server may use `process.execPath`, the editor's own runtime. Checked 2026-11-23 (below).
- **VS Code's default harness is the Copilot harness**, since 1.143; the older Local harness is
  deprecated in 1.146 and removed in February 2027. Eligible extension-provided definitions are
  forwarded to Copilot sessions; a definition that needs `${input:...}` or `${command:...}`
  variables is not. Build step 7 saw it happen (item 7.1): VS Code 1.146 and 1.147 write the
  extension's definition, command, arguments, variables and folder unchanged, into a plugin they
  sync to the Copilot harness's session at start, with no sign-in. 1.142, 1.143 and 1.145 start
  no such session in a fresh profile without a sign-in, so nothing could be seen there.
- **The floor is 1.146** (`engines.vscode` `^1.146.0`, `@types/vscode` 1.146.0): the lowest
  release on which the editor tests of item 7.1 (a) all pass. Whether a signed-in harness then
  calls the tools cannot be scripted; it is the by-hand check before a release.
- **The Copilot harness also reads a project's `.mcp.json`** (Claude Code's format) from the
  workspace folder and starts its servers: seen in the same tests.
- **The language client** is `vscode-languageclient` 11.0.1, started as a module over IPC, so
  it runs on VS Code's own runtime on Linux and Windows and the user needs no Node of their own:
  for `TransportKind.ipc` it forks the module with `ELECTRON_RUN_AS_NODE=1` and passes
  `--node-ipc` and `--clientProcessId=<pid>`. Checked 2026-11-23 (below).
- **The integrated terminal's environment** is extended with `context.environmentVariableCollection`
  (`prepend('PATH', '<folder><delimiter>')`), kept across sessions by default and applied to
  every terminal VS Code starts, an extension's own included; on Windows VS Code matches the
  variable's name in any letter case. The smoke test sees `pychivalry` found on that path on
  Linux and Windows.
- **Packaging** is `@vscode/vsce`'s `vsce package`: it writes a `.vsix` locally and needs no
  publishing token; `--no-dependencies` leaves dependency detection off; it renames `LICENSE` to
  `LICENSE.txt` and `README.md` to `readme.md` inside the file, and refuses `@types/vscode` newer
  than `engines.vscode`.
- **Extension tests** use `@vscode/test-electron`, which drives a real VS Code. On a machine
  with a desktop they run under a virtual display so no window opens.

## Claude Code

- **Claude Code does not see agent servers registered through VS Code.** It reads its own
  configuration. The extension therefore has a command, "Set up for Claude Code", that
  registers the bundled server there, and keeps the registered location working when the
  extension updates.
- **`claude mcp add [options] <name> -- <command> [args...]`** adds a local server; everything
  after `--` is passed to the server untouched; `--env KEY=value` takes several values, so
  another option must follow it before the name. Scopes: `local` (the default: this project
  only, private to the user, kept in `~/.claude.json` under the project's path), `project`
  (`.mcp.json` in the project's root, meant for version control; Claude Code asks once before
  using its servers in an interactive session) and `user` (every project). With
  `CLAUDE_CONFIG_DIR` set, the file is `$CLAUDE_CONFIG_DIR/.claude.json` (seen with 2.1.220).
  `claude mcp list` and `claude mcp get` connect to each server to report its health.
  An entry is `{type: "stdio", command, args, env}`. Checked 2026-11-23 (below).
- **Skills** are folders of instructions a harness loads on demand. pychivalry ships three:
  explain, fix, and write content. One skills folder serves both harnesses unchanged: what each
  reads, and from where, is [below](#skills-checked-for-build-step-9-2026-11-23).
- **Scored tests** are developer test scripts, never shipped and never run by CI. They start
  the Claude Code already installed on the developer's machine, signed in however the developer
  signed it in, once per trial as a separate test session in its command-line mode, confined to
  the server under test plus file read and edit, and give it no credentials. Claude Code has its
  own command-line option that ends a session early, `--max-budget-usd`; the scored test uses
  it only as a per-session limit, a safety stop, and pychivalry does no accounting of its own.
  Each test session counts against the developer's own Claude plan, like any session they open.
  The other flags are in item 6.8 of [PLAN.md](../PLAN.md). pychivalry holds no API key, token
  or login and makes no model call.
- **VS Code's built-in AI cannot be scripted.** It is checked by hand before a release against
  a written checklist.

## Checked for build step 7 (2026-11-23)

Read on 2026-11-23 for items 7.1, 7.2 and 7.8; every page fetched:

- VS Code, "MCP developer guide" (code.visualstudio.com/api/extension-guides/ai/mcp, updated
  2026-11-18): the contribution point, the registration function, the definition types,
  forwarding to Copilot sessions and its limits.
- VS Code, "MCP configuration reference" (code.visualstudio.com/docs/agents/reference/mcp-configuration,
  updated 2026-11-18): forwarding, `cwd` and `env`, the `dev` key, trust, autostart.
- VS Code, "Agent harnesses" (code.visualstudio.com/docs/agents/run/agent-harnesses) and "Move to
  the Copilot harness" (code.visualstudio.com/docs/agents/run/move-to-copilot), both updated
  2026-11-18; the release notes of 1.143 (the Copilot harness the default), 1.144, 1.145 and 1.146
  (released 2026-11-11: the Local harness deprecated); GitHub's changelog of 2026-11-16, "VS Code
  retires the Local harness in February 2027". None of them says in which release forwarding of
  extension-provided definitions began; the editor tests measured it.
- VS Code's API declarations, `@types/vscode` 1.146.0: `McpStdioServerDefinition`,
  `McpServerDefinitionProvider`, `lm.registerMcpServerDefinitionProvider`.
- Claude Code, "Connect Claude Code to tools via MCP" (code.claude.com/docs/en/mcp): `claude mcp
  add`, the scopes, `.mcp.json`, `add-json`, `list` and `get`; and `claude mcp --help` and `claude
  mcp add --help` of Claude Code 2.1.220.

## Checked for the rest of build step 7 (2026-11-23)

- VS Code, "Language Server Extension Guide"
  (code.visualstudio.com/api/language-extensions/language-server-extension-guide, updated
  2026-11-18): `serverOptions` with `run` and `debug` naming the module and `TransportKind.ipc`,
  `documentSelector` by scheme and language, `client.start()`, and `deactivate` disposing the
  client. The guide's example still depends on `vscode-languageclient` ^9.0.1; pychivalry pins
  11.0.1, the current release (2026-11-21) and the companion of the server's 11.0.1.
- `vscode-languageclient` 11.0.1 as installed: `lib/node/main.js` (how a module server is
  forked, its variables and arguments) and `lib/common/client.js` (a notification handler may be
  registered before the client starts).
- `@vscode/vsce` 4.1.1 (released 2026-11-12), `vsce package --help`: the options used.
- `actions/cache` v6.1.0 (released 2026-06-26), commit
  `55cc8345863c7cc4c66a329aec7e433d2d1c52a9`, for the downloaded VS Code in the editor-test job.

## Skills, checked for build step 9 (2026-11-23)

Read for items 9.1 and 9.3: each product's documentation, and the shipped code of the releases
the tests use, read as files; no harness was run for it, and no session started.

- **One form for both.** A skill is a folder holding `SKILL.md`: a YAML frontmatter between two
  `---` lines, then Markdown instructions. Both read `name` and `description`. VS Code: `name`
  is required, only lowercase letters, digits and hyphens, at most 64 characters, no hyphen at
  either end and none doubled, and the folder's own name, or the skill does not load;
  `description` is required, at most 1,024 characters. Claude Code: every field is optional,
  `name` defaults to the folder's name and may not hold `<`, `>` or control characters, the
  description and `when_to_use` together are cut at 1,536 characters in its listing and show
  `<` and `>` as entities, and fields it does not know are ignored. pychivalry's skills use
  `name` and `description` only, inside both sets of rules.
- **VS Code** (its page "Use Agent Skills in VS Code", updated 2026-11-18, and the workbench
  code of 1.147.0): an extension contributes skills with `contributes.chatSkills`, a list of
  `{ path }` entries, each the path of a `SKILL.md` relative to the extension's folder; the
  folder must have the skill's name. The setting `chat.useAgentSkills` (default on) governs
  them. The skills VS Code has are synced into the plugin it writes for the Copilot harness, each
  under `skills/<name>/` (the same plugin as the agent server's definition, item 7.1), and its
  internal command `_listExtensionPromptFiles` lists what extensions contribute. The Copilot
  harness reads a project's `.github/skills/` and `~/.copilot/skills/` itself; the deprecated
  Local harness also reads `.claude/skills/` and `~/.claude/skills/`.
- **Claude Code** (its page "Extend Claude with skills", read 2026-11-23, and the code of
  2.1.220): personal skills are in `~/.claude/skills/<name>/SKILL.md`, every project's; project
  skills in a project's `.claude/skills/`; plugins have their own. The configuration folder is
  `CLAUDE_CONFIG_DIR` when that is set, else `~/.claude`, normalised to Unicode NFC, and the
  personal skills are its `skills/`. Claude Code watches the folders and picks a change up
  without a restart. Before 2.1.280 a `manifest.json` in `~/.claude/skills/` made Claude Code move
  the skill folders it listed aside, so nothing but skill folders is written there.
- **What pychivalry does with it.** VS Code's AI reads the skills inside the installed
  extension; "Set up for Claude Code" copies them into Claude Code's personal skills, not into
  the mod's `.claude/skills/`, which a mod's author may share or upload with the mod.

## Claude Code's file tools, checked for build step 9's first run (2026-11-24)

Read in the shipped code of Claude Code 2.1.330, the native program inside the release of VS
Code's Claude Code extension that ran the first scored authoring run, as files; no session was
started for it.

- **`Write`** saves the text exactly as the model sends it (`savesTextAsSent`), in the encoding
  of the file it replaces (UTF-8 for a new one), and adds the byte-order mark only when the file
  it replaces started with one and the new text does not. A new file gets Windows line breaks
  only if the model sends carriage returns.
- **`Edit`** reads a file with its `\r\n` turned into `\n` and notes the line break the file
  mostly uses (its first 4,096 characters); it replaces the text and writes the file back with
  that line break and encoding, so an edit never changes a file's line breaks. An edit whose two
  strings are equal is refused: "No changes to make: old_string and new_string are exactly the
  same."
- What pychivalry does with it: the format is written by the agent server's `apply_format`, not
  by the AI's own file tools ([tools/scored-run/README.md](../../tools/scored-run/README.md#why-no-result-was-in-the-format)).

## The Model Context Protocol library

- The TypeScript library has two lines. The 2.x line, `@modelcontextprotocol/server`, is the
  current one (2.4.0 when checked). The 1.x line, `@modelcontextprotocol/sdk` (1.32.2 when
  checked), is in maintenance.
- pychivalry uses the 2.x line, pinned by build step 6 to **2.4.0**, the current release on
  2026-11-23 (published 2026-10-23). At run time it brings `@modelcontextprotocol/core` 2.4.0 and
  `zod` 4; its JSON Schema validator (ajv) is bundled inside the package. The client,
  `@modelcontextprotocol/client` 2.4.0, is a development dependency of the tests.
- Checked on 2026-11-23 against the library's own documentation (ts.sdk.modelcontextprotocol.io,
  version 2: "Tools", "Errors", "Serving over stdio") and its published type declarations:
  - A server is `new McpServer(serverInfo, { instructions })`, a tool
    `registerTool(name, { title, description, inputSchema, outputSchema, annotations, _meta },
    handler)`, and a server over standard input and output `serveStdio(() => server)` from
    `@modelcontextprotocol/server/stdio`, which replaces 1.x's `StdioServerTransport` with
    `server.connect`. It serves clients of the 2025 protocol revisions and of the 2026-07-28
    revision from the same server; the 2.4.0 client speaks the 2025 sequence unless asked.
  - Shapes are Standard Schema; `fromJsonSchema(schema, validator)` takes a plain JSON Schema
    and the validator to check it with, so a server needs no `zod` of its own.
  - Arguments that fail the input shape, and anything a handler throws, come back as a tool
    result marked `isError`, not as a protocol error; the result's text is the validator's
    message. The output shape is not checked on an error result.
  - A tool with an output shape returns `structuredContent`, and the same JSON as text for a
    client that reads only text.
  - Standard output carries only the protocol: anything else goes to standard error.

## Text and positions

Checked on 2026-11-21 against the language-server protocol specification, version 3.17, and
the WHATWG Encoding Standard (a living standard, last updated 2026-11-20). Used by build step 2
([encoding.md](../encoding.md)).

- **Positions count UTF-16 code units** unless client and server agree otherwise: "If the
  server omits the position encoding in its initialize result the encoding defaults to the
  string value `utf-16`."
- **Lines end at `\n`, `\r\n` and `\r`**, and a character past the end of a line "defaults
  back to the line length".
- **The UTF-8 decoder replaces each invalid sequence with one U+FFFD**: a lead byte with too
  few continuation bytes is one error, and the byte that broke the sequence is read again. The
  continuation bytes allowed after `E0`, `ED`, `F0` and `F4` are narrowed (`A0`-`BF`,
  `80`-`9F`, `90`-`BF`, `80`-`8F`). This is the decoder built into Node and browsers
  (`TextDecoder`).
- **Windows-1252** is the encoding the labels `windows-1252`, `latin1` and `iso-8859-1` all
  name; 0x80 decodes to `€`. The core's own decoder agrees with Node's for all 256 bytes, which
  a test checks.

## Cache folders

Checked on 2026-11-21. Used by build step 3 for the index cache
(`packages/core/src/index/cache.ts`).

- **Linux: the XDG Base Directory Specification**, version 0.8 (8 May 2021): "$XDG_CACHE_HOME
  defines the base directory relative to which user-specific non-essential data files should
  be stored", and "If $XDG_CACHE_HOME is either not set or empty, a default equal to
  $HOME/.cache should be used." Its paths "must be absolute"; a relative one is to be treated
  as invalid and ignored. The index cache is `$XDG_CACHE_HOME/pychivalry/index`, by default
  `~/.cache/pychivalry/index`.
- **Windows: the known folder `FOLDERID_LocalAppData`**, whose default path is
  `%LOCALAPPDATA%` (`%USERPROFILE%\AppData\Local`), the folder for a user's data that does not
  roam with the profile (Microsoft's KNOWNFOLDERID reference). The index cache is
  `%LOCALAPPDATA%\pychivalry\Cache\index`.

## GitHub

- **Self-hosted runners are advised against on public repositories**, because a pull request
  from a fork could run code on the machine. This is why no runner is attached and the suites
  that need game files run as a local task that commits its records.
- **A wiki's git repository** exists only once a first page has been saved in the web
  interface. After that it is an ordinary repository; this one's wiki is generated from
  `docs/` ([wiki/README.md](../wiki/README.md)).
