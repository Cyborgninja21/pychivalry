# The graphics-file check

`graphics/missing-file` (docs/PLAN.md item 10.5; its row is in [checks.md](checks.md#step-10-graphics))
warns when a texture a mod names is a file of neither the mod, the base game nor a DLC pack. A
missing texture shows in the game as a pink or black square, and the game logs it. This page says
which keys the check reads and from which part of the spec package, which values it judges and
which it leaves undecided, and what it found on the base game and the five test mods. The code is
`packages/core/src/check/graphics-missing-file.ts`; its tests are beside it.

## Which keys hold a file path

The spec package says it, field by field; the core holds no list of keys. A field is read when
both of these hold:

- **Part C1, the `.info` type.** Paradox's own documentation file for the folder writes the field's
  value as a file path: `<file path>`, `string path` or `path string`, which the package records
  as the `.info` type `file_path` of the field (`schema.<folder>.fields.<field>.info_type`).
- **Part B1, the measured value type.** The base game writes paths there: the field's measured
  `value_type` has the value group `path`.

On game 1.21.0.3 that is 13 fields of 8 folders:

| Folder | Fields |
| --- | --- |
| `common/decisions` | `picture` > `reference`, `extra_picture` |
| `common/districts` | `background` > `reference` |
| `common/domiciles/buildings` | `asset` > `icon`, `asset` > `texture`, `asset` > `intersectionmask_texture` |
| `common/event_2d_effects` | `effect_2d` > `reference` (videos only: no value is judged) |
| `common/event_backgrounds` | `background` > `reference`, `background` > `video_mask` (videos only) |
| `common/event_themes` | `header_background` > `reference`, `icon` > `reference` |
| `common/event_transitions` | `transition` > `reference` |
| `events` | `queue_icon` |

Release 2.3.0 read nine key names from its own code (`icon`, `texture`, `sprite`, `background`,
`portrait_texture`, `reference`, `activity_window_background`, `background_texture`,
`icon_texture`) wherever they stood. Measured on the base game, a key name says nothing: a
building's `type_icon` is measured as a path and every one of its 917 values is a file name inside
the folder a define names (`duchy_buildings/dragon_kiln.dds`, in `BUILDING_TYPE_ICON_PATH`), as the
folder's `.info` says ("Filename of building type icon in 'BUILDING_TYPE_ICON_PATH' folder"); read
as a path from the top of the game, all 917 would be missing.

## Which values are judged

A value is judged when it names a texture: its file name ends in `.dds`, `.png` or `.tga`, the
three kinds docs/MVP.md gives the check (in any letter case). A video (`.bk2`) in the same fields
is not this check's. A texture is looked up only when it is a path from the top of the game's
folders, its segments joined by `/`. Every other form is left undecided, and the check reports
nothing on it, because neither the package nor the base game says how the game reads it:

| Form | Example | Why it is not decided |
| --- | --- | --- |
| A bare file name | `reference = "my_picture.dds"` | Every one of the base game's values in these fields names a folder; nothing says which folder a name with none is read in |
| A `..` or `.` segment, an empty one | `gfx/../gfx/x.dds`, `gfx//x.dds` | Whether the game's file system resolves them, or refuses a path that leaves its folders, is not said |
| A path from the root, a drive, a backslash | `/gfx/x.dds`, `C:/x.dds`, `gfx\x.dds` | The base game writes a leading `/` in one field the check does not read (`common/task_contracts` `icon`, 6 values); how it is read is not said |
| A script parameter or a bracket | `gfx/$NAME$.dds` | Known only where the script is called |
| An `@constant` the file does not set at its top level | `reference = @picture` | Part D2: a constant holds for its file. One set at the file's top level to a path is judged at the field that names it; one set inside a block, by a reader action (`@:register_variable`) or in `reader_export/` is not followed |

## Where a file is looked for

In the mod's folder and in every layer of the base game the index reads: the install's `game/`,
`jomini/` and `clausewitz/` folders and each DLC pack, a pack's files at their path inside the
pack (part D1's `pack-layer` row). The index keeps the files of every layer it does not read as
script (`WorkspaceIndex.setUnreadFiles`), from the same listing of the files it reads, so the
check reads no folder of its own. A mod's `replace_path` is not applied: a texture under a
replaced path is counted as found, so the check can miss a texture there and never reports one
that is present.

**Letter case** is part D1's `path-case` row for the platform the index reads for: on Linux the
engine compares paths exactly (`path-case-linux`), so a path that matches a file only in other
letter case is missing, and the finding names the file's own spelling in its data (`other_case`);
on Windows (`path-case-windows`) it is found. Where no row decides, such a path is undecided.

**No game folder:** the check reports nothing. A texture the mod lacks may be the game's, which
nothing can tell without the game's files.

## Its evidence

The catalogue's `failed_to_load_texture_X_file_not_found`, "Failed to load texture %s - file not
found", the row's evidence since its sign-off. The 1.21.0.3 Linux executable keeps that text beside
the map graphics (`mapgraphics.cpp`), so it shows the game reports a texture it cannot find, not
yet that it reports it for each of these fields. Its file layer's own message is the closer one:
`failed_to_open_file_X_file_does_not_exist_in_any_of_the_moun`, "Failed to open file %.*s. File
does not exist in any of the mounted locations.", kept beside the core file layer
(`pdx_core`); it is proposed for the row as a second message. The executable reads
`intersectionmask_texture` in its GUI intersection-mask code (`pdx_gui_intersection_mask.cpp`:
"Missing file path property for intersectionmask_texture"); the one message that tries other
formats of a texture ("... with any of the following formats (png,bmp,tga)") belongs to the map
editor's materials (`jomini/modules/map_editor/source/materials.cpp`), so a `.dds` written for a
`.png` is not found under another name. Item 11.1's planted-defect capture can show the line the
game writes.

## The base game

`task game:check` (records/game/check.json): 19 warnings in 6 files, each a defect of the game's
own files, classified with its evidence in `tools/data/check-classifications.json`. No other
value of the 13 fields is missing: the base game writes 14,594 texture values in them (counted
with the check's own reading by a one-off script over the base game, not committed).

| File | Lines | The texture named | What the install has |
| --- | --- | --- | --- |
| `common/decisions/00_holy_order_decisions.txt` | 780 | `gfx/interface/illustrations/holding_types/tgp_decision_mandala.dds` | The file in `illustrations/decisions/`, which the base game's 10 other uses of it name |
| `common/decisions/dlc_decisions/fp3_decisions.txt` | 998 | `gfx/interface/illustrations/struggle_decision_buttons/fp3_decision_assertion.dds` | No file of that name; the line's own comment reads "# Does this need to be updated?" |
| `common/domiciles/buildings/00_merchant_company_buildings.txt` | 9 lines from 2602 | `gfx/interface/window_domiciles/estate_building_villa_byzantine_mask.dds` | The mask as a `.png`, which 148 other lines of the folder name |
| `common/domiciles/buildings/10_japanese_manor_buildings.txt` | 6 lines from 1074 | `gfx/interface/window_domiciles/tgp_ui_domicile_building_japanese_main_building.dds` | No file of that name with any extension |
| `common/event_backgrounds/01_event_backgrounds.txt` | 13763, 13796 | `gfx/interface/illustrations/event_scenes/ep2_travel_settlement_hills.dds` | No file of that name with any extension |

## The five test mods

`task game:mods` (records/game/mods.json): the counts are in its record, by mod and by code.

## What the spec package does not say yet

Sent back to the spec work as a request (the owner relays it):

1. **48 more fields of 25 folders hold texture paths and have no `.info` type.** The package
   measures them as paths (part B1) and their `.info` text calls them textures, in words only:
   `common/accolade_types` `icon` ("full path to the icon texture for this type"),
   `common/council_tasks` `asset` > `background`, `frame`, `glow`, `icon` ("Path to background
   texture ..."), `common/court_positions/types` `court_position_asset` > `background`,
   `common/schemes/scheme_types` `illustration`, `common/story_cycles` `background` > `reference`
   ("File path to desired asset"), `events` `override_icon` > `reference` ("Path to the texture"),
   and 40 more. Requested: the type `file_path` as data on each, or a statement that it is not one.
   Until then the check does not read them. On the base game every texture value of them is a
   file but one (`common/modifier_icons` `positive`, `gfx/interface/icons/modifiers/_default.dds`)
   and 6 written with a leading `/`.
2. **A field whose file name is read inside a folder** a define names (`common/buildings`
   `type_icon`, typed `string`, in `BUILDING_TYPE_ICON_PATH`; a trait's `icon = name.dds`): the
   folder, as data, so that such a name can be looked up.
3. **How the game reads a path with no folder, a `..` segment, a leading `/` or a backslash**, for
   the forms the check leaves undecided.
