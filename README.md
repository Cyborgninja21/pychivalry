# pychivalry

[![Node.js 22+](https://img.shields.io/badge/node.js-22+-339933.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](vscode-extension/)

**Crusader Kings III script tooling that reports what the game itself would report.**

pychivalry checks CK3 mod scripts against the game's own vocabulary and error messages, taken
from the game executable rather than from wiki pages or scraped lists. It ships as a VS Code
extension (a language server with completion, hover, navigation, formatting and diagnostics)
and as a command-line checker for whole mod folders. Version 2.0.0 targets CK3 1.20.0.2.

## How it is built

**The spec package.** Everything pychivalry knows about the CK3 language comes from one
generated file: the spec package (`ck3-spec-1.20.0.2.json`), produced by
[pdx-parser-re](https://github.com/Cyborgninja21/pdx-parser-re) from the game executable of a
given version (identified by its sha256). It holds the six keyword buckets (triggers,
effects, links, lists, on_actions and the modifier table, each with the engine's own
documentation string), the script directories and their per-directory field schema, the
game's error-message catalogue (1,967 messages) and the table of keywords retired between
versions. The engine bundles a checksum-verified copy; nothing else in the repository holds
CK3 vocabulary. See [the spec package](Documentation/developer-guide/spec-package.md).

**The engine core** (`packages/engine`, npm name `pychivalry-engine`). A dependency-free
TypeScript package that turns a mod directory into diagnostics. It parses CK3 script
(including dates, `@name` constants, `@[ … ]` arithmetic, scope chains and the UTF-8 BOM),
indexes the workspace (events, scripted effects and triggers, scripted lists, script values,
saved scopes, the call graph) and runs four checks in order: parse errors with the game's
message text, the registry check (unknown triggers, effects, iterators and modifiers judged by
name and context, retired keywords with their replacement), the schema check (fields a
directory does not have, the few required fields the engine enforces) and the scope check
(scope chains walked link by link, undefined saved scopes). Diagnostic ids and texts are the
catalogue's, so a problem in the editor reads like the line `error.log` would show.

**The VS Code extension** (`vscode-extension`). A thin client and a language server. The
server wires 17 LSP providers (completions, hover, definitions and references, symbols,
semantic tokens, inlay hints, signature help, formatting, folding, rename, code actions,
code lens, document links, document highlights, call hierarchy, selection ranges and
diagnostics) to the engine: providers read the spec package, parser and index; diagnostics
run the engine pipeline followed by the extension's plug-ins, the surviving validators that
encode game behaviour the spec package does not describe (event evaluation order, script
values, variables, style, Paradox conventions, localization text). The server also watches
the game's `error.log` while you test and maps its lines to the same diagnostics.

**Optional game content** (`data/`). Data that is game content rather than script vocabulary
stays separate and optional: trait lists, game concepts and icons for localization
checks, portrait animations, and a registry of popular mods (Carnalitas) whose scripted
triggers and effects are layered over the spec package when the mod is found.

## Install

From a release VSIX: in VS Code, **Extensions → … → Install from VSIX…** and pick
`ck3-language-support-2.0.0.vsix`, or run
`code --install-extension ck3-language-support-2.0.0.vsix`.

From source (Node.js 22 and npm 10):

```bash
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry
npm ci                                   # installs the workspace (engine + extension)
npm run build                            # builds packages/engine
cd vscode-extension && npm run package   # webpack production build + vsce: ck3-language-support-2.0.0.vsix
code --install-extension ck3-language-support-2.0.0.vsix
```

To try it without packaging, open the repository in VS Code and press **F5** (Extension
Development Host), then open a mod folder such as `example mod/`.

## The command-line checker

The engine has its own CLI; it needs no VS Code:

```bash
npx pychivalry-engine check "path/to/my mod"                       # human-readable, grouped by file
npx pychivalry-engine check "path/to/my mod" --json                # one JSON diagnostic per line
npx pychivalry-engine check "path/to/my mod" --vanilla "path/to/Crusader Kings III/game"
npx pychivalry-engine check "path/to/my mod" --spec ck3-spec-<version>.json
```

`--vanilla` indexes the base game's scripted effects, triggers, lists, modifiers, script
values and on_actions, so a mod's calls into them resolve, and enables the undefined-saved-
scope check. `--spec` checks against another spec package. The exit code is 1 when an error
was reported, 2 on a usage error. Run it from the repository after `npm ci && npm run build`
(the `pychivalry-engine` binary is linked into `node_modules/.bin`).

## Trait data (optional)

Trait names (`has_trait`, `add_trait`, `remove_trait`) are checked only when trait data is
present in `data/traits/`. The repository carries a copy extracted from the game; to refresh
it from your own installation after a patch:

```bash
npx ts-node tools/extract-traits.ts --game-path "/path/to/Crusader Kings III"
```

(`ts-node` is not a dependency of the repository; `npx` fetches it.) With the data present,
unknown traits get `CK3800` with suggestions, and trait names complete and hover. Delete the
YAML files in `data/traits/` to turn the check off; everything else works without them.
Extracted data is Paradox Interactive's content: keep it for personal use. The extension's
former extraction commands now only show a notice; the script above replaces them.

## Known gap: per-keyword scope validity

pychivalry checks scope **structure**: chains such as `root.liege.primary_title` are resolved
link by link, `scope:` names must be saved somewhere, iterator prefixes must match a list.
It does **not** yet check whether a trigger or effect is valid in the scope it is used in
("`is_landed` is not a valid trigger in a title scope"). That information is not in the
game executable's tables; it comes from the game's own `script_docs` output, which has not
been captured for 1.20.0.2. The spec package has the slot (`scope_validity`, empty today),
so a future package fills it without a code change. Inlay hints therefore show saved-scope
names, not scope types.

## Configuration

| Setting (`ck3LanguageServer.*`) | Default | Description |
| --- | --- | --- |
| `enable` | `true` | Enable the language server |
| `trace.server` | `off` | LSP trace (`messages`, `verbose`) |
| `logLevel` | `info` | Server log level |
| `formatting.enabled`, `formatting.insertSpaces`, `formatting.tabSize` | `true`, `false`, `4` | Formatter |
| `inlayHints.enabled` | `true` | Inlay hints |
| `logWatcher.enabled`, `logWatcher.autoStart`, `logWatcher.logPath` | `true`, `false`, auto | Game log watcher |

Diagnostics are documented in the generated [diagnostics reference](Documentation/user-guide/diagnostics/README.md).

## Development

```bash
npm ci                 # once, at the repository root
task ci                # build, lint, format check, engine tests, diagnostics-docs check, unit tests
task test:integration  # VS Code integration tests (needs a display; use xvfb-run on Linux)
```

[CONTRIBUTING.md](CONTRIBUTING.md) has the workspace layout and the rules;
[CLAUDE.md](CLAUDE.md) is the short architecture brief; the
[architecture flow](Documentation/developer-guide/architecture/ARCHITECTURE_FLOW.md) and
[validation pipeline](Documentation/developer-guide/architecture/VALIDATION.md) go deeper.

## License

[Apache License 2.0](LICENSE). Crusader Kings III is a trademark of Paradox Interactive AB;
pychivalry is not affiliated with Paradox.
