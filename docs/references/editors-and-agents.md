# Reference: VS Code, Claude Code and the Model Context Protocol

The facts about the editor and the AI harnesses that the design rests on. Each was checked
against the product's own documentation on 2026-11-21. These go stale faster than anything
about the game: check again before relying on one.

## VS Code

- **Chat participants are deprecated**, as of 2026-11-18, and the harness that hosted them is
  due to be removed in February 2027. pychivalry has no chat participant.
- **An extension can register a local agent server** (MCP) that VS Code's built-in AI then
  uses. Whether VS Code forwards it to its default harness as documented is open question 4 of
  MVP.md, settled in build step 7.
- **The floor** is the release where VS Code's own AI harness is the default: 1.146, unless
  build step 7 finds an earlier one.
- **The language client** is `vscode-languageclient` 11, started as a module over IPC, so it
  runs on VS Code's own runtime on Linux and Windows and the user needs no Node of their own.
- **Extension tests** use `@vscode/test-electron`, which drives a real VS Code. On a machine
  with a desktop they run under a virtual display so no window opens.

## Claude Code

- **Claude Code does not see agent servers registered through VS Code.** It reads its own
  configuration. The extension therefore has a command, "Set up for Claude Code", that
  registers the bundled server there, and keeps the registered location working when the
  extension updates.
- **Skills** are folders of instructions a harness loads on demand. pychivalry ships three:
  explain, fix, and write content. Whether one skills folder loads in both harnesses is part of
  open question 4.
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
