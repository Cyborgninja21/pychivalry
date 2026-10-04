# pychivalry

[![Node.js 22+](https://img.shields.io/badge/node.js-22+-339933.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC.svg)](vscode-extension/)

**Crusader Kings III script tooling that reports what the game itself would report.**

pychivalry checks CK3 mod scripts against the game's own vocabulary and error messages, taken
from the game executable rather than from wiki pages or scraped lists. It ships as a VS Code
extension (a language server with completion, hover, navigation, formatting, colour swatches,
a mod-structure view and diagnostics)
and as a command-line checker for whole mod folders. Version 2.3.0 targets CK3 1.20.0.2.

## How it is built

**The spec package.** Everything pychivalry knows about the CK3 language comes from one
generated file: the spec package (`ck3-spec-1.20.0.2.json`), produced by
[pdx-parser-re](https://github.com/Cyborgninja21/pdx-parser-re) from the game executable of a
given version (identified by its sha256). It holds the six keyword buckets (triggers,
effects, links, lists, on_actions and the modifier table, each with the engine's own
documentation string), the script directories and their per-directory field schema, the
game's error-message catalogue (1,968 messages) and the table of keywords retired between
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
server wires 20 providers (completions, hover, definitions and references, symbols,
semantic tokens, inlay hints, signature help, formatting and on-type formatting, folding,
rename, code actions, code lens, document links, document highlights, call hierarchy,
selection ranges, colours, the mod structure and diagnostics) to the engine: providers read the spec package, parser and index; diagnostics
run the engine pipeline followed by the extension's plug-ins, the surviving validators that
encode game behaviour the spec package does not describe (event evaluation order, script
values, variables, style, Paradox conventions, localization text). Since 2.2 a plug-in
diagnostic is an error or a warning only with engine evidence (a message of the game's error
catalogue: a missing localization key, an unknown trait, theme or background, a missing
graphics file …); everything else is a convention at information or hint severity, and a
check that needs the base game stays silent without it
([the evidence rule](Documentation/developer-guide/diagnostics-evidence.md)). The server
also watches the game's `error.log` while you test and maps its lines to the same
diagnostics.

**Optional game content** (`data/`). Data that is game content rather than script vocabulary
stays separate and optional: trait lists, game concepts and icons for localization
checks, portrait animations, and a registry of popular mods (Carnalitas) whose scripted
triggers and effects are layered over the spec package when the mod is found.

## Install

From a release VSIX: in VS Code, **Extensions → … → Install from VSIX…** and pick
`ck3-language-support-2.3.0.vsix`, or run
`code --install-extension ck3-language-support-2.3.0.vsix`.

From source (Node.js 22 and npm 10):

```bash
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry
npm ci                                   # installs the workspace (engine + extension)
npm run build                            # builds packages/engine
cd vscode-extension && npm run package   # webpack production build + vsce: ck3-language-support-2.3.0.vsix
code --install-extension ck3-language-support-2.3.0.vsix
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

Trait names (`has_trait`, `add_trait`, `remove_trait`, the `trait` of character history and
`create_character`) are checked (`CK3800`) against the base game's `common/traits` (traits and
their groups) when the base game is known, plus the workspace's traits and the trait data in
`data/traits/`, which also drives trait completion and hover. The repository carries a copy
extracted from the game; to refresh it from your own installation after a patch:

```bash
npx ts-node tools/extract-traits.ts --game-path "/path/to/Crusader Kings III"
```

(`ts-node` is not a dependency of the repository; `npx` fetches it.) Without the base game
`CK3800` does not run: the extracted data alone is not complete enough to prove a name
missing.
Extracted data is Paradox Interactive's content: keep it for personal use. The extension's
former extraction commands now only show a notice; the script above replaces them.

## Scope validity

pychivalry checks scope **structure** (chains such as `root.liege.primary_title` are resolved
link by link, `scope:` names must be saved somewhere, iterator prefixes must match a list) and,
since 2.1, whether a trigger, effect or link is valid in the scope it is used in, with the
game's own messages: `Wrong scope for trigger: landed_title, expected character`, `Wrong scope
for effect: …`, `Trying to use liege link on an invalid scope province`. The data is the game's
own documentation: the `script_docs` console command, run in CK3 1.20.0.2 with `-debug_mode`,
lists every trigger, effect and event target with the scopes it supports, and the spec package
carries it as `scope_validity` and `scope_types` (format 3); since 2.3 (format 4) it also says
which record fields the game evaluates in another scope than the record's root (a faction's
`can_character_join` runs on the character), measured on vanilla.

The engine infers the scope type of `root` (the directory's root scope, an event's
`scope = …`, an on_action's documented scope), `this`, `prev`, `scope:x` (from its one save
site) and each link of a chain, and judges a keyword only when every input is known. It
stays silent where it cannot know: scripted triggers and effects (they run in the caller's
scope), parameter blocks, keywords the game documents as `Supported Scopes: none`, and four
directories whose root scope the wiki-era data gets wrong (story cycles, factions, casus belli
types, buildings). On the 4,035 vanilla files it reports nothing. Inlay hints show the inferred
types: after each chain step, on iterators and on `save_scope_as`.

## Whole-mod diagnostics

The extension checks the whole mod, not only the open files:

- **Background validation.** After start-up every script (`.txt`) and localization file of the
  workspace is validated in the background, one file at a time so the editor stays
  responsive; the results appear in the Problems panel for unopened files too. A file changed
  on disk is re-validated; when a file is saved, the files that use what it defines (its
  scripted effects and triggers, events, saved scopes, script values …) are re-validated with
  it. A closed file keeps its last result until it is validated again. **CK3: Validate
  Workspace** runs a full pass now, with a cancellable progress notification, and reports the
  counts. GUI files (`.gui`, `.gfx`, `.asset`) are indexed but not validated.
- **Explorer decorations.** A file with errors or warnings shows the count of its worst
  severity as a badge (`9+` above nine) in the error or warning colour; folders take the
  colour of what is inside them.
- **Status bar.** Next to the server item: the workspace's error and warning totals
  (`$(error) 3 $(warning) 12`), a spinner with `done/total` while a pass runs, a tooltip with
  the information count, the files affected and the time of the last full pass. Clicking it
  opens the Problems panel. VS Code has no public API to set the Problems panel's filter, so it
  opens unfiltered; type `ck3` in its filter box to see only pychivalry's findings.
- **The base game.** Mods call the base game's scripted triggers, effects, lists and script
  values; without the game they are all reported as unknown. Set `ck3LanguageServer.gamePath`
  to the CK3 `game` directory (the one holding `common/`, `events/` and `history/`); when it
  is empty the Steam default locations are tried once (Windows `C:\Program Files
  (x86)\Steam\steamapps\common\Crusader Kings III\game`, Linux
  `~/.steam/steam/steamapps/common/Crusader Kings III/game` and
  `~/.local/share/Steam/steamapps/common/Crusader Kings III/game`, macOS
  `~/Library/Application Support/Steam/steamapps/common/Crusader Kings III/game`). Which one
  was used, and how long it took to read, is logged in the **CK3: Index** channel. The
  plug-ins also read the base game's English localization keys, event themes and
  backgrounds, portrait animations and traits from it; the checks that need them (`CK4100`
  missing localization key, `CK3430` theme, `CK3431` background, `CK3422` animation, `CK3800`
  trait, `SWITCH-003`, `CK3701`/`CK3702` variables across the mod) report nothing while no
  base game is known.

Big mods: above `backgroundValidation.fileLimit` files (3000 by default) only open files are
validated in the background, and a one-time message says so; run **CK3: Validate Workspace**
or raise the limit. Measured on five published mods, the largest (RICE, 1,313 script and 777
localization files) took about 21 s to its first full result at about 700 MB in 2.1; in 2.2,
which also reads the base game's localization keys, themes, backgrounds, animations and traits
for the plug-ins, it takes about 35 s at about 730 MB server peak on the same box, no single
file holding the server for more than 0.3 s
([corpus records](packages/engine/test/corpus/real-mods/README.md)).

## Editor features

- **Colour swatches and picker.** Colour values show a swatch; clicking it opens VS Code's
  colour picker, and the picked colour is written back in the notation the value was written
  in (then the alternatives the file kind uses, keeping alpha). Read: bare `{ r g b }` and
  `{ r g b a }` lists (0..1, or 0..255 when the values say so), `rgb { }`, `hsv { }`,
  `hsv360 { }`, `hex { rrggbb }` and named colours (`color1 = white`, from the base game's and
  the mod's `common/named_colors`). A bare list is a colour only under a colour key
  (`color`, `tintcolor`, `fontcolor`, `map_color` …); the notations, ranges and keys come from
  a scan of the base game and five published mods
  ([the evidence](Documentation/developer-guide/color-notations.md)). GUI files, which the
  engine parser does not fully accept, are read token by token.
- **On-type formatting.** Enter indents the new line to its block depth, a `}` typed first on
  a line lines up with the line that opened its block, and `=` after a key gets its spaces; a
  file typed this way is what **Format Document** makes of it. Indentation follows
  `formatting.insertSpaces`/`formatting.tabSize` (tabs by default); the extension turns
  `editor.formatOnType` on for CK3 files, and `formatting.onTypeEnabled` switches it off.
- **CK3 Explorer.** A view in the Explorer side bar with the mod's events by namespace (with
  their type), decisions, character interactions, scripted effects and triggers, script
  values, on-actions and localization keys per language, each with its count; clicking an
  item opens its definition. It reads the language server's index (no extra file reading),
  loads one level at a time and refreshes when files change, after a background pass and from
  its refresh button.

## Configuration

| Setting (`ck3LanguageServer.*`) | Default | Description |
| --- | --- | --- |
| `enable` | `true` | Enable the language server |
| `trace.server` | `off` | LSP trace (`messages`, `verbose`) |
| `logLevel` | `info` | Server log level |
| `formatting.enabled`, `formatting.insertSpaces`, `formatting.tabSize` | `true`, `false`, `4` | Document, range and on-type formatting (tabs, or `tabSize` spaces with `insertSpaces`) |
| `formatting.onTypeEnabled` | `true` | Format as you type (Enter, `}`, `=`); needs `editor.formatOnType`, on by default for CK3 files |
| `inlayHints.enabled` | `true` | Inlay hints |
| `logWatcher.enabled`, `logWatcher.autoStart`, `logWatcher.logPath` | `true`, `false`, auto | Game log watcher |
| `gamePath` | empty (Steam defaults) | The CK3 `game` directory used as the base game |
| `backgroundValidation.enabled` | `true` | Validate the whole workspace in the background |
| `backgroundValidation.concurrency` | `5` | Files read ahead at once (diagnosis is one file at a time) |
| `backgroundValidation.fileLimit` | `3000` | Above this many files only open files are validated unless forced |
| `graphics.enabled` | `true` | Report graphics files that exist in no mod and not in the base game (GFX001; needs the base game) |

Diagnostics are documented in the generated [diagnostics reference](Documentation/user-guide/diagnostics/README.md).

## Development

```bash
npm ci                 # once, at the repository root
task dev               # Dev Mode: engine tsc --watch + extension webpack --watch (dev:tests adds the unit tests)
task ci                # build, lint, format check, engine tests, diagnostics-docs check, unit tests
task test:integration  # VS Code integration tests (needs a display; use xvfb-run on Linux)
task test:vsix         # package the VSIX, install it into a clean VS Code, run the smoke suite
task dev:link          # use the development build in your own VS Code (dev:unlink removes it)
```

In VS Code, **🎯 Extension - Dev Mode** (F5) starts the Extension Development Host on top of
Dev Mode, and the language server listens for a debugger on port 6009 there. Every launch
configuration, debugging in your main VS Code and against an installed VSIX, and where each
log goes: [debugging.md](Documentation/developer-guide/debugging.md).

[CONTRIBUTING.md](CONTRIBUTING.md) has the workspace layout and the rules;
[CLAUDE.md](CLAUDE.md) is the short architecture brief; the
[architecture flow](Documentation/developer-guide/architecture/ARCHITECTURE_FLOW.md) and
[validation pipeline](Documentation/developer-guide/architecture/VALIDATION.md) go deeper.

## License

[Apache License 2.0](LICENSE). Crusader Kings III is a trademark of Paradox Interactive AB;
pychivalry is not affiliated with Paradox.
