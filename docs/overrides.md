# The game's override rules

Which definition the game uses when the same thing is defined more than once: by the base game
and a mod, by two files, or twice in one file. Written by build step 3, item 3.1
([PLAN.md](PLAN.md#step-3-workspace-index)), before any index code, from the game's own
evidence. This page answers open question 1 of [MVP.md](MVP.md#open-questions) as far as that
evidence goes, and names the in-game experiment for every rule it does not settle.

Every fact here was taken on game 1.21.0.3 on 2026-11-21. `<game dir>` is the game's `game`
folder; the install folder above it also holds `jomini/` and `clausewitz/`.

## How to read this page

Each rule states what the game does, the evidence for it with file references, and one of two
words:

- **Settled** by game evidence. The index may build on it.
- **Open**: the evidence does not decide it. The rule needs the in-game experiment named with
  it, run on the analysis machine on the owner's word. The index does not build on a guess.

The evidence is ranked as in [references/README.md](references/README.md#order-of-trust): the
executable, then the game's own output, then Paradox's `.info` files, then what the base game's
own files do. The CK3 wiki and community knowledge are hints only. A rule that rests on a hint
alone is open. The wiki could not be read for this page: on 2026-11-21 its site refused
automated requests. The hints below are what modders commonly state, written as such and not
checked against any source.

## Summary

| # | Rule | Status |
| --- | --- | --- |
| 1 | A file replaces the file at the same path in an earlier layer, whole | Settled for a mod over the base game; the letter case of paths is open (rule 9) |
| 2 | File identity is the whole relative path, not the file name | Settled |
| 3 | The install's three folders, `clausewitz`, `jomini` and `game`, are one tree; which copy wins | Open: experiment 1 |
| 4 | The order files are read in, within a folder and across the base game and a mod | Open: experiment 2 |
| 5 | A key defined again in a keyed database: whole record or field by field, and which wins | Open: experiments 2 and 3 |
| 6 | Folders with their own documented rules: events, character history, on-actions, defines, container keys, province terrain | Settled, except two parts that are open: experiments 4 and 5 |
| 7 | Localization: a key defined twice, and the `replace` folder | Open: experiment 6 |
| 8 | `replace_path` in a mod's descriptor | Open: experiment 7 |
| 9 | Letter case in paths | Open: experiments 8a and 8b |
| 10 | DLC folders | Settled for 1.21.0.3: no DLC file or record collides with the base game; a mod file at a DLC file's path is open (experiment 7) |
| 11 | Duplicate keys within one file | Settled for events and character history; otherwise part of rule 5 |

Rules 3, 4, 5, 7, 8 and 9 are open, and the index depends on each of them, so build step 3
stops after this item: see [What this means for step 3](#what-this-means-for-step-3).

## The evidence

| Source | Rank | What it gave |
| --- | --- | --- |
| The committed spec package (1.20.0.2, format 4) | 1 and 2 | No field about overrides or load order. Its error catalogue holds `duplicated_event_id_X_with_the_same_override_priority_X_foun` ("Duplicated event ID {} with the same override priority {} found:", noted "event override priorities exist from 1.20; duplicate-ID checks are per priority") and `duplicate_character_id_X_found_in_history` ("Duplicate character id {} found in history.") |
| The Linux executable, `binaries/ck3` in the install, read with `strings` | 1 | Message texts the committed catalogue does not carry, each beside the source path the executable names for it (below) |
| Paradox's `.info` files: 214 in `<game dir>`, 1 in `jomini/` | 3 | The statements quoted with each rule; a search of all 215 for overriding, replacing, load order and `replace_path` |
| The install's layout, the DLC descriptors `<game dir>/dlc/*/*.dlc`, `paths.settings`, `paths_checksummed.settings`, `checksum_manifest.txt` | Game files | Which folders exist and how a DLC names its folder. `paths.settings` and `checksum_manifest.txt` name content folders and say nothing about overriding |
| The five corpus mods' `descriptor.mod` | Mod files | `name`, `version`, `tags`, `supported_version`, `remote_file_id`. None uses `replace_path` |
| The base game's files, measured | 4 | A one-off scan with the build step 2 parser: top-level keys per spec folder, and where the same key, file name or path occurs twice |

The executable's messages, with the source file it names beside each:

| Message | Source file named beside it |
| --- | --- |
| `Overriding entry '{}' for database '{}' in '{}'` | `jomini/core/game_database.h` |
| `Hash collision in database for key [%.*s] in file: [%s]` | the same |
| `Attempting to create the entry '%.*s' but the database is locked from further editing!` | the same |
| `Discarded duplicate key: %s for language %s` | `pdx_localize/pdx_localize.cpp` |
| `Duplicate localization key. Key '%s' is defined in both '%s' and '%s'.` | the same |
| `Key '%s' defined in multiple files: '%s', '%s'` | the same |
| `/replace/`, read by `ReadLocalizationFolderHelper` | the same |
| `Localization file '%s' should be in in utf-8-bom encoding` | the same |
| `replace_path`, in the table of descriptor keys beside `supported_version`, `remote_file_id`, `user_dir` and `archive` | `clausewitzlib/dlc_descriptor.cpp`, `clausewitzlib/dlc.cpp` |
| `replace_path not implemented for MSGR_DLC. DLC: %s` | the same |
| `Folder not found for DLC/Mod %s:`, `Could not find archive for dlc/mod: %s`, `CDLCManager::InitializeMods()` | `clausewitzlib/dlc.cpp` |
| `Looking for a single value %s in %s, but scripted as an array, won't assign until changed` | `clausewitzlib/definesreader.cpp` |

A message text shows that the game has the behaviour it reports. It does not show when the
message fires, or what the game does next unless the text says so.

## The rules

### 1. A file replaces the file at the same path in an earlier layer, whole

**Settled, for a mod over the base game.** A mod's file at the same relative path as a base-game
file (`common/traits/00_traits.txt` in both) replaces that file: the base game's copy is not read
at all.

- `<game dir>/events/_events.info`, lines 77 to 83, on `id_override_priority`: the field exists
  so that a mod can override one event of the unmodded game, or of another mod, from a file
  with a different name, and so not override that entire file.
- `<game dir>/history/_characters.info`, lines 25 to 31, on `history_override_priority`: the
  same, for history characters.
- So a mod's file named as the game's file overrides the entire file. Neither says
  what happens to an identically named file of one mod under another's; checking several mods
  together is after the MVP (MVP.md, "Not in the MVP"), so the index needs one mod over the base
  game only.

### 2. File identity is the whole relative path, not the file name

**Settled.** Two files with the same name in different folders are two files; neither replaces
the other. Measured, rank 4: the base game ships three such pairs, and in each the two files hold
different definitions. If a file name alone identified a file, one file of each pair would never
be read, and the base game would lose, for example, its main-menu themes or its in-game tracks.

| Pair | What each holds |
| --- | --- |
| `events/situation_events/debug.txt`, `events/test_events/debug.txt` | Different events |
| `music/in_game/music.txt`, `music/main_themes/music.txt` | The in-game tracks; the main themes |
| `common/buildings/holding_district_buildings/00_temple_district_buildings.txt`, `common/buildings/regular_district_buildings/00_temple_district_buildings.txt` | Different buildings: the folder defines no building twice |

The `.info` text of rule 1 speaks of a file's name; the measurement shows the name is the
path. Rule 3 shows the same between the install's own folders: the files the game re-ships from
`jomini/` sit at exactly the same relative path.

### 3. The install's three folders are one tree

**Open: experiment 1.** The install folder holds `clausewitz/` (the engine), `jomini/` (the
shared game layer) and `game/`, each in the same layout (`common/`, `gui/`, `localization/` and
so on). `jomini/` holds script that `game/` does not: six of its thirteen files in
`common/defines/jomini/` (`camera.txt`, `lobby.txt` and four more), and
`common/defines/00_adaptive_music.txt`.

Measured: 56 of `jomini/`'s 500 files and 18 of `clausewitz/`'s 603 have a file at the same
relative path under `game/`; `clausewitz/` and `jomini/` share one path, a shader. Of the 41
script, localization and GUI files `jomini/` shares with `game/`, 39 differ from the `jomini/`
copy: `common/defines/jomini/rivers.txt` sets `FADE_OUT_DISTANCE` to 5.0 instead of 2.0,
`localization/jomini/script_system/trigger_system_l_english.yml` gives
`TRIGGER_LINE_ACTIVE_FAILED` an icon instead of a red `X`. Shipping a changed copy at the same
path only makes sense if the folders are read as one tree, `game/` over `jomini/`, with rule 1
between them. No game file says so: it is an inference from measured use, so it stays open
until experiment 1 shows which copy the game uses.

The index needs it: the base game is all three folders, and a fact read from the wrong copy is
a wrong answer.

### 4. The order files are read in

**Open: experiment 2.** Within one folder the game reads files in a fixed order, and that order
matters:

- `<game dir>/common/decisions/_decisions.info`, line 3: decisions are listed in the order
  they are written, and so in the order of the script files themselves.
- `<game dir>/common/province_terrain/_province_terrain.info`, lines 3 to 5: every `.txt` file
  of the folder is read in order, and by convention the file numbered `00_` holds the terrain
  and the one numbered `01_` the winter properties.
- `<game dir>/common/religion/doctrine_types/_doctrine_types.info`, line 310: among doctrines,
  the later definition takes precedence. `<game dir>/common/laws/_laws.info`, line 10: of two
  laws with the same index, the order of definition decides.
- Measured: 1,859 of the base game's 3,035 `.txt` files under `common/` have names that start
  with a digit (`00_`, `01_`, `90_`, `99_` and so on), which suggests that files are read in
  name order.

Not stated anywhere in the game's files:

- that the order is by file name at all, rather than, say, the order on disk;
- whether names compare byte by byte (`Z` before `a`) or without regard to letter case;
- where a subfolder's files fall: sorted by their whole path, before the folder's own files, or
  after them;
- whether the base game's files and a mod's are sorted together into one list, or the base
  game's are read first and the mod's after.

Hint: modders commonly state that all files of a folder, from the game and every mod, are
sorted together by file name and read in that order, so a mod names its file `zz_…` to be read
last.

The index needs the order for every rule that says "the later definition": rules 5 and 7, and
a define set twice (rule 6).

### 5. A key defined again in a keyed database

**Open: experiments 2 and 3.** The executable's generic database (`jomini/core/game_database.h`)
logs `Overriding entry '{}' for database '{}' in '{}'`: when a key is read that the database
already holds, the new definition overrides the entry, and the message names the file it came
from. Rank 1 evidence that a later definition of a key overrides an earlier one in this
database. It does not say:

- which folders are read through this database and which have readers of their own (the spec
  says nothing about it; rule 6 lists the folders whose own `.info` describes another rule);
- whether the override replaces the whole record or reads the new fields over the old ones;
- which definition is the later: that is rule 4.

Measured, rank 4: the base game itself defines some keys twice.

| Folder | Twice in one file | In two files |
| --- | --- | --- |
| `common/coat_of_arms/coat_of_arms` | 168: 127 in `01_landed_titles.txt`, every second copy in the file's second half (from line 14,855 of 31,678); 39 in `90_dynasties.txt`; 2 in `99_historical_character_coa.txt` | 1: `von_bingen`, a full coat of arms in `90_dynasties.txt`, then pointed at the coat of arms of `c_worms` in `99_historical_character_coa.txt` |
| `common/modifier_definition_formats` | 13 | 0 |
| `common/landed_titles` | 2, in `07_pam_ecclesiastical_titles.txt` | 0 |
| Every other folder of `common/` in the spec's list, apart from the folders of rule 6 and `coat_of_arms/options` (a list of `atlas` blocks) | 0 | 0 |

The second copies gathered in the second half of a file, and a `99_` file re-pointing a `90_`
file's entry, read as written to be the later definition; but the base game's files cannot show
which copy the game uses. Hint: modders commonly state that for most folders the last
definition read wins and replaces the whole record ("LIOS"), and that some folders keep the
first ("FIOS").

### 6. Folders with their own documented rules

**Events: settled.** `<game dir>/events/_events.info`, lines 77 to 83: an event id defined more
than once is resolved by `id_override_priority`, an integer that is 0 by default and in every
unmodded event. The definition with the largest value overrides all the others: the whole event.
Two definitions of one id with the same value are an error; the catalogue's message for it is
quoted in [The evidence](#the-evidence). Measured: the base game sets no priority and defines no
event id twice, within a file or across files; `namespace` is the only key that repeats, and it
is not a record. Which of two equal-priority definitions the game then uses is not stated; the
game calls the case an error, so the index does not choose: it keeps both and marks the clash.

**Character history: settled.** `<game dir>/history/_characters.info`, lines 25 to 31: the same
rule with `history_override_priority`, with one difference: only the character's base
attributes, the fields listed above line 25 of that file, and the date of birth are overridden;
everything else from the definitions adds up. Equal priority is an error; the catalogue holds
the message "Duplicate character id {} found in history." Measured: the base game sets no
priority, and defines three character ids twice in one file, which the `.info` calls an error:
`bobo0050` in `history/characters/bobo.txt` (lines 647 and 781), `142193` in `galician.txt` (67
and 6,929), `orsini_2` in `italian.txt` (31,165 and 31,179).

**On-actions: settled, except one part.** `<game dir>/common/on_action/_on_actions.info`,
lines 106 to 119: an on-action's data may be declared in several files, but one on-action may
not have more than one trigger or more than one effect block; the file shows how a mod adds
effects to a base on-action without replacing its file. So every declaration of an
on-action, in any file, adds to it, and at most one of them may hold `trigger` and one
`effect`. Measured: the base game declares 10 on-actions in two or three files each (for
example `on_birth_child` in `child_birth_on_actions.txt`, `dlc/gdp/gdp_merchant_on_actions.txt`
and `dlc/pam/pam_on_actions.txt`), and `three_year_playable_pulse` twice in
`yearly_on_actions.txt`. **Open: experiment 4**: what happens to an on-action's other single
values (`fallback`, `fallback_event`, `weight_multiplier`) when two declarations set them.

**Defines: settled, field by field.** A define is the pair inside a group (`NGame = { START_DATE
= … }`), and a group written again sets only the defines it names. Measured: the base game
writes 19 groups in two files each with no define in both, for example `NRite` in
`common/defines/00_defines.txt` (line 838) and `common/defines/graphic/00_graphics.txt`
(line 1,250); if a later group replaced the earlier one whole, the base game would lose one
half of each. The executable's defines reader speaks of single values ("won't assign until
changed"). No define is set twice inside `game/`; the 46 set in both `jomini/` and `game/` are
the copies of rule 3. Which value wins when two files set the same define is rule 4's order.

**Container keys: settled, the entries add up.** In these folders the top-level key is a
container written in several files, and the records are the entries inside it. Measured: each
file holds different entries, and dropping all but one file's would leave the base game without
most of them.

| Folder | Container key | Files that write it |
| --- | --- | --- |
| `common/named_colors` | `colors` | 3 |
| `common/genes` | `special_genes` | 8 |
| `common/coat_of_arms/template_lists` | `coat_of_arms_template_lists` | 2 |
| `common/coat_of_arms/coat_of_arms` | `template` | 3 |

**Province terrain: settled, not keyed.**
`<game dir>/common/province_terrain/_province_terrain.info`, line 3: the folder is not a
regular keyed database; every file in it is read in order, each a mix of statements.

**History of titles and provinces: open, experiment 5.** `<game dir>/history/_history.info`:
every history file is a block of starting values followed by dated blocks whose values override
them from that date. Nothing says what happens to a title or province whose history is written
in two places. Measured: the base game does it, for titles 4 times within one file (for example
`c_worms` in `history/titles/k_east_francia.txt`, lines 723 and 871) and for provinces 5 times
within one file and 629 times across two files.

### 7. Localization

**Open: experiment 6.** The executable's localization reader (`pdx_localize.cpp`) logs
`Duplicate localization key. Key '%s' is defined in both '%s' and '%s'.`, `Key '%s' defined in
multiple files: '%s', '%s'` and `Discarded duplicate key: %s for language %s`, and treats a
folder named `replace` specially (`/replace/`, in `ReadLocalizationFolderHelper`). So a key
defined twice in one language is reported and one copy is discarded; the wording suggests the
copy read second is the one discarded. Not stated: which copy is kept, the order files are read
in (rule 4), and what the `replace` folder does.

Measured: the base game has no `replace` folder in any of its 12,467 localization files across
the three folders of rule 3, and no key defined in two files of one language except the 171 in
the copies of rule 3 (`jomini/` and `game/` at the same path). Hint: modders commonly state that
a key in a `localization/<language>/replace/` folder overrides the same key anywhere else, and
that otherwise the first copy read is kept.

### 8. `replace_path`

**Open: experiment 7.** The executable's descriptor reader knows the key `replace_path`, among
the keys of a DLC or mod descriptor, and logs `replace_path not implemented for MSGR_DLC. DLC:
%s`. No game file and none of the five corpus mods uses it, and no `.info` file describes it.
Not stated: which files it hides (those of the base game only, or also the `jomini/`,
`clausewitz/` and DLC copies), and whether it hides a folder's subfolders. Hint: modders
commonly state that `replace_path = "common/x"` in a mod's descriptor makes the game ignore the
base game's files in `common/x`; whether that includes `common/x/y` is disputed.

### 9. Letter case in paths

**Open: experiments 8a and 8b.** Measured: no path under `common/`, `events/`, `history/` or
`localization/` in the base game (16,653 files) has an upper-case letter, and no two paths in
`<game dir>` differ only in letter case, so the base game never asks the question. A mod can:
`Common/Traits/00_Traits.txt` beside the base game's `common/traits/00_traits.txt`. Nothing in
the game's files says whether that path matches for rule 1, or is read at all. On Windows the
file system itself ignores case for opening a file; whether the game's own comparison of a mod's
path with the base game's ignores it is not known on either system. MVP.md's lesson ("Look up
files without regard to letter case") is pychivalry's, for finding files, not a statement of the
game's rule.

### 10. DLC folders

**Settled for game 1.21.0.3.** Each DLC is a folder `<game dir>/dlc/<pack>/` with a descriptor
`<pack>.dlc` whose `path` names that folder (`path = "dlc/dlc003_fp1"`). The executable handles
DLCs and mods in one manager with one descriptor reader (`CDLCManager::InitializeMods()`,
`Folder not found for DLC/Mod %s:`). A DLC's files therefore sit at their path inside the pack:
`dlc/dlc003_fp1/music/in_game/fp1_music.txt` is `music/in_game/fp1_music.txt`.

Measured on the 23 packs: beside the descriptor and a thumbnail, their files are only under
`gfx/`, `music/` and `sound/`; no DLC file has the relative path of a base-game file or of
another pack's file; and the only top-level key a DLC file shares with the base game's files of
the same folder is `category` in `music/music_player_categories`, a repeated tag whose records
are the `id`s inside it, all different. So on this build the order of DLC against the base game
decides nothing.

Open, as part of experiment 7: whether a mod's file at a DLC file's relative path replaces it.

Which packs the game loads is the user's setting, not a rule of the files: the executable reads
`enabled_mods` and `disabled_dlcs` from the launcher's `dlc_load.json`, in the user's own game
data folder.

### 11. Duplicate keys within one file

Settled where rule 6 settles it: an event id or a character id defined twice in one file is the
error those rules describe. For every other keyed folder it is rule 5, and open: the generic
database's message names a file, so it applies within one file as across two, but which copy
wins is experiment 2's question.

## The experiments

All run on the analysis machine, on the owner's word, on game 1.21.0.3, with every DLC enabled
and only the probe mod in the playset. Each run starts a new game from the first bookmark with
the game's own launch procedure (`research/oracle/<version>/README.md` in `pdx-parser-re`), in
debug mode (`-debug_mode`) so that the console and `debug.log` are available, and keeps
`error.log`, `debug.log` and `game.log` from the logs folder.

Every file below is written by hand for the experiment; none is copied from the game. Script
files are UTF-8; localization files are UTF-8 with the byte-order mark, which the game asks for.
The names `test_value` and `tiny_gold_value_check` are static script values the base game
defines in `common/script_values/00_basic_values.txt` (5 and 10), `childhood_personality_age` one
it defines in `00_age_values.txt` (3). No base-game file in `common/script_values` sorts before
`000_` or after `zzz_`, by bytes or without regard to case.

### Probe mod A

`descriptor.mod`:

```text
version="1"
name="pychivalry override probe A"
supported_version="1.21.*"
```

**The report.** One decision every character sees, whose description prints each probe.
`common/decisions/pyc_probe_report.txt`:

```text
pyc_probe_report = {
    is_shown = { always = yes }
    is_valid = { always = no }
    effect = { }
    ai_check_interval = 0
    ai_will_do = { base = 0 }
}
```

`localization/english/pyc_probe_l_english.yml`:

```text
l_english:
 pyc_probe_report:0 "Override probe A"
 pyc_probe_report_desc:0 "two_files=[EmptyScope.ScriptValue('pyc_probe_two_files')|0] within_file=[EmptyScope.ScriptValue('pyc_probe_within_file')|0] early=[EmptyScope.ScriptValue('test_value')|0] late=[EmptyScope.ScriptValue('tiny_gold_value_check')|0] case_order=[EmptyScope.ScriptValue('pyc_probe_case_order')|0] sub_read=[EmptyScope.ScriptValue('pyc_probe_subfolder_read')|0] sub_1=[EmptyScope.ScriptValue('pyc_probe_subfolder_1')|0] sub_2=[EmptyScope.ScriptValue('pyc_probe_subfolder_2')|0] case_replace=[EmptyScope.ScriptValue('childhood_personality_age')|0] loc_two_files=$pyc_probe_loc_dup$ loc_over_base=$YES$ loc_replace=$NO$"
```

The form `[EmptyScope.ScriptValue('name')|0]` is the one the base game's own localization uses
(`trait_diplomatic_court_1_desc` in `localization/english/traits_l_english.yml`). A value that
does not exist prints 0 or nothing, and the error log names it.

What to record from every run: the report's description, word for word; every line of
`error.log` and `debug.log` that contains `pyc_`, `Overriding entry`, `Duplicate`,
`Discarded duplicate key`, or the name of a probed base value or key.

#### Experiment 1: the install's three folders (rule 3)

No file needed. Hover over the report decision's unmet requirement. The game's copy of
`TRIGGER_LINE_ACTIVE_FAILED` (in `game/localization/jomini/script_system/`) shows an icon before
the requirement; `jomini/`'s copy at the same path shows a red `X`.

| Seen | Means |
| --- | --- |
| An icon | The `game/` copy is used: `game/` is over `jomini/`, and rule 1 holds between them |
| A red `X` | The `jomini/` copy is used: the order is the other way, or both are read and the first copy of a key is kept |

#### Experiment 2: the order files are read in (rules 4, 5, 11)

Files, all under `common/script_values/`, one line each:

| File | Content |
| --- | --- |
| `pyc_order_a.txt` | `pyc_probe_two_files = 1` |
| `pyc_order_b.txt` | `pyc_probe_two_files = 2` |
| `pyc_within.txt` | `pyc_probe_within_file = 1` and, on the next line, `pyc_probe_within_file = 2` |
| `000_pyc_early.txt` | `test_value = 7771` |
| `zzz_pyc_late.txt` | `tiny_gold_value_check = 7772` |
| `pyc_case_Z.txt` | `pyc_probe_case_order = 1` |
| `pyc_case_a.txt` | `pyc_probe_case_order = 2` |
| `pyc_sub/aaa.txt` | `pyc_probe_subfolder_read = 9` and `pyc_probe_subfolder_1 = 1` |
| `pyc_z.txt` | `pyc_probe_subfolder_1 = 2` |
| `pyc_m.txt` | `pyc_probe_subfolder_2 = 1` |
| `pyc_zz_sub/aaa.txt` | `pyc_probe_subfolder_2 = 2` |

| Probe | Seen | Means |
| --- | --- | --- |
| `two_files` | 2 / 1 | Of two files of one mod folder, the one later in name order wins / the earlier wins |
| `within_file` | 2 / 1 | Within one file the later definition wins / the earlier wins |
| `early`, `late` | 7771, 7772 | The base game's files are read first, then the mod's, whatever their names, and the later wins |
| | 5, 7772 | The base game's and the mod's files are sorted together by name, and the later wins |
| | 5, 10 | The first definition read wins, and the base game's files are read first |
| | 7771, 10 | Sorted together by name, and the first wins |
| `case_order` | 2 / 1 | Names compare byte by byte (`Z` before `a`) / without regard to case. Read with `two_files`: if the earlier wins, the meanings swap |
| `sub_read` | 9 / 0 | Files in a subfolder of `common/script_values` are read / are not |
| `sub_1`, `sub_2` | 2, 2 | Files sort by their whole relative path |
| | 1, 2 | A folder's own files are read before its subfolders' |
| | 2, 1 | A folder's subfolders are read before its own files |

The `Overriding entry` lines, if the game logs them, say the same independently: one line per
key defined twice, naming the database and the file of the definition that won.

#### Experiment 3: whole record or field by field (rule 5)

`common/decisions/pyc_fields_a.txt`:

```text
pyc_probe_fields = {
    desc = pyc_probe_fields_desc_from_a
    is_shown = { always = yes }
    is_valid = { always = no }
    effect = { }
    ai_check_interval = 0
    ai_will_do = { base = 0 }
}
```

`common/decisions/pyc_fields_b.txt`: the same, without the `desc` line. Localization, added to
`pyc_probe_l_english.yml`:

```text
 pyc_probe_fields:0 "Fields probe"
 pyc_probe_fields_desc_from_a:0 "FIELDS MERGED: the description set only in file a survived"
 pyc_probe_fields_desc:0 "WHOLE RECORD REPLACED: the default description key is used"
```

A decision's description defaults to `<key>_desc` (`common/decisions/_decisions.info`, the
entry for `desc`). If experiment 2 shows the later file wins, the description open in the
decisions window answers the question. If it shows the earlier file wins, move the `desc` line
to file b instead and read it the same way. The same pair, written for a trait, a scripted
effect or any other folder, answers it for that folder; the `Overriding entry` lines name each
folder's database.

#### Experiment 4: an on-action's single values (rule 6)

```text
# common/on_action/pyc_on_action_a.txt
pyc_probe_on_action = { fallback = pyc_probe_fallback_a }
pyc_probe_fallback_a = { effect = { debug_log = "pyc probe: fallback from file a" } }

# common/on_action/pyc_on_action_b.txt
pyc_probe_on_action = { fallback = pyc_probe_fallback_b }
pyc_probe_fallback_b = { effect = { debug_log = "pyc probe: fallback from file b" } }
```

and a decision that fires it, `common/decisions/pyc_probe_fire.txt`:

```text
pyc_probe_fire = {
    is_shown = { always = yes }
    is_valid = { always = yes }
    effect = { trigger_event = { on_action = pyc_probe_on_action } }
    ai_check_interval = 0
    ai_will_do = { base = 0 }
}
```

Take the decision. The probe on-action fires no event, so its fallback runs
(`_on_actions.info`, the entry for `fallback`: it is called when the on-action runs no event
or on-action). `debug.log` shows which fallback ran, or both, or an error about the second value.

#### Experiment 5: a history written in two places (rule 6)

`history/titles/zzz_pyc_history.txt`:

```text
k_east_francia = { 1.1.1 = { } }
d_west_franconia = { 866.1.1 = { holder = 0 } }
```

The base game's `history/titles/k_east_francia.txt` gives `k_east_francia` the holder 90107
from 843.8.11, and `d_west_franconia` a holder before 867. At the start of the first bookmark,
look at both titles' holders.

| `k_east_francia` | `d_west_franconia` | Means |
| --- | --- | --- |
| Held by 90107 | Not held | The mod's entries are added to the base game's |
| Not held | Not held | The mod's block replaced the base game's block for each title |
| Held by 90107 | Held as without the mod | The base game's block is kept and the mod's discarded |

The same file, with a province id and `culture` instead of a title and `holder`, answers it for
`history/provinces`.

#### Experiment 6: localization (rule 7)

Four files, each starting with the line `l_english:` and holding the entries below, each entry
on its own line indented by one space:

| File | Entries |
| --- | --- |
| `localization/english/pyc_loc_a_l_english.yml` | `pyc_probe_loc_dup:0 "A"` |
| `localization/english/pyc_loc_b_l_english.yml` | `pyc_probe_loc_dup:0 "B"` |
| `localization/english/zzz_pyc_loc_l_english.yml` | `YES:0 "MOD FILE WINS"` and `NO:0 "MOD FILE"` |
| `localization/english/replace/pyc_replace_l_english.yml` | `NO:0 "REPLACE FOLDER WINS"` |

`YES` and `NO` are base-game keys (`localization/english/core_l_english.yml`), whose English
texts are the words "Yes" and "No".
Read each answer with experiment 2's order: `zzz_` sorts after every base-game localization file.

| Probe | Seen | Means |
| --- | --- | --- |
| `loc_two_files` | A / B | Of two files, the earlier in name order keeps its copy / the later does |
| `loc_over_base` | `MOD FILE WINS` / `Yes` | The mod's copy of a base-game key is used / the base game's is |
| `loc_replace` | `REPLACE FOLDER WINS` / `MOD FILE` / `No` | The `replace` folder's copy beats every other / the mod's ordinary file beats it / the base game's copy is kept over both |

The `Duplicate localization key` and `Discarded duplicate key` lines name the files involved.

#### Experiment 8a: letter case in a file name (rule 9)

Also in probe mod A: `common/script_values/00_AGE_VALUES.txt`, holding
`pyc_probe_case_replace = 1`. The base game's `common/script_values/00_age_values.txt` sets
`childhood_personality_age = 3`.

| Probe | Seen | Means |
| --- | --- | --- |
| `case_replace` | 3 | The mod's `00_AGE_VALUES.txt` did not replace the base game's `00_age_values.txt`: paths compare with their case |
| | 0 | It replaced it: paths compare without regard to case |

Experiment 8b, a folder written in upper case, needs its own mod (probe mod C, below): on
Windows one mod folder cannot hold both `common/` and `Common/`.

### Probe mod B: `replace_path` (rule 8), and a mod file at a DLC file's path (rule 10)

Run alone, without probe mod A. `descriptor.mod`:

```text
version="1"
name="pychivalry override probe B"
supported_version="1.21.*"
replace_path="common/script_values"
replace_path="common/decisions"
replace_path="music/music_player_categories"
```

Files: the report decision and its localization from probe mod A, with the description reduced
to `test=[EmptyScope.ScriptValue('test_value')|0]`; and `common/decisions/zzz_pyc_rp.txt`
holding two minimal decisions (the report's fields) under two base-game keys:
`renounce_clerical_chastity_vow_decision`, which the base game defines in
`common/decisions/clerical_chastity_decisions.txt`, and
`struggle_iberia_ending_hostility_decision`, which it defines in
`common/decisions/dlc_decisions/03_fp2_decisions.txt`, a subfolder. Hiding every base script
value and decision makes the game report many errors; the run still answers the questions. The
two `Overriding entry` rows below can be read only if experiment 2 found that the game logs
those lines; otherwise the decisions window answers them, by whether each base decision's own
title or the probe's shows.

| Seen | Means |
| --- | --- |
| The report shows `test=0` | `replace_path` hid the base game's `common/script_values` files |
| `test=5` | It did not |
| An `Overriding entry` line for `renounce_clerical_chastity_vow_decision` | The base game's top-level decision files were still read |
| An `Overriding entry` line for `struggle_iberia_ending_hostility_decision` | Files in a subfolder of a replaced path are still read: `replace_path` does not reach subfolders |
| The in-game music player still lists the base category `ck3_base_game_soundtrack` | The base game's `music/music_player_categories` files were not hidden |
| It still lists DLC categories such as `fp1_mood_soundtrack` | `replace_path` does not hide a DLC's files |

For rule 10, the same mod without the `replace_path` lines and with a file
`music/music_player_categories/fp1_music_categories.txt` holding one category with a new `id`:
if the music player loses `fp1_mood_soundtrack` and shows the new category, a mod's file
replaces the DLC file at the same relative path.

### Probe mod C: a folder written in upper case (rule 9)

Run alone. Its `descriptor.mod` names it "pychivalry override probe C"; every one of its folders
under the mod is spelled with capitals: `Common/Script_Values/pyc_upper_folder.txt`, holding
`pyc_probe_upper_folder = 1`, and the report of probe mod A as
`Common/Decisions/pyc_probe_report.txt`, its description reduced to
`upper_folder=[EmptyScope.ScriptValue('pyc_probe_upper_folder')|0]`; the localization stays in
`localization/english/`.

| Seen | Means |
| --- | --- |
| The report is listed and shows `upper_folder=1` | A mod folder written `Common/Script_Values` is read as `common/script_values` |
| The report is not listed | Folders whose case differs from the game's are not read |

The analysis machine runs Windows, so experiments 8a and 8b answer for Windows only. The same
probes on Linux need a game launch on a Linux machine, which the plan does not provide: that is
a decision for the owner.

## What this means for step 3

The index depends on rules 3, 4, 5, 7, 8 and 9: which copy of the base game is read, which of two
definitions is the one in force, and which files a mod hides. They are open, so the step stops
after this item, as its brief requires, and does not build on a guess. Items 3.2 to 3.10 start
once the owner has had the experiments run, or has decided otherwise.

What is settled already holds for the index when it is built: rules 1, 2 and 10; and for events,
character history, on-actions (apart from their single values), defines, container keys and
province terrain, rule 6.
