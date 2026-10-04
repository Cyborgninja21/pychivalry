# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.3.0] - 2026-10-03

Editor features, and developing pychivalry made fast and documented. Headlines:

- **Colour swatches and picker, on-type formatting and the CK3 Explorer view** (#79, #80,
  #83; post-2.0 Phase 5).
- **The spec package knows where record fields run** (format 4, pdx-parser-re): story cycles
  run in the `story` scope, and 24 record fields the game evaluates in another scope than their
  record (a faction's `can_character_join` on the character, a casus belli's `on_victory` on
  the casus belli, a building's `cost` on the builder …) carry that scope, measured on the base
  game. The engine's exception tables (four directories, three interaction pickers) are down
  to one picker, kept with the reason; the scope check now judges 93,665 keyword uses in the
  base game (2.2: 91,580) with 0 findings.
- **EVENT-016 is a warning**: the game's namespace warning is now in the spec package's error
  catalogue.
- **Developer experience** (#35, #36, #38, #39, #59; post-2.0 Phase 6): Dev Mode, the
  development build in your own VS Code, a smoke suite on the shipped VSIX in CI on three
  hosts, a debugging guide whose every launch configuration is checked by a task.

### Added

- **Colour swatches and a colour picker** (#79) on CK3 colour values in `.gui`, `.gfx`,
  `.asset` and script files. The notations, their ranges and the keys a bare list is a colour
  under come from a scan of the CK3 1.20 base game and the real-mod corpus
  ([color-notations.md](Documentation/developer-guide/color-notations.md),
  `tools/color-scan.js`): bare `{ r g b }` / `{ r g b a }` lists, 0..1 or 0..255 by their own
  values (a byte list's alpha is 0..1), `rgb { }` (0..255), `hsv { }` (0..1), `hsv360 { }`
  (degrees and percentages), `hex { rrggbb }`, and names of `common/named_colors` colours
  (`color1 = white`, resolved against the base game and the workspace). Hex strings occur
  zero times and are not read; values outside the ranges (overbright lists, HSV light
  intensities above 1) get no swatch. Bare lists and names count under 25 colour keys derived
  from the scan (`server/data/color-keys.json`; the DNA palette keys `hair_color`, `eye_color`,
  `skin_color` are not colours). The picker writes the value back in its own notation and
  spelling first, then the alternatives the file kind uses, keeping alpha. GUI files the engine
  parser reports errors on are read from the lexer's tokens; on the base game's `gui/` that
  path finds 447 values in 327 files and the tree path 44 in 89, and the two agree on every
  file that parses.
- **On-type formatting** (#80): Enter indents the new line to its block depth (one level
  deeper after `{`), a `}` typed first on a line takes the indentation of the line that opened
  its block, and `=` after a key is padded (`key = value`), as the formatter writes it. Strings,
  comments and `@[ ]` expressions are never edited; when the depth cannot be determined there
  is no edit. A file typed this way is what the formatter makes of it (unit-tested on four
  fixtures with tabs and with spaces). New setting `ck3LanguageServer.formatting.onTypeEnabled`
  (default `true`); the extension turns `editor.formatOnType` on for CK3 files.
- **CK3 Explorer view** (#83) in the Explorer: the mod's events by namespace (with their
  type), decisions, character interactions, scripted effects and triggers, script values,
  on-actions and localization keys per language, each category with its count, empty ones
  hidden. Built from the server's `ck3/modStructure` request on the engine index (no file walk,
  no parsing), one level at a time; clicking an item opens its definition
  (`CK3: Reveal Definition`); the view refreshes when the index changes, when a background
  pass ends and from its title-bar button (`CK3: Refresh CK3 Explorer`).
- Engine: `LocalizationIndex.files()` (each indexed localization file with its language and
  key count) and `localizationLanguageOf()`.
- Integration tests for the three features in the Extension Development Host, and a smoke
  test per real-mod corpus mod recorded under `features` in
  `packages/engine/test/corpus/real-mods/<slug>.counts.json` (colours in a GUI file, an Enter
  typed and indented, the CK3 Explorer's counts, request times and one reveal); on RICE the
  top-level structure request answered in 6 ms and the whole tree (5,100 nodes) in 126 ms.

- **Dev Mode** (#36): `task dev` and the VS Code task and launch configuration **Dev Mode**
  run the engine in `tsc --watch` and both webpack bundles in `--watch`, so an engine edit
  reaches the language server bundle without another step; `task dev:tests` adds the unit
  tests in watch mode. Problem matchers report TypeScript errors of the engine and of the
  bundles and failing unit tests, and tell the launch when both bundles have finished.
  Issue #36's Python parts are gone with 2.0.0 (the server is TypeScript, bundled in the same
  watch).
- **`task dev:link` / `task dev:unlink`** (#35): the development build in your own VS Code,
  stable or Insiders, local or on the remote server (WSL, SSH), by a link from the extensions
  folder; refuses where the Marketplace or a VSIX copy is installed; registers the link in the
  folder's `extensions.json`, which VS Code reads instead of scanning once the file exists.
- **VSIX smoke suite** (#39): `task test:vsix` packages the extension, installs the VSIX into
  a clean VS Code with `--install-extension` and asserts on `example mod/` that the installed
  copy activates at the package version, that a known-bad file gets the engine's error, that a
  hover answers and that the CK3 Explorer has data; `task test:dev-link` runs the same tests on
  the linked development build. CI job `vsix-smoke` runs both on Linux, Windows and macOS after
  the build and uploads the VSIX. It replaces the by-hand VSIX check of the release cuts.
- **Debugging guide** (#38): [debugging.md](Documentation/developer-guide/debugging.md), every
  launch configuration (the Extension Development Host, the language server's inspector on
  port 6009 and its attach, the main instance and an installed VSIX, the engine and extension
  tests, both corpus suites), where each log goes, the WSL and VS Code terminal traps.
  `task dev:launch-check` starts every configuration once outside VS Code and attaches like a
  debugger. The language server starts with an inspector when the extension host runs under a
  debugger (`CK3_SERVER_INSPECT_PORT` overrides 6009).
- **CK3: Index** (#59): an integration test proves the channel receives the server's indexing
  messages on start-up and on **CK3: Rescan Workspace**; it was never broken on the TypeScript
  server (the issue's race was the Python server's). The extension's API returns the recent
  lines of its output channels (`logs.lines(category)`) for tests.

### Changed

- **Spec package format 4** (sha256 `a9959bf9…`): record fields carry `scope` where the game
  evaluates them in another scope than the record's root; `common/story_cycles` has the root
  `story`; one wiki-era field the real-mod corpus sets (`months` in opinion modifiers) is a
  field with `provenance: corpus`, the other 251 stay documented as possibly unused (nothing is
  removed from the spec); the error catalogue has 1,968 messages (the event-namespace warning
  added). The measurements ran on the local base game, which Steam updated to 1.20.0.3 on
  2026-10-03; the package still describes 1.20.0.2. The engine accepts format 4 only. In the scope check, a block inside a keyword's
  parameter block (a callback such as `ai_start_best_war`'s `is_valid`, which the game runs
  with scopes of its own) has its root unknown.
- **EVENT-016** (an event whose namespace its file does not declare) is a warning, with the
  game's message; it was a convention at information while the catalogue lacked the message.
- Document and range formatting read `ck3LanguageServer.formatting.insertSpaces`,
  `formatting.tabSize` and `formatting.enabled` (declared but not read before: the editor's
  own indentation settings were used), so that document, range and on-type formatting always
  agree. The default stays tabs, the Paradox convention.

### Fixed

- `.vscode/launch.json`: the unit-test configurations pointed at
  `vscode-extension/node_modules/mocha` (the workspace hoists it to the root) and at test files
  that moved to the engine in 2.0; "Current File" passed the `.ts` file to mocha; the watch
  launch used a `tsc` problem matcher on webpack output and never reported ready.
- `npm run test:watch` ran the integration suite outside VS Code; it runs the unit tests.
- The "good" story-cycle fixtures ran character effects in the story's own scope, which the
  game reports; they go through `story_owner`.
- `corpus-acceptance.js` dropped the `features` record when it rewrote a corpus record.
- The temporary "[Index notification received]" copies in **CK3: Server** are removed.

## [2.2.0] - 2026-10-03

Diagnostics you can trust, and the validation rules the backlog asked for. Headlines:

- **Every plug-in error and warning is backed by the game** (post-2.0 Phase 4). A plug-in
  diagnostic is an error or a warning only with engine evidence: a message of the game's error
  catalogue, a required schema field, an oracle entry or a reproduced in-game error. Without it
  the check is a convention at information (semantic advice) or hint (style), says so in its
  message, and is listed with its reason; checks that need the base game stay silent without
  it. The catalogue carries the evidence of every code and the docs generator refuses a
  convention at error or warning. The audit of every 2.1 code:
  [diagnostics-evidence.md](Documentation/developer-guide/diagnostics-evidence.md).
- **On five published mods the Problems panel now shows only real defects at error severity**:
  0 / 0 / 15 / 92 / 1 errors (balance-of-power-ui, divine-intervention, elf-destiny, rice,
  viet-events), the engine path's list, against 0 / 8 / 338 / 438 / 12 in 2.1; warnings went
  from 115,553 to 1,594 (the engine's schema check, 1,582, and 12 evidence-backed plug-in
  findings).
- **The graphics-file check (GFX001)** (Phase 3, PR #56 rebuilt).
- **New rules** for ai_chance, after blocks, events, portraits, backgrounds and scope timing
  (#19, #21-#23, #25, #27, #28, #60), and **quick fixes** for the most frequent codes (#85).

### Added

- **Graphics-file check (GFX001)**, rebuilt from PR #56 as an extension plug-in (`graphics`): a
  `.dds`, `.png` or `.tga` path under `icon`, `texture`, `sprite`, `background`,
  `portrait_texture`, `reference`, `activity_window_background`, `background_texture` or
  `icon_texture` that exists in no workspace mod, not in the base game's `game/` and not in any
  `game/dlc/<dlc>/` folder is a warning, once per path and file. Case-insensitive on every
  platform, with a directory cache the file watcher invalidates; silent while no base game is
  known. Setting `ck3LanguageServer.graphics.enabled` (default `true`).
- **ai_chance totals** (#21, #22, #23): `CK3611` an ai_chance total that is zero whatever
  applies (base 0 and no modifier that adds weight, or an unconditional `factor = 0`) and
  `CK3612` a total that can be negative (base plus every negative `add` below zero), both
  information; `CK3613` an option of a non-hidden event with several options without
  `ai_chance` or `ai_will_select`, a hint.
- **after blocks** (#19): the after checks run on every event (`CK3520` after in a hidden
  event, `CK3521` after in an event without options, information) and `CK3522` an after block
  that only cleans up (hint). A trigger inside `after` (the issue's CK3523) is reported by the
  engine's registry with the game's message (`unknown_effect_X`), so it is no plug-in code.
- **Events** (#25, #27, #28): `CK3765` a non-hidden event without title (information;
  CONV-002 merged into it); `CK3423`/`CK3424` a portrait `triggered_animation` without
  trigger / without animation, `CK3425` a `triggered_outfit` without trigger, `CK3426` a
  portrait position given twice (information); `CK3431` an `override_background` reference
  defined neither in the workspace's nor in the base game's `common/event_backgrounds`
  (warning, silent without the base game) and `CK3433` an override equal to the theme's own
  background (information). Not implemented, with the reason: CK3432 (`override_environment`
  is no event field; the engine's schema check reports it), CK3434 (`override_icon`
  references are paths, checked by GFX001), CK3435 (`override_sound`: nothing to check
  against).
- **Scope timing** (#60): `CK3560`/`CK3561`, a desc / title localization text that reads a
  saved scope the event saves only in an option or in `after` (after the window is shown);
  `CK3563`, the trigger guard: a scope saved from a `random_` iterator in `immediate` and used
  by an option, with no `any_` check of the same list in `trigger`. All information. The
  evaluation order is corrected (#95): the window (title, desc and its `triggered_desc`
  triggers) is evaluated after `immediate`.
- **Quick fixes for the most frequent plug-in codes** (#85), measured on the regenerated
  real-mod corpus records: trailing whitespace (`CK3304`), mixed indentation to tabs
  (`CK3301`, with `CK3303`), remove an empty block (`CK3314`), add `ai_chance = { base = 100 }`
  (`CK3613`). `CK3317` (nesting), `CK3316` (line length), `CK3875` and `CK3977` (iterators
  without limit) have no mechanical fix. The localization-stub fix now passes the key, not the
  whole `field = key` text.

### Changed: severities (the evidence audit)

Of the 76 codes that were errors or warnings in 2.1, one stays an error, eight stay warnings,
46 become information or hints and 21 are removed or merged (table per code, with corpus counts
before and after, in diagnostics-evidence.md):

| 2.1 severity | Now error | Now warning | Now information | Now hint | Removed or merged |
| --- | ---: | ---: | ---: | ---: | ---: |
| error | 1 | 0 | 14 | 1 | 6 |
| warning | 0 | 8 | 28 | 3 | 15 |

- Kept, with the catalogue message that backs them: `VALUE-002` (error), `CK4100`, `CK4101`,
  `CK4102` (the script-file `LOC-001`/`LOC-002`), `CK3430`, `CK3800`, `SWITCH-003`, `GFX001`,
  `LOC-005` (warnings); `CK3431` is new at warning.
- Style codes (`CK3301`, `CK3303`, `CK3304`, `CK3306`, `CK3314`, `CK3316`, `CK3317`) are
  hints; every other plug-in code is information or a hint with a `Convention:` message.
- The plug-ins read the base game: its English localization keys (`CK4100`), event themes and
  backgrounds (`CK3430`, `CK3431`, `CK3433`), portrait animations (`CK3422`), traits and trait
  groups (`CK3800`) and scripted triggers (`SWITCH-003`); `CK3701`/`CK3702` judge variables across the workspace and the base
  game (the engine Indexer's new variable uses). The localization index reads `key: "text"`
  entries without a version number (135,037 in the base game's English files) and entries
  with a trailing comment.
- The event checks of paradox-checks run on every event (they saw only the file root); the
  events plug-in reports per code severity on `events/` files and accepts namespaces with
  capitals and digits.

### Fixed: false positives found on the real-mod corpus

- `CK5142` removed: `liege = root`, `employer = scope:x` is the ordinary comparison form
  (#91).
- `CK3873` (`trigger = { always = no }`) is a hint, not an error (#92).
- `CK3950`/`CK3951` removed: they reported colour values `rgb { }`/`hsv { }` and never a real
  call; undefined scripted effects and triggers are the engine registry's (#93).
- `CK3420` removed: every key ending in `_portrait` was checked; an unknown event field is the
  engine schema check's `unknown_X_in_X` (#94).
- `CK3552`/`CK3551` follow the corrected evaluation order: a scope saved in `immediate` is
  available to the desc (#95).
- `CK3550` accepts a scope saved earlier in the same trigger (#96).
- `CK3553` reports local variables only: ordinary variables persist across firings (#97).
- `CK4100` reads only real localization fields (not gene names, script-value breakdown labels
  or trigger_localization keys) and the base game's keys: 7,622 corpus findings to 3.
- `CK3430` and `EVENT-003` (one code now) read the workspace's and the base game's themes
  instead of 32 hard-coded names: 2,880 corpus findings to 0.
- `CK3800` knows trait groups (`has_trait = lunatic`) and no longer reads culture traditions as
  traits: 155 to 6.
- `CK3422` (unknown portrait animation) never reported: the animation set was read as an
  object. It now judges against the workspace's and the base game's
  `gfx/portraits/portrait_animations` (information, silent without the base game), and the
  data loader reads `data/animations.yaml` as the mapping it is (animation completion and
  hover get its 251 names instead of an 18-name fallback).
- The 1,000-diagnostics-per-file cap kept the first 1,000 by position whatever their severity,
  so an error at the end of a long file full of style hints was never published. A file over
  the cap now keeps errors first, then warnings, information and hints (by position within a
  severity) and publishes them in position order; script and localization files alike. The
  corpus suite now compares the editor's errors with the engine's in capped files too. On the
  corpus no error was hidden; in the capped files 2,112 hints give way to 2,111 information
  findings and one engine warning (Elf Destiny).
- One test per catalogue code (`catalogue-severities.test.ts`): every plug-in code is triggered
  and checked against its catalogue severity and its "Convention" wording.

### Changed: renamed, merged and removed codes

- `LOC-001` and `LOC-002` are split: in script files they are now `CK4101` (a localization
  field holds literal text) and `CK4102` (a `custom_tooltip` holds literal text), both
  warnings with the localization-stub quick fix; `LOC-001` (a key the localization index
  cannot read, with a rename-the-key quick fix) and `LOC-002` (an unknown character function)
  are the `.yml` codes only, both information.
- `CONV-002` is renamed `CK3765` (issue #25; every non-hidden event, not only those with
  options).
- `CK3611` and `CK3612` change meaning. The 2.1 `CK3611` ("ai_chance base above 100 is
  clamped to 100") is removed: it is false, ai_chance is a relative weight (the base game
  writes 640 bases above 100). The 2.1 `CK3612` ("ai_chance base = 0, the AI never selects the
  option") is merged into the new `CK3611`: a base of 0 is never picked only when no modifier
  adds weight (333 of the base game's 1,288 `base = 0` blocks have one).

- Merged into the code that reports the same thing: `CONV-003` into `CK3764`, `CONV-004` and
  `EVENT-007` into `CK3450`, `EVENT-003` into `CK3430`, `EVENT-004` into `CK3422`, `EVENT-009`
  into `EVENT-016`, `EVENT-011`/`EVENT-012`/`EVENT-013` into `CK3762`/`CK3520`/`CK3763`,
  `CK3761` into `EVENT-001`; `CK3340` and `CK3341` into the engine's scope and registry checks.
- Removed: `CK3760` and `CONV-001` (`type` is optional, game/events/_events.info),
  `EVENT-005` and `EVENT-006` (never reported), `VALUE-001` and `VALUE-003` (hand-made name
  lists; the engine registry judges keys against the spec package), and the ones above.

## [2.1.0] - 2026-10-02

Whole-mod diagnostics in the editor, and scope validity from the game itself. Headlines:

- **Background validation of the whole mod** (#86), **Explorer file decorations** (#87) and a
  **status-bar health summary** (#84); the base game (`ck3LanguageServer.gamePath`) is read
  so vanilla definitions are known.
- **Spec package format 3**: per-keyword scope validity and the full list of 72 scope types,
  imported from the game's own `script_docs` output (CK3 1.20.0.2, vanilla, run 2026-10-02).
- **New scope check** with the game's messages: `Wrong scope for trigger: %s, expected %s`,
  `Wrong scope for effect: %s, expected %s`, `Trying to use %s link on an invalid scope %s`.
  Zero findings on the 4,035 vanilla files.
- **Typed inlay hints**: the scope type after each chain step, on iterators and on
  `save_scope_as`.
- Fixes for #90 (a mod folder named like a script directory) and a localization-suggestion
  stall.

### Scope validity (spec package format 3)

#### Added

- **Spec package format 3** (pdx-parser-re): `scope_validity` is filled from the game's own
  documentation, the `script_docs` console command run in CK3 1.20.0.2 with `-debug_mode`
  (vanilla plus the owned DLCs, no mods; logs and provenance in pdx-parser-re
  `research/oracle/1.20.0.2/`): per trigger (1,935), effect (2,127), event target / link (311
  names, 327 forms), list (377) and on_action (930) the supported scopes, supported targets
  and the game's description; the new top-level `scope_types` lists the 72 scope types the
  game names, with the links that produce each, the lists that iterate it and the on_actions
  that expect it. `Supported Scopes: none` means the keyword declares no scope requirement.
  The same logs checked every derived keyword bucket (0 unexplained differences); the
  package gains the 14 engine on_actions without an `on_` prefix (`yearly_playable_pulse`,
  `three_year_pool_pulse`, …: on_actions 203 → 217), the lower-case
  `situation_top_phase_days_until_end_date`, and 15 modifier templates the game documents
  (`$VASSAL_STANCE$_ai_boldness`, `$GOVERNMENT_TYPE$_herd_contribution_add`, …: 79 → 94).
  Package sha256 `129f67f6acb2292f10ca9e45cb2720831e447601027f54e0a7be680c79c08cbb`.
- **Scope-type inference** (engine `resolveScopes`, `check/scope-types.ts`): the type of
  `root` (the directory's root scope, an event's `scope = …`, an on_action's documented
  expected scope), `this`, `prev`, `scope:x` (the type at its only save site in the record)
  and each step of a chain, from the game's link input/output scopes and list element types.
  Unknown stays unknown: scripted triggers and effects, parameter blocks and anything the
  package does not document are never judged. Four directories whose wiki-era root scope
  vanilla contradicts (story cycles, factions, casus belli types, buildings) and the
  interaction pickers (`can_be_picked*`) have an unknown root.
- **Scope check** (`check/scope.ts`, severity error, the game's catalogue texts):
  `wrong_scope_for_trigger_X_expected_X` and `wrong_scope_for_effect_X_expected_X` for a
  trigger or effect (iterators included) used where the current scope type is not among its
  supported scopes, `trying_to_use_X_link_on_an_invalid_scope_X` for a link or chain step
  whose input scopes do not include the current type. Vanilla 1.20.0.2: 0 findings over
  91,576 judged keyword uses and 17,834 judged link steps; the five corpus mods: 0 new
  findings.
- **Typed inlay hints**: with `inlayHints.showChainTypes` the type after each step of a scope
  chain, with `showIteratorTypes` an iterator's element type, with `showScopeTypes` the type
  a `save_scope_as` saves; the settings (and `inlayHints.enabled`) are now read by the
  server.
- `Spec` accessors: `scopeValidity(name, bucket)`, `onActionScope`, `linkForms`,
  `listElementType`, `scopeTypes`, `isScopeType`, `scopeType`.

#### Changed

- The engine accepts only package format 3 (format 2 is rejected).
- The good-decision fixtures (`example mod/07_decisions`, `test space`, the mock mod) used
  `development_level` and `change_development_level` on `capital_province`; both are county
  (landed_title) keywords, now `capital_county`.

### Whole-mod diagnostics in the editor

#### Added

- **The base game** (`ck3LanguageServer.gamePath`, machine-overridable): the server checks the
  mod against the CK3 `game` directory, so the vanilla scripted triggers, effects, lists,
  modifiers and script values a mod calls are known. When the setting is empty the Steam
  default locations are tried once; an invalid path is logged and the server runs without a
  base game. The base game is read asynchronously after indexing and its duration logged.
  Engine: `Workspace.useVanilla(root)`.
- **Background validation** (#86): every script and localization file is validated after
  start-up and published as ordinary diagnostics, so unopened files appear in the Problems
  panel; files changed on disk are re-validated (file watchers for `.txt`, `.gui`, `.gfx`,
  `.asset` and `localization/**/*.yml`), and a save re-validates the files that use what the
  saved file defines. **CK3: Validate Workspace** now forces a full pass with a cancellable
  progress notification (LSP `window/workDoneProgress`) and returns `{ files, errors,
  warnings, information, milliseconds }`; `ck3.getWorkspaceStats` adds the pass state.
  Settings `backgroundValidation.enabled` (true), `.concurrency` (5), `.fileLimit` (3000; above it only open files unless a pass is forced). Engine:
  `WorkspaceValidator` (`index/scheduler.ts`), an incremental, cancellable scheduler that
  yields to the event loop after every file, and `Indexer.dependentsOf(uri)`.
- **Explorer file decorations** (#87): a badge with the count of a file's worst severity and
  its colour, propagated to folders.
- **Status-bar health summary** (#84): workspace error and warning totals, a spinner with
  progress while a pass runs, click opens the Problems panel (unfiltered: VS Code has no
  public API to set its filter).
- **Real-mod corpus acceptance**: five published mods recorded on the engine path
  (`packages/engine/scripts/corpus-acceptance.js`) and in the Extension Development Host
  (`CK3_CORPUS=… task test:integration`), every error finding classified
  (`packages/engine/test/corpus/real-mods/`); the plug-in false positives found there are
  issues #91 to #97.

#### Fixed

- **A mod folder named like a script directory no longer turns every file into that kind**
  (#90): a file's kind (event, decision, scripted effect …) was judged by unanchored patterns
  on its absolute path, so a mod in `viet-events/` had every scripted effect and trigger
  indexed as an event and reported unknown where called (1,751 errors on VIET Events, now 1).
  Files are classified by their path inside the mod, with patterns anchored to whole
  segments (`Indexer` takes a `relativePath` resolver; `Workspace` supplies it).
- **Localization suggestions no longer stall the server**: the "Did you mean" work is bounded
  (length pre-check and early exit in the edit distance, suggestions reused per name, at most
  100 distinct names per kind per file); the slowest RICE localization file went from 6.9 s
  to 0.1 s.

#### Changed

- **Closing a file no longer clears its diagnostics or drops it from the index**: its last
  result stays in the Problems panel until background validation checks it again, from disk.
- **Restarting the server no longer starts a second client** three seconds later: a deliberate
  stop was handled as a crash.

## [2.0.0] - 2026-10-01

pychivalry is re-architected around an engine core that reads one generated description of
the game, instead of word lists scraped from wiki pages and game files. Diagnostics now carry
the game's own message ids and texts. Target game version: CK3 1.20.0.2.

### Added

- **Engine core** `packages/engine` (npm `pychivalry-engine`), a dependency-free TypeScript
  package: spec-package loader and API, parser, incremental parser, workspace index and call
  graph, and the checks parse → registry → schema → scope → plug-ins. The repository is now
  an npm workspace (`packages/*`, `vscode-extension`).
- **Spec package 1.20.0.2** (package format 2) bundled and sha256-verified: six
  engine-derived keyword buckets (triggers 1,447, effects 1,007, links 312, lists 377,
  on_actions 203, modifiers 609, each with the engine's documentation string), 79 modifier
  templates, 13 keyword templates, 227 script directories
  with 185 field schemas, the 1,967-message error catalogue and the retired-keyword table,
  generated by pdx-parser-re from the game executable.
- **Keyword templates and recovered names** from the corrected spec package: the 13
  per-database keyword families the game registers at load time (`has_relation_%s`,
  `set_relation_%s`, `add_%s_xp`, `%s_perks` …) are accepted when the slot is a key of their
  database (`common/scripted_relations`, `common/lifestyles`, `common/dynasty_legacies`) in
  the mod or the `--vanilla` base game, and any fill is accepted without a base game; the 21
  names the earlier package missed (`age`, `always`, `has_activity_intent`, the links
  `secret_owner`, `real_father`, `confederation` …, the database iterators `every_trait`,
  `random_tenet` …) are in their buckets.
- **Command-line checker**: `pychivalry-engine check <modDir> [--spec <file>] [--json]
  [--vanilla <game dir>]`.
- **Diagnostics with the game's messages**: unknown triggers, effects, iterators and
  modifiers judged by name and context (effects in trigger blocks and the reverse included);
  retired keywords with their replacement (`set_state_faith` → `set_state_rite`, …);
  directory-schema fields; the three required fields the engine enforces; scope chains
  walked link by link; undefined saved scopes when a base game is given.
- **Mod overlays**: mods found by the mod registry (Carnalitas) layer their scripted
  triggers and effects over the spec package (`Spec.withOverlay`).
- Hover, completion and signature help show the engine's documentation strings verbatim,
  with both buckets for the 133 names registered in more than one.
- `error.log` oracle test: every recorded `error.log` line naming a corpus file maps to an
  engine diagnostic with the same catalogue id.
- Generated diagnostics reference (`Documentation/user-guide/diagnostics/`,
  `tools/gen-diagnostics-docs.ts`) and `data/diagnostics.yaml` as the complete list of plug-in
  codes, checked in CI.
- `£icon£` text icons and localization key format (`LOC-001`) in the localization validator.

### Changed

- **Grammar**: bare-value lists, date literals, `@name = value` constants and `@name`
  references, full `@[ … ]` arithmetic, UTF-8 BOM, scope chains kept as chains (`scope:x.liege`),
  `?=` after any key, comments and newlines between a key, its operator and its value. All
  4,035 vanilla 1.20 files under `common/`, `events/`, `history/` parse with one error, a real
  defect in vanilla's `history/characters/japanese.txt`.
- Parse errors use the catalogue's texts (`Expected '=' between block name and body`,
  `Expected } after arguments`, …) instead of the extension's own.
- All 17 LSP providers read the engine; `server.ts` (1,871 → 606 lines) and `extension.ts`
  (1,585 → 88 lines) are wiring only.
- Surviving validators run as engine plug-ins registered in one place
  (`vscode-extension/src/server/plugins.ts`): scope-timing, style-checks, conventions,
  localization references, events (presentation fields), paradox-checks (the extended checks
  folded in), variables, traits, scripted-blocks, script-values, iterators, switch.
- Variables plug-in: a variable checked in `trigger` and set later in `immediate` is no longer
  reported as undeclared (`CK3701`).
- CI: one workflow builds the workspace and runs lint, format checks, engine tests (unit,
  golden, corpus, CLI), the diagnostics-docs check, extension unit tests and integration tests
  on Linux, Windows and macOS, on Node 22; it also runs for `agents/**` branches.
- Integration tests are deterministic (fresh user-data directory per run, settings re-read
  after updates, quick picks dismissed); `@vscode/test-electron` 3.1 (VS Code 1.110+ on macOS).
- Pre-commit runs the workspace's own Prettier and ESLint.
- `npm run package` in `vscode-extension/` builds the VSIX (`npm run bundle` is the
  production webpack build).
- Node.js 22 is required for development.

### Removed

- The scraped vocabulary and its extractors: `data/triggers/`, `data/effects/`,
  `data/scopes/`, `data/schemas/` (32 schemas), `data/on_actions.yaml`,
  `data/interaction_hooks.yaml`, `data/scope_accessors.yaml`,
  `data/scriptable_directories.yaml`, `data/game_structure.yaml`, `data/modifier_types.yaml`,
  `tools/extract-{effects,triggers,on-actions,scopes}.ts`, `tools/merge-keywords.js`,
  `tools/scope_accessors_extracted.csv` (44 MB).
- The duplicate and dead modules: `core/` (parser, indexer, workspace, call graph,
  localization index), `indexer-enhanced.ts`, `workspace-enhanced.ts`, `scopes-advanced.ts`,
  `ck3/language.ts`, the old diagnostics coordinator, `schema/`, `data/directory-registry.ts`.
- Per-system validators that restated a directory schema (decisions, interactions, schemes,
  activities, court positions, casus belli, on-actions, story cycles, generic rules, assets,
  modifiers, lists); their codes (51) are gone from `data/diagnostics.yaml`, and the engine's
  registry and schema checks cover the defect classes with the game's messages.
- The extension's data-extraction commands (they now show a notice; use `tools/`).
- Sprint reports, session summaries and the kanban guideline (moved to
  `Documentation/archive/`), `.formic/`, `example_mod_backup/`, the CK3 executable analysis
  (superseded by pdx-parser-re), the Ansible PR-validation workflow copied in by mistake, and
  stale Copilot prompts, agents and skills (moved to `.github/archive/`).

### Known gaps

- **Per-keyword scope validity** ("this trigger is not valid in a title scope") is not
  checked: the spec package's `scope_validity` is empty until the game's `script_docs` output
  is captured. Inlay hints show saved scopes, not scope types.
- No engine check reports a missing graphics file (PR #56 stays open).
- Workspace-wide background diagnostics are not run; `CK3: Validate Workspace` runs them on
  demand.

## [1.1.0] - 2026-01-01

### Added
- **Live Game Log Analysis** - Real-time monitoring of CK3 game logs with intelligent error detection
  - Auto-detect CK3 log directory on Windows, Linux, and macOS
  - Monitor `game.log` for changes using OS-native file events (watchdog)
  - Pattern-based error detection with 10 pre-defined error types
  - Fuzzy matching suggestions for typos in effects/triggers
  - LSP diagnostics integration - errors appear in Problems panel
  - Statistics tracking (error counts, categories, performance metrics)
  - VS Code commands: start/stop/pause/resume/clear/showStatistics
  - GameLogs output channel with color-coded severity icons
  - Configuration settings for auto-start, debounce delay, custom patterns
  - Comprehensive user guide in `plan docs/LOG_WATCHER_USAGE.md`

### Changed
- Updated README.md to highlight new live log analysis feature
- Added Copilot instructions for log watcher development workflow
- Extended VS Code extension with 6 new commands and notification handlers

## [1.0.0] - 2026-01-01

### 🎉 First Stable Release

pychivalry is now production-ready! This release marks the first stable version of the CK3 Language Server, bringing professional IDE features to Crusader Kings 3 mod development.

### Highlights

- **1,142 passing tests** with comprehensive coverage
- **15+ major LSP features** fully implemented
- **Production-ready** architecture with async/threading optimizations
- **Rich documentation** with examples and guides

### Features

All features from previous releases are now stable and production-ready:

#### Core Language Server Features
- **Context-Aware Auto-completion**: 150+ CK3 keywords, effects, triggers, and scopes
- **Real-Time Diagnostics**: Three-layer validation (syntax, semantic, scope)
- **Hover Documentation**: Rich Markdown tooltips with examples
- **Go to Definition**: Navigate to events, scripted effects/triggers, localization keys
- **Find References**: Find all usages across workspace
- **Document Symbols**: Hierarchical outline view (Ctrl+Shift+O)
- **Workspace Symbols**: Search symbols across workspace (Ctrl+T)
- **Code Actions**: Quick fixes for typos and refactoring suggestions
- **Rename Symbol**: Workspace-wide symbol renaming (F2)
- **Document Links**: Clickable file paths, URLs, and event IDs
- **Document Highlight**: Highlight all occurrences of symbol
- **Signature Help**: Parameter hints when typing
- **Inlay Hints**: Inline type annotations for scopes
- **Document Formatting**: Auto-format to Paradox conventions (Shift+Alt+F)
- **Folding Ranges**: Code folding support

#### CK3 Language Support
- **Scope System**: Full scope chain validation and saved scope tracking
- **Script Lists**: List iterator validation (any_, every_, random_, ordered_)
- **Script Values**: Formula and range validation
- **Variables System**: Complete var:, local_var:, global_var: support
- **Scripted Blocks**: Scripted triggers/effects with parameter support
- **Event System**: Full event structure and validation
- **Localization**: Key parsing, navigation, and validation

#### Performance Optimizations
- **Async Architecture**: Non-blocking operations with debouncing
- **Thread Pool**: Multi-threaded CPU-intensive operations
- **LRU Caching**: Optimized lookups and parsing
- **Adaptive Delays**: Smart debouncing based on file size
- **Memory Optimization**: Reduced AST memory footprint with __slots__

### Documentation
- Comprehensive README with quick start guide
- CHANGELOG following Keep a Changelog format
- CONTRIBUTING guide for contributors
- TESTING guide with detailed instructions
- Multiple feature-specific documentation files
- Apache 2.0 license

### Changed
- Version bumped to 1.0.0 across all packages
- Development status changed from Alpha to Production/Stable
- All URLs verified to point to public repository

## [Unreleased]

### Added
- **Multi-Channel Output Logging**: Organized output into dedicated channels for better debugging
  - **CK3: Server**: Server lifecycle messages (start, stop, restart, config changes)
  - **CK3: Debug**: Detailed debug information (auto-enabled when `logLevel` is `debug`)
  - **CK3: Commands**: Results from workspace commands (validation, rescan, stats)
  - **CK3: Trace**: LSP protocol tracing (when trace.server enabled)
  - **CK3: Performance**: Timing and cache metrics (auto-enabled when `logLevel` is `debug`)
  - Quick pick menu for "Show Output" command to select which channel to view
  - Timestamps on all log messages
  - Debug and Performance channels automatically enabled when `logLevel` setting is `debug`
- **Async & Threading Architecture**: Complete overhaul for non-blocking performance
  - **Thread Pool**: 2-4 worker threads (based on CPU count) for CPU-bound operations
  - **Async `did_change`**: Document changes now use 150ms debouncing with automatic stale update cancellation
  - **Threaded Handlers**: 10 CPU-intensive handlers now run in thread pool:
    - `semantic_tokens_full` - Rich syntax highlighting
    - `references` - Find all references
    - `workspace_symbol` - Workspace search (Ctrl+T)
    - `rename` - Symbol renaming across workspace
    - `document_formatting` / `range_formatting` - Code formatting
    - `code_lens` - Reference counts and metadata
    - `inlay_hint` - Inline type annotations
    - `folding_range` - Code folding
    - `document_highlight` - Symbol highlighting
  - **Thread-Safe Data Access**: RLocks protect `document_asts` and `index` structures
  - **Graceful Shutdown**: Clean thread pool shutdown when server stops
- **LRU Caching Optimizations**: Additional performance improvements
  - **Semantic Token Caching**: Cached builtin identifier lookups (2048-entry LRU cache) for 20-40% faster highlighting
  - **Completion Item Caching**: Cached completion item generation eliminates redundant object creation
  - **Frozenset Lookups**: O(1) membership testing for effects, triggers, keywords, scopes, and scope links
- **Advanced Optimizations** (Tiers 1-4 from ASYNC_IMPLEMENTATION_GUIDE.md):
  - **`__slots__` for CK3Node/CK3Token**: 30-50% memory reduction for large files with many AST nodes
  - **AST Content Hash Caching**: 50-entry LRU cache by MD5 hash - instant re-parsing for unchanged content
  - **Adaptive Debounce Delay**: 80ms for small files (<500 lines), 150ms medium, 250ms large, 400ms very large
  - **Parallel Workspace Scanning**: 2-4x faster workspace indexing using thread pool for file I/O
  - **Streaming Diagnostics**: Syntax errors published immediately, semantic analysis runs in background
  - **Pre-emptive Parsing Infrastructure**: Queue system for background parsing of related files (ready for Tier 4)
- **Folding Range**: Code folding support (Ctrl+Shift+[ to fold, Ctrl+Shift+] to unfold)
  - Event blocks: Collapse entire events to single lines
  - Named blocks: Fold `trigger`, `effect`, `option`, `immediate`, iterators
  - Nested blocks: Any `{ ... }` block spanning multiple lines
  - Comment blocks: Consecutive comment lines can be folded
  - Region markers: Custom folding with `# region Name` / `# endregion`
- **Rename Symbol**: Workspace-wide symbol renaming (F2 or Ctrl+Shift+R)
  - Event IDs: Rename `rq.0001` across all files, including localization keys
  - Saved scopes: Rename `scope:target` and all `save_scope_as = target` definitions
  - Variables: Rename `var:counter` and all `set_variable = { name = counter }` definitions
  - Character flags: Rename across `has_character_flag`, `add_character_flag`, `remove_character_flag`
  - Global flags: Rename across `has_global_flag`, `set_global_flag`, `remove_global_flag`
  - Scripted effects/triggers: Rename definitions and all usages
  - Opinion modifiers: Rename definitions and `modifier =` references
  - Prepare Rename support: Validates rename is possible before starting
  - Name validation: Enforces proper identifier format and event ID format
  - Localization key updates: Automatically renames related localization keys (`.t`, `.desc`, `.a`, etc.)
- **Document Links**: Clickable references for paths, URLs, and event IDs
  - File paths: `common/scripted_effects/file.txt`, `gfx/icons/icon.dds` become clickable
  - URLs: `https://...` links are clickable with domain-specific tooltips (Wiki, GitHub, etc.)
  - Event IDs in comments: `# See rq.0001` links to event definition
  - GFX paths in script: `icon = "gfx/..."` are clickable
  - Workspace-aware path resolution for mod structure
- **Document Highlight**: Click on a symbol to highlight all occurrences in the file
  - Saved scopes: `scope:target` and `save_scope_as = target` highlighted together
  - Event IDs: Definitions and `trigger_event` references highlighted
  - Variables: `var:name`, `local_var:`, `global_var:` with `set_variable` definitions
  - Character flags: `has_character_flag`, `add_character_flag`, `remove_character_flag`
  - Global flags: `has_global_flag`, `set_global_flag`, `remove_global_flag`
  - Traits: `has_trait`, `add_trait`, `remove_trait`
  - Proper highlight kinds: Read (references), Write (definitions)
- **Signature Help**: Parameter hints when typing inside effect blocks
  - Shows required and optional parameters with type hints
  - Highlights active parameter as you type
  - Supports 25+ effects: add_opinion, trigger_event, set_variable, add_character_modifier, random, death, etc.
  - Trigger signatures: opinion, has_relation, is_at_war_with
  - Triggered by `{`, `=`, and space characters
- **Inlay Hints**: Inline type annotations for scopes and iterators
  - Scope type hints: `scope:friend` shows `: character`
  - Chain type hints: `root.primary_title` shows `: landed_title`
  - Iterator hints: `every_vassal` shows `→ character`
  - Smart type inference from naming conventions (e.g., `_target`, `_title`, `_province`)
  - Configurable via settings: show/hide scope types, chain types, iterator types
  - 40+ character list types, 10+ title list types, faith/culture/war/scheme types
- **Document Formatting**: Auto-format CK3 scripts to Paradox conventions (Shift+Alt+F)
  - Tab indentation (Paradox convention, not spaces)
  - Opening braces on same line: `trigger = {`
  - Single space around operators: `key = value`, `>= 5`
  - Proper blank lines between top-level blocks
  - Trailing whitespace trimming
  - Preserved quoted strings and comments
- **Range Formatting**: Format only selected code (Ctrl+K Ctrl+F)
  - Automatically expands to complete blocks
  - Useful when pasting code from other sources
- **Go to Definition**: Navigate to events, scripted effects/triggers, localization keys, saved scopes, modifiers, flags, on_actions, and more
- **Code Actions**: Quick fixes for typos, missing namespace suggestions, scope chain validation
- **Context-Aware Completions**: Intelligent filtering by block type (trigger/effect), scope type, and cursor position
- **Snippet Completions**: Event templates, scripted effect/trigger templates, common patterns
- **Event System Validation**: Full validation of event structure, types, themes, portraits, options
- **Script Values**: Formula and range validation with operation support
- **Variables System**: Full var:, local_var:, global_var: support with validation
- **Scripted Blocks**: Scripted triggers/effects with parameter support ($PARAM$)
- **List Iterators**: any_, every_, random_, ordered_ validation with parameters
- **Localization Support**: Key parsing, navigation, and text formatting validation
- **Workspace Features**: Mod descriptor parsing, cross-file symbol tracking

### Improved
- **Completions**: Now context-aware with scope filtering and saved scope suggestions
- **Diagnostics**: Enhanced with event validation, variable checking, list parameter validation
- **Test Coverage**: Expanded from 142 to 645+ tests including integration, regression, fuzzing, and performance tests

## [0.2.0] - 2025-12-30

### Added
- **Hover Documentation**: Rich Markdown tooltips for effects, triggers, scopes, events, saved scopes
- **Real-Time Diagnostics**: Three-layer validation (syntax, semantic, scope)
- **Scope System**: Full scope chain validation and saved scope tracking
- **Parser Foundation**: Complete AST parsing with position tracking
- **Document Indexer**: Cross-file symbol tracking

### Technical
- Data-driven architecture with YAML scope definitions
- pytest-asyncio for LSP handler testing

## [0.1.0] - 2025-12-30

### Added
- Initial implementation of CK3 Language Server using pygls 2.0.0
- Basic text document synchronization (open, change, close)
- **Auto-completion**: 150+ CK3 language constructs
  - 50+ keywords (if, trigger, effect, etc.)
  - 30+ effects (add_trait, add_gold, etc.)
  - 30+ triggers (age, has_trait, etc.)
  - 40+ scopes (root, every_vassal, etc.)
  - 5 event types
  - Boolean values
- VS Code extension for CK3 file types (.txt, .gui, .gfx, .asset)
- Language configuration for CK3 scripting syntax
- CK3 language definitions module (`ck3_language.py`)

### Documentation
- README with installation and usage instructions
- GETTING_STARTED guide
- VSCODE_SETTINGS configuration examples
- CK3_FEATURES.md documentation

### Technical Details
- Python 3.9+ support
- pygls 2.0.0 for LSP implementation
- TypeScript VS Code extension
- Apache 2.0 license

[Unreleased]: https://github.com/Cyborgninja21/pychivalry/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Cyborgninja21/pychivalry/releases/tag/v1.0.0
[0.2.0]: https://github.com/Cyborgninja21/pychivalry/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.1.0
