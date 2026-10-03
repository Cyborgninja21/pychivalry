# Mock CK3 base game

A stand-in for the CK3 `game` directory (the folder holding `common/`).

- Graphics-file check (GFX001): `gfx/interface/icons/mock_base_icon.dds` is a base-game file
  and `dlc/dlc001_mock/gfx/interface/icons/mock_dlc_icon.dds` a DLC file. The `.dds` files
  are placeholders; only their existence matters.
- Base-game knowledge of the plug-ins (2.2, `server/data/base-game.ts`):
  `localization/english/` (CK4100), `common/traits/` (CK3800), `common/event_themes/` and
  `common/event_backgrounds/` (CK3430, CK3431, CK3433), `gfx/portraits/portrait_animations/`
  (CK3422). Each holds a handful of entries; the theme, background and animation names are real
  1.20.0.2 names.

No scripted effect or trigger is defined here, so the engine's base-game lookups find nothing.
