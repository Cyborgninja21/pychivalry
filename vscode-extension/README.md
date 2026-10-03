# CK3 Language Support

**Crusader Kings III script tooling that reports what the game itself would report.**

This extension checks CK3 mod scripts against the game's own vocabulary and error messages,
taken from the game executable rather than from wiki pages or scraped lists. Version 2.0.0
targets CK3 1.20.0.2.

## What it does

- **Diagnostics with the game's messages.** Parse errors, unknown triggers, effects,
  iterators and modifiers (judged by name and by whether you are in a trigger or an effect
  block), keywords removed in this game version with their replacement, fields a script
  directory does not have, the required fields the game enforces, scope chains such as
  `root.liege.primary_title` resolved link by link, and `scope:` names that are never saved.
  Each problem carries the message the game would write to `error.log`.
- **Per-database keywords.** Names the game builds from your database entries, such as
  `has_relation_friend` (from a scripted relation) or `add_diplomacy_lifestyle_xp` (from a
  lifestyle), are recognised.
- **Editing help.** Completion for triggers, effects, iterators, scope links, saved scopes
  and directory fields; hover and signature help with the game's own documentation strings;
  go to definition, references, document and workspace symbols, rename, call hierarchy,
  semantic highlighting, inlay hints, folding, formatting, code actions and code lenses.
- **Colours, typing, structure.** Colour swatches and the colour picker on colour values
  (`{ r g b }`, `rgb { }`, `hsv { }`, `hsv360 { }`, `hex { }`, named colours); indentation as
  you type (Enter, `}`, `=`) that matches the formatter; a **CK3 Explorer** view in the
  Explorer with the mod's events by namespace, decisions, interactions, scripted effects and
  triggers, script values, on-actions and localization keys, each opening its definition.
- **Mod-aware checks.** Event evaluation order, script values, variables, Paradox
  conventions, style and localization keys and text, plus the scripted triggers and effects
  of popular mods (Carnalitas) when the mod is found.
- **Game log watcher.** While you test in game, the extension can watch the game's
  `error.log` and show its lines as diagnostics on the files they name.

Supported files: CK3 script (`.txt`), `.gui`, `.gfx`, `.asset` and localization files
(`*_l_<language>.yml`).

## Install

In VS Code, open **Extensions**, choose **… → Install from VSIX…** and pick
`ck3-language-support-2.0.0.vsix`, or run:

```bash
code --install-extension ck3-language-support-2.0.0.vsix
```

Then open your mod folder. The language server is part of the extension; nothing else needs
to be installed. VS Code 1.75 or later is required, and the workspace must be trusted.

## Trait data (optional)

Trait names (`has_trait`, `add_trait`, `remove_trait`) are checked only when trait data is
present. The extension ships a copy extracted from CK3 1.20.0.2 (in its `dist/data/traits/`
folder). With it, an unknown trait is reported as `CK3800` with suggestions, and trait names
complete and show on hover. Delete the YAML files in that folder to turn the check off;
everything else works without them.

To refresh the data from your own game installation after a patch, use the extraction script
of the [pychivalry repository](https://github.com/Cyborgninja21/pychivalry):

```bash
npx ts-node tools/extract-traits.ts --game-path "/path/to/Crusader Kings III"
```

Extracted data is Paradox Interactive's content: keep it for personal use. The extension's
former data-extraction commands now only show a notice pointing to this script.

## Known gap: per-keyword scope validity

The extension checks scope **structure**: chains such as `root.liege.primary_title` are
resolved link by link, `scope:` names must be saved somewhere, and iterator prefixes must
match a list. It does **not** yet check whether a trigger or effect is valid in the scope it
is used in ("`is_landed` is not a valid trigger in a title scope"). That information comes
from the game's own `script_docs` output, which has not been captured for 1.20.0.2. Inlay
hints therefore show saved-scope names, not scope types.

## Settings

| Setting (`ck3LanguageServer.*`) | Default | Description |
| --- | --- | --- |
| `enable` | `true` | Enable the language server |
| `trace.server` | `off` | LSP trace (`messages`, `verbose`) |
| `logLevel` | `info` | Server log level |
| `formatting.enabled`, `formatting.insertSpaces`, `formatting.tabSize` | `true`, `false`, `4` | Document, range and on-type formatting (tabs, or `tabSize` spaces) |
| `formatting.onTypeEnabled` | `true` | Format as you type (`editor.formatOnType` is on for CK3 files) |
| `inlayHints.enabled` | `true` | Inlay hints |
| `logWatcher.enabled`, `logWatcher.autoStart`, `logWatcher.logPath` | `true`, `false`, auto | Game log watcher |

## Commands

Open the Command Palette (Ctrl+Shift+P, Cmd+Shift+P on macOS) and type **CK3** for the
commands: restart the language server, show its output, validate or rescan the workspace,
workspace statistics, generate an event template or localization stubs, find orphaned
localization, rename an event, and start, stop, pause or resume the game log watcher. The CK3
item in the status bar shows the server's state and opens a quick menu.

The complete list of diagnostics, with examples, is in the
[diagnostics reference](https://github.com/Cyborgninja21/pychivalry/blob/main/Documentation/user-guide/diagnostics/README.md).

## License

Apache License 2.0. Crusader Kings III is a trademark of Paradox Interactive AB; this
extension is not affiliated with Paradox.
