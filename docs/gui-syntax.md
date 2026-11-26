# GUI file syntax

How a GUI file (`.gui`) is written, where that differs from script, what pychivalry's GUI parser
reports, and how the index reads types and templates (docs/PLAN.md, items 10.1 to 10.4). Every
count here was measured on game 1.21.0.3 from every `.gui` file of the install, 583 files, by
`task game:parse` with the GUI parser (`results.gui` of
[records/game/parse.json](../records/game/parse.json); each form's name there is given in
brackets). Counts are the base game's own `game/` folder first, then the whole install with the
engine's `jomini/` and `clausewitz/` folders.

The spec package's GUI companion (part C2, `ck3-spec-1.21.0.3.gui.json`) measured the same 442
files of `game/` with its own reader; on every count both give, the two agree
([How it was measured](#how-it-was-measured)). The companion is a measured vocabulary of widget
types and properties; pychivalry reads none of it in step 10, since checks against a GUI
vocabulary come after the MVP ([MVP.md](MVP.md#not-in-the-mvp)).

## Contents

1. [Which files](#which-files)
2. [What GUI syntax shares with script](#what-gui-syntax-shares-with-script)
3. [Named blocks](#named-blocks)
4. [Type definitions](#type-definitions)
5. [Templates and `using`](#templates-and-using)
6. [Values, and values with units](#values-and-values-with-units)
7. [Constants and `@[ ]`](#constants-and)
8. [What the parser reports](#what-the-parser-reports)
9. [The index of types and templates](#the-index-of-types-and-templates)
10. [How a mod's GUI overrides the base game's](#how-a-mods-gui-overrides-the-base-games)
11. [What step 10 does not do](#what-step-10-does-not-do)
12. [How it was measured](#how-it-was-measured)

## Which files

| Folder | `.gui` files | Why it is read |
| --- | ---: | --- |
| `game/gui/` | 441 | The game's GUI folder: the spec package lists `gui` (content type `gui`, its reader taking `.gui` files), and the game's `checksum_manifest.txt` names it with `sub_directories = yes`. 224 of the 441 are in sub-folders |
| `game/tweakergui_assets/` | 1 | `interface/tweakergui.gui`, the tweaker's window; the companion reads it (442 files), no folder of the spec lists it |
| `jomini/gui/` | 91 | The engine folder mounted below `game/` (part D1, `search-path-order`); `game/gui/` holds 21 of its paths and replaces each whole (`game-file-replaces-jomini-and-clausewitz`) |
| `jomini/jomini/` | 1 | `gui/encyclopedia/jomini_encyclopedia.gui`, outside every `gui/` folder: whether the game reads it is not shown |
| `clausewitz/gui/` | 49 | The engine's own tool windows, mounted first |

No DLC pack holds a GUI file. 192 of `game/gui/`'s 441 files start with the UTF-8 byte-order
mark, none of the engine folders' do, and every one is valid UTF-8; they are decoded as script
files are ([encoding.md](encoding.md)). The parse suite parses all 583. The index reads the GUI
files of a folder the spec lists whose reader takes `.gui` files, `gui/` alone: 441 of `game/`,
91 of `jomini/` and 49 of `clausewitz/`, 581, the 21 that `game/` replaces among them.

## What GUI syntax shares with script

The tokens. A GUI file is read with the script lexer (`syntax/lexer.ts`), unchanged: bare words,
quoted text, `#` comments to the end of the line, `{` and `}`, operators, `@name` constants and
`@[ ... ]`. A bare data binding is one word to it, and none in the install holds a space (all
246 bare `[...]` values are one word, [`value:data-binding`]; the 12,273 data bindings with a
space are quoted, [`value:quoted-data-binding-with-space`]), so no GUI file of the install lexes
differently from how its author meant it.

The statement `key = value` and `key = { ... }` (199,440 properties in `game/`, 220,375 in the
install, [`property`]), and lists of values (`size = { 480 770 }`: 22,788 blocks of values only,
[`property:block-list`]). Every operator in every GUI file of the install is `=`: no comparison,
no `?=`, no `$PARAM$` in place of an operator.

What it does not share: a GUI file has no name before a key (`scripted_trigger name = { ... }`),
no tagged value (`rgb { ... }`), no `$PARAM$`, and no block without a key: none of the install's
583 files writes one.

## Named blocks

A keyword of GUI syntax, a name, and a block, with no `=` before the block. Six keywords:

| Keyword | `game/` | Install | First place | Where |
| --- | ---: | ---: | --- | --- |
| `types` | 273 | 366 | `gui/achievements/jomini_achievements_types.gui:1` | The top level only: a group of type definitions |
| `template` | 590 | 760 | `gui/activity_window_widgets/tournament_widget_types.gui:1125` | The top level only |
| `local_template` | 1 | 1 | `gui/window_confederation.gui:1942` | The top level; used three times, in its own file |
| `layer` | 13 | 13 | `gui/shared/windows.gui:4` | The top level, one file; `layer = middle` (278 in `game/`) is a property of a widget |
| `block` | 2,806 | 3,397 | `gui/achievements/jomini_achievements_types.gui:80` | Inside a block only: a place a type or template may be overridden |
| `blockoverride` | 8,558 | 9,302 | `gui/achievements/jomini_achievements_window.gui:32` | Inside a block only: overrides a `block` of the same name |

```text
types AccoladeWindowTypes            # gui/window_accolade.gui:782
{
	type accolade_type_box = hbox {
		block "name_text"
		{
			text = "[AccoladeType.GetName]"
		}
	}
}
```

How the name is written ([`named:<keyword>:name-...`]):

| Form | `game/` | Example |
| --- | ---: | --- |
| Quoted: `blockoverride "header_text"` | 8,552 of 8,558 block overrides, 2,800 of 2,806 blocks, 1 template | `gui/window_accolade.gui:42` |
| Bare: `blockoverride onclick`, `types Name`, `template Name` | 3 block overrides, 3 blocks, every `types`, 589 templates | `gui/window_struggle.gui:545` |
| Single-quoted: `block 'datacontext'` | 3 blocks, 3 block overrides, all in one file | `gui/shared/mapmodes.gui:417` |
| With `=`: `blockoverride = "scrollbox_content" { ... }` | 31 block overrides, 3 blocks | `gui/interaction_marriage.gui:190` |

The engine's folders write `template = frame_background { ... }` once
(`jomini/gui/entity_editor/entity_editor.gui:66`) and 18 `types "Name"` with the name quoted (14
in `jomini/`, 4 in `clausewitz/`). The
executable keeps these words beside its GUI loader, `pdx_gui_file.cpp` (`types `, `using = `,
`template `) and `pdx_gui_factory.cpp` (`block "`, `blockoverride "`), read with `strings` on the
1.21.0.3 Linux build.

**The keyword's letter case.** Three files write `Types` (`gui/frontend_ingame_menu.gui:447`,
`gui/debug/window_watch.gui:328`, `gui/preload/frontend_loadingscreen.gui:121`), and windows the
game shows use their types: `cloud_save_checkbutton` in the save window
(`gui/window_save_game.gui:85`), `clickable_version_number` on the main menu
(`gui/frontend_main.gui:1353`). The parser reads every keyword without regard to letter case.

## Type definitions

`type name = base { ... }`: a widget type, named, made from another (a built-in widget such as
`hbox`, or another defined type), with the properties it adds. 2,256 in `game/`, 2,728 in the
install ([`type-definition:type`]), every one inside a `types` block at the top level of its file
([`type-definition:type:in-types-block`]). The block opens on the base's line or on the next.
Writing a type as its own base sets the defaults of a built-in widget: `type vbox = vbox { ... }`
18 times in `game/`, from `gui/preload/defaults.gui:102`.

`local_type name = base { ... }`: six times, all in the engine's tool windows
(`jomini/gui/map_editor/materialsetter.gui:5`, `clausewitz/gui/object_explorer/object_browser.gui:71`),
inside `types` blocks; the executable keeps the word beside `local_template`. `game/` writes none.

## Templates and `using`

`template Name { ... }` defines properties a widget takes with `using = Name`: 9,526 uses in
`game/`, 2 of them quoted (`using = "Name"`, `gui/shared/dialogs.gui:65`), 10,565 in the install
([`using:word`], [`using:quoted-text`]). A template is written at the top level of a file, 590
times in `game/`; one name is quoted (`template "Name"`, `gui/window_situation_list.gui:1592`).

## Values, and values with units

What a property's value is written as, in `game/` ([`value:<shape>`]):

| Shape | `game/` | Install | Example |
| --- | ---: | ---: | --- |
| A word (`expanding`, `yes`) | 44,194 | 49,206 | `layoutpolicy_horizontal = expanding` |
| Quoted text (`"ACCOLADE_NAME"`, a texture path) | 29,108 | 32,304 | `texture = "gfx/interface/icons/flat_icons/edit_text.dds"` |
| A quoted data binding, one word | 19,240 | 21,501 | `datacontext = "[AccoladeView.AccessMilitaryView]"` |
| A quoted data binding with spaces | 11,792 | 12,273 | `visible = "[Not( AccoladeView.IsShowingHistory)]"` |
| A number | 20,963 | 22,554 | `max_width = 360` |
| Flags, words joined by `\|` | 2,642 | 3,207 | `parentanchor = top\|right` |
| A bare data binding | 88 | 246 | `visible = [Character.IsValid]` (`gui/interaction_call_ally_notification_window.gui:51`) |
| A constant | 279 | 280 | `margin_right = @margin` (`gui/event_windows/character_event.gui:686`) |
| A number with `f` | 25 | 25 | `glow_texture_downscale = 5.5f` (`gui/frontend_bookmarks.gui:1313`) |
| A percentage | 1 | 28 | `addcolumn = 100%` (`gui/debug/ai_war_coordinator_watch_window.gui:206`) |
| `@[ ... ]` | 2 | 2 | `@progress_bar_segment_size = @[widget_activity_locale_phase_item_width + ...]` (`gui/window_activity_locale.gui:321`) |

**Values with units** are words to the lexer: a percentage (`100%`) and a number with `f`
(`5.5f`). In lists they are common: 3,636 percentages among the 47,278 values of `game/`'s lists
(`size = { 100% 100% }`, from `gui/achievements/jomini_achievements_types.gui:94`), with 43,193
numbers, 255 constants and 194 words ([`list-value:<shape>`]). No grammar reads a unit: which
properties take which is the GUI vocabulary's, after the MVP.

## Constants and `@[ ]`

`@name = value` defines a constant, 26 times at the top level of a file in `game/` and 18 inside
a `types` block (from `gui/frontend_main.gui:125`) ([`constant-definition:...`]); `@name` reads one
(279 values, 255 list values). The companion finds no constant used in a file that does not
define it. `@[ ... ]` computes with constants written without `@`, as in script, read by the same
arithmetic reader. GUI constants are not indexed in step 10.

## What the parser reports

The GUI parser (`packages/core/src/gui/parser.ts`) always returns a tree, keeps its own stack and
has one recovery path per finding. Its thirteen codes are in
[checks.md](checks.md#step-10-gui-syntax), each with its fixture pair `fixtures/mods/gui-<what>`;
every one is advice at information, since no catalogue message is shown to be the GUI reader's
([checks.md](checks.md#the-gui-syntax-findings)). A GUI file gets these findings and no other.

Among statements (the top level of a file, or a block that holds an item with a key), a value
followed on its line by another value, or by a block on its line or the next, is a key whose `=`
is missing; any other value there stands with no key. A block of values only is a list, read as
written.

What the install writes that GUI syntax does not, every one classified a defect of the game's own
files in `tools/data/gui-parse-classifications.json` with its reason:

| Finding | Where | Why it is a defect |
| --- | --- | --- |
| `syntax/gui-missing-equals` | `game/gui/window_dynasty_house.gui:2894`, `gui/window_legends.gui:1002` (`size { ... }`); `gui/debug/window_drag_drop_test.gui:32` (`margin { 50 0 }`) | The base game writes `size = { ... }` 11,677 times and `margin = { ... }` 3,364 times |
| `syntax/gui-missing-equals` | `game/gui/window_dynasty_house.gui:1828` (`align right\|top`) | `align = ...` 3,034 times |
| `syntax/gui-trailing-semicolon` | `game/gui/window_dlc_info.gui:213` (`expanding;`), `gui/window_character.gui:5452` (`struggle_tooltip;`) | The `;` makes the value a word nothing defines; `layoutpolicy_horizontal = expanding` 9,795 times |
| `syntax/gui-trailing-semicolon` | 3 in `jomini/gui/social/`, 8 in `clausewitz/gui/applicationutils/texture_importer.gui` | A `;` after quoted text, read as a value of its own; the files' other properties end with none |
| `syntax/gui-unexpected-closing-brace` | `clausewitz/gui/applicationutils/tools_gui_dialogs.gui:217` | 46 `{` and 47 `}`; the depth is last zero on line 216 |

So `game/` gives 6 findings in 5 files, and 437 of its 442 files none; the install 18 in 9 files.
Read without a finding: a `state` block at the top level of `gui/window_holy_site.gui:908`,
pasted after its window's `}`. That is a property block where no widget is, a question of the
GUI vocabulary, not of syntax.

**The five corpus mods** (`results.gui.mods`): 209 GUI files, every one a tree, one finding:
elf-destiny's copy of the base game's `gui/window_character.gui` keeps its `struggle_tooltip;`
(line 5454). balance-of-power-ui 2 files, divine-intervention 88, rice 67, viet-events none.

## The index of types and templates

The workspace index reads a GUI file of `gui/` (`packages/core/src/gui/extract.ts`):

| Definition | Database | Written | Known by |
| --- | --- | --- | --- |
| A type | `gui` | `type name = base { ... }` in a `types` block at the top level | Its name in any letter case: part D1's settled row `key-identity-gui-types` says the engine lower-cases a type name before it registers it, the one place found where it folds case |
| A local type | `gui:local_types` | `local_type name = base { ... }` there | Its name as written |
| A template | `gui:templates` | `template Name { ... }` at the top level | Its name as written: D1's row says template names were not read |
| A local template | `gui:local_templates` | `local_template Name { ... }` at the top level | Its name as written |

Types and templates are two databases because the game keeps two registries, with two messages
(`Type '%s' already registered at '%s'(%d)`, `Template '%s' already registered at '%s'(%d)`,
catalogue `type_X_already_registered_at_X_X`, `template_X_already_registered_at_X_X`). A use is
every word written in a GUI file outside a definition's own key: a widget's key, a type's base,
a `using` value, a block's name, each word of quoted text and of a data binding (so that
`localization/unused-key` sees a key a GUI file shows); not a number, `@[ ... ]` or a keyword.
In a GUI file a use of a type's name is found in any letter case. A type outside a `types` block
or a template inside a block, which the install never writes, defines nothing.

On the base game ([records/game/index.json](../records/game/index.json)) the index reads 581 GUI
files and records 3,495 GUI definitions; 44 GUI names written more than once are "winner not
known", every one for the listing depth of `gui/` below. In the five mods, a GUI file's words are
uses for every check that asks whether a name is written: `localization/unused-key` reports a key
that a GUI file writes only in a comment (9 findings more in divine-intervention, 11 in
elf-destiny), and `variables/read-without-set` is silent on `disable_toast_notifications` in
elf-destiny, which its `gui/OVERRIDES_types.gui` reads with `GetGlobalVariable`, since a word
beside a variable statement counts as a possible set.

**Go to definition** is the index's, the same on every surface: the editor (go to definition,
find references, hover, the outline of a GUI file), the command line's `lookup`, and the agent
server's `find_definition` (by name or at a place of a mod file), `find_references` and
`list_definitions` (kinds `gui`, `gui:templates`, ...). Where the override rules name no winner
every definition is shown. `packages/lsp/src/gui.test.ts`, `packages/vscode/src/gui-answers.test.ts`
and the editor tests' same-answers case hold it.

## How a mod's GUI overrides the base game's

From the spec package's override rules (part D1), read by the index as it reads them for every
folder ([overrides.md](overrides.md)):

1. **By file path: settled.** A mod's file replaces, whole, the file at the same relative path
   in every lower layer (`mod-file-replaces-lower-layers`, with `file-is-its-relative-path`), so
   a mod's `gui/window_character.gui` replaces the base game's and every type and template in it;
   `game/`'s copy of a path replaces `jomini/`'s the same way. The fixture `gui-index` holds both.
2. **By type name in another file: winner not known.** Part D1 says what the engine does when a
   type is registered twice (`msg-gui-type-already-registered`, partial): it logs
   `Type '%s' already registered at '%s'(%d)` and keeps the first unless the caller's override flag
   is set, and where that flag comes from was not found (`gui-types-and-templates`, open). No row
   says which definition is in force, so the index answers "defined more than once, winner not
   known" and lists both.
3. **By template name: not read.** What a second `template` of a name does, and whether its name
   is lower-cased, was not read (`0x144063450`): winner not known.
4. **Sub-folders of `gui/`: whether they are read is not known.** No `listing-depth` row names
   `gui`, so a file below a sub-folder of it (224 of `game/gui/`'s 441) is "read: not known", and
   a type defined there is "winner not known" even when it is defined once. The game's own
   `checksum_manifest.txt` names `gui` with `sub_directories = yes`, which describes what is
   checksummed, not what the loader lists.

Each open point is a request to the spec work ([decisions.md](decisions.md#asked-awaiting-the-owner)).

## What step 10 does not do

- **No GUI vocabulary.** Whether a widget type, a property or a value exists is not checked; the
  companion's measured vocabulary is not read (MVP.md: after the MVP).
- **No formatting.** GUI files are left out of the formatter: Format Document, `pychivalry format`
  and the agent server's `format` leave a GUI file as it is and say why; no `style/` finding
  judges one. Whether the formatter's rules are safe on GUI files is not shown.
- **No fixes.** No GUI finding carries a fix.
- **Not indexed:** GUI constants, `block` and `blockoverride` names (a `blockoverride` names a
  `block` of the type or template a widget is made from, which the vocabulary would have to
  follow), widget names (`name = "..."`) and layers.

## How it was measured

`task game:parse` parses every GUI file of the folders above with the GUI parser and counts each
form it reads (`tools/src/gui-suite.ts`), with how many files write it, its count in each folder
of the install and its first place, the files read in path order; the record's
`results.gui.forms` holds them, by the names in brackets above. The tokens of every form were
first surveyed with the script lexer, on 2026-11-26. On the 442 files of `game/` the counts agree
with the companion's (`data.counts`) on every number both give:

| Count | pychivalry | Companion |
| --- | ---: | --- |
| Type definitions | 2,256 | `type_definitions` 2,256 |
| `types` blocks | 273 | `types_block_definitions` 273 (`types` 270 and `types_capital_t` 3) |
| Templates | 591 (590 and 1 local) | `templates` 591 |
| Block overrides | 8,558 (31 with `=`, 3 bare, 3 single-quoted) | `blockoverrides` 8,558 (`blockoverride_equals` 31, `_bare` 3, `_single_quoted` 3) |
| Named blocks | 2,806 | `named_block_definitions` 2,806 |
| Layers | 13 | `layers` 13 |
| `using` | 9,526 | `using` 9,526 (`using_quoted` 2) |
| Constants defined | 44 | `constants_defined` 44 |
| Values with no key | 47,280 (47,278 list values and `align right\|top`) | `value_no_key` 47,280 |
| Blocks written `key {` | 3 | `block_no_equals` 3 |
| Values ending in `;` | 2 | `value_ends_with_semicolon` 2 |

Release 2.3.0 read GUI files with its script parser, which reported errors on 327 of the 416 GUI
files of the base game it was measured on. The script parser of step 2, given `game/`'s 442,
reports 10,414 errors in 349 of them: 9,537 `name { ... }` without its `=`, every
`block "x" {` and `blockoverride "x" {` among them, and 877 keys without an operator.
