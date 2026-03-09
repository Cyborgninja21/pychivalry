# CK3 Game Concepts Data

This directory contains extracted game concept definitions from your CK3 installation.

## Files

- `concepts.yaml` - All game concepts with localized text
- `categories.yaml` - Concepts organized by theme

## What are Game Concepts?

Game concepts are special localization keys used for in-game tooltips and links:

```
[vassal|E]     -> Links to 'game_concept_vassal'
[opinion|E]    -> Links to 'game_concept_opinion'
[de_jure|E]    -> Links to 'game_concept_de_jure'
```

## Usage in Mods

This data enables:
- **Validation**: Warns when you reference a non-existent concept
- **Completions**: Auto-complete concept names in `[...|E]` patterns
- **Hover Docs**: Shows concept description when you hover over it

## Copyright Notice

Game concept data is © Paradox Interactive AB. This data is extracted from your
personal CK3 installation for modding assistance only. Do not redistribute.

## Regenerating

Run: `CK3: Extract Localization Data from CK3 Installation` in VS Code
Or: `npx ts-node tools/extract-concepts.ts --ck3-path "/path/to/ck3"`
