# Colour notations: the evidence behind the colour provider

The colour provider (`vscode-extension/src/server/lsp/color-provider.ts`, issue #79) shows
a swatch and a colour picker on colour values. Which notations it reads, with which value
ranges, and under which keys a bare `{ … }` list counts as a colour were decided from a
scan of the CK3 1.20 base game and the real-mod corpus, not guessed.

## The scan

```sh
node tools/color-scan.js "<game dir>" /path/to/ck3-corpus \
    --json Documentation/developer-guide/color-scan.json \
    --keys vscode-extension/src/server/data/color-keys.json
```

`tools/color-scan.js` reads every `.gui`, `.gfx`, `.txt` and `.asset` file under the game's
`gui/`, `gfx/` and `common/` (5,830 files) and under each corpus mod (Balance of Power UI 7,
Divine Intervention 154, Elf Destiny 610, RICE 1,382, Viet Events 67) with a token scan of
its own (no parser, so GUI syntax the engine parser rejects is read too). The full output,
with value ranges, decimal places and the key evidence, is
[color-scan.json](color-scan.json). No file of the game has the `.gfx` extension; no
colour value was found in an `.asset` file, so those rows are absent.

## Notations found

Count of colour values per notation (prefixed values under any key; bare lists, hex
strings and names only under a colour key, see below; named-colour definitions counted
whatever their key):

| Source | Files | `bare-unit` | `bare-byte` | `bare-other` | `rgb` | `hsv` | `hsv360` | `hex` | `named` |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| game | .gui | 489 | 8 | 2 | 0 | 0 | 0 | 0 | 0 |
| game | .txt | 1285 | 17809 | 0 | 77 | 997 | 1 | 9 | 16531 |
| corpus:balance-of-power-ui | .gui | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| corpus:divine-intervention | .gui | 19 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| corpus:divine-intervention | .txt | 17 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| corpus:elf-destiny | .gui | 99 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| corpus:elf-destiny | .txt | 14 | 236 | 0 | 107 | 1 | 0 | 0 | 320 |
| corpus:rice | .gui | 14 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| corpus:rice | .txt | 58 | 486 | 0 | 18 | 1 | 0 | 0 | 474 |
| corpus:viet-events | .txt | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| **All** | | **1997** | **18539** | **2** | **202** | **999** | **1** | **9** | **17329** |

- `bare-unit`: `{ r g b }` / `{ r g b a }` with r, g, b between 0 and 1.
- `bare-byte`: `{ r g b }` / `{ r g b a }` with r, g, b integers, one above 1, none above 255.
- `bare-other`: any other three- or four-number list under a colour key.
- `rgb`, `hsv`, `hsv360`: `rgb { … }`, `hsv { … }`, `hsv360 { … }`. Only the lower-case
  spellings occur (202, 999 and 1 times); the engine parser also accepts the upper-case ones.
- `hex`: all nine are `hex { rrggbb }` (`fog_color` in `gfx/map/environment`). The string
  forms `"#rrggbb"` and `0xrrggbb` occur **zero** times.
- `named`: a word naming a colour of a `common/named_colors` file (`color1 = white` in coats
  of arms). The named-colour files define 122 names (78 as bare 0..1 lists, 14 as byte
  lists, 29 as `hsv`, 1 as `hsv360`); the base game alone defines 112.

## Value ranges, and what is implemented

| Notation | Values seen (count, components) | Range observed | Implemented range | In range |
| --- | --- | --- | --- | ---: |
| `bare-unit` | 1,997 (1,318 × 3, 679 × 4) | r g b 0..1; alpha 0.1..2 (6 above 1) | r g b a in 0..1 | 1,991 |
| `bare-byte` | 18,539 (18,531 × 3, 8 × 4) | r g b 0..255 integers; alpha 0.8 (all 8) | r g b integers 0..255, alpha 0..1 | 18,539 |
| `bare-other` | 2 (`{ 1.77 1.77 1.80 1 }`) | overbright multipliers | not a colour: no swatch | 0 |
| `rgb` | 202 (all × 3) | integers 0..255 | three integers 0..255 | 202 |
| `hsv` | 999 (995 × 3, 4 × 4) | h up to 29, v up to 12 (light intensities) | h s v a in 0..1 | 595 |
| `hsv360` | 1 (`hsv360{ 021 074 045 }`) | h 21, s 74, v 45 | h 0..360, s v 0..100 | 1 |
| `hex` | 9 | six digits | `hex { rrggbb }` | 9 |
| `named` | 17,329 | names of `common/named_colors` | the named colours of the base game and the workspace | 17,329 |

The decisions, per notation:

- **A bare list is 0..1 or 0..255 by its own values**, not by its key: when r, g and b are
  all between 0 and 1 it is a 0..1 list (1,997 values, 48 of them all-integer such as
  `{ 0 0 1 }`); when they are integers with one above 1 and none above 255 it is a 0..255
  list (18,539, the landed-title and culture colours). The alpha of a byte list is 0..1:
  the eight four-value byte lists all end in `0.8` (`tintcolor = { 200 20 0 0.8 }`).
- **Values outside the ranges get no swatch**: the two overbright lists, the six 0..1
  lists with an alpha of 2, and 404 `hsv` values whose v is a light intensity (up to 12, in
  `gfx/map` and portrait environments) or whose h is above 1 (`hsv { 29 0.867 0.353 }` in
  `common/terrain_types`). The picker could not give them back.
- **`rgb` has three components** (no four-value `rgb` occurs); `hsv` has three or four.
- **`hsv360`** occurs once; its ranges are those of its name (degrees and percentages),
  consistent with the one value.
- **Hex strings are not implemented**: they occur zero times.

Presentations (what the picker writes back) put the value's own notation first, written
the way the value was (prefix spelling and the gap before `{`, number of components,
decimal places, zero padding), then the alternatives of the file kind, in evidence order:
`.gui` files offer only bare 0..1 lists (the base game's GUI files use no prefix at all);
other files offer byte lists, 0..1 lists, `hsv` and `rgb`. A notation that cannot hold the
colour (an alpha below 1 in `rgb`, `hsv360`, `hex` or a name; a byte list whose bytes would
all be 0 or 1) is left out. A named value offers the names of equal colours first.

## Colour keys

A prefixed value (`rgb`, `hsv`, `hsv360`, `hex`) is a colour under any key. A bare list or a
name is a colour only under a **colour key**, derived from the data in two rules:

1. every key that is ever written with an `rgb`, `hsv`, `hsv360` or `hex` value;
2. in `.gui`, `.gfx` and `.asset` files only, every key whose own name contains
   `color`/`colour` and whose values are three- or four-number lists in at least 90 % of
   its occurrences that are not data bindings (`"[…]"`), at least three times. GUI
   properties are never written with a prefix, so rule 1 cannot find them.

Script keys need rule 1: `hair_color`, `eye_color` and `skin_color` (DNA, 1,072 lists each)
are four-number palette coordinates (`{ 109 249 109 249 }`), not colours, and rule 1
excludes them. The entries of the `colors = { … }` block of a `common/named_colors` file
are named-colour definitions and are colours whatever their key.

The 25 keys (rule in brackets), written to
`vscode-extension/src/server/data/color-keys.json` with each key's evidence:

`ambient_neg_x` (1), `ambient_neg_y` (1), `ambient_neg_z` (1), `ambient_pos_x` (1),
`ambient_pos_y` (1), `ambient_pos_z` (1), `color` (1), `color1` (1), `color2` (1),
`color3` (1), `fog_color` (1), `fontcolor` (2), `fonttintcolor` (2), `levels_max` (1),
`levels_min` (1), `map_color` (1), `shadow_ambient_neg_x` (1), `shadow_ambient_neg_y` (1),
`shadow_ambient_neg_z` (1), `shadow_ambient_pos_x` (1), `shadow_ambient_pos_y` (1),
`shadow_ambient_pos_z` (1), `sun_color` (1), `tintcolor` (2), `travel_danger_color` (1).

## The provider's two paths, measured on the base game's `gui/`

The engine parser reports errors on most GUI files, so the provider reads a file from the
engine's tree when it parses without errors and from the engine lexer's tokens when it does
not. On the base game's `gui/` (416 files):

```sh
task compile:tests
node tools/color-count.js "<game dir>/gui" --game "<game dir>"
```

| Path | Files | Colour values |
| --- | ---: | ---: |
| tree (no parse errors) | 89 | 44 (37 `bare-unit`, 7 `bare-byte`) |
| token scan (parse errors) | 327 | 447 (446 `bare-unit`, 1 `bare-byte`) |

On the 89 files the tree path read, the token scan finds the same 44 values at the same
ranges (0 files disagree). The output is [color-count-base-gui.json](color-count-base-gui.json).
The 491 values are the 497 in-range GUI values of the scan above less the six 0..1 lists
with an alpha of 2.
