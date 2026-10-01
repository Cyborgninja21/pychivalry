# The spec package

pychivalry's only source of CK3 script vocabulary is one generated file, the **spec package**
(`ck3-spec-<version>.json`). It is built by
[pdx-parser-re](https://github.com/Cyborgninja21/pdx-parser-re) from one game executable,
identified by its sha256, and bundled by the engine core (`packages/engine`). No trigger,
effect, scope, modifier, directory or error text is hand-maintained in this repository.

The bundled package is CK3 **1.20.0.2** (`ck3-1.20.0.2.exe`, sha256 `AE1BA6FF…E81B2D`; package
JSON sha256 `18239875…3246673`).

## Format

`package_format` 2 (2 adds `keyword_templates`). The package's own JSON Schema (draft 2020-12) is vendored as
`packages/engine/spec/schema.json`; `validateSpecPackage()` in the engine checks a package
against it at load time. Top-level keys:

| Key | Content (1.20.0.2 counts) |
| --- | --- |
| `package_format` | Format version (2). |
| `manifest` | Game, version, the executable's name, size and sha256, the address ranges of the token and modifier tables, the tool versions (Ghidra, ghidra-cli, the analysis profile hash), the sha256 of every source file and the generation date. |
| `buckets` | Six keyword buckets, each a map from name to `{doc}` (the engine's own documentation string, empty where the engine has none): `triggers` 1,447, `effects` 1,007, `links` 312, `lists` 377, `on_actions` 203, `modifiers` 609 (the modifier table, entries tagged `provenance`). |
| `modifier_templates` | 79 executable name templates (`stationed_%s_damage_mult`) for modifier names generated per database entry at load time. |
| `keyword_templates` | 13 trigger/effect families the engine registers once per key of a database at load time: `{template, bucket, keys, doc}`, e.g. `has_relation_%s` (triggers, keys `common/scripted_relations`), `add_%s_xp` (effects, keys `common/lifestyles`, filled with `diplomacy_lifestyle`). (template, keys) is the identity: `%s_perks` is listed for `common/lifestyles` and `common/dynasty_legacies`. |
| `iterator_prefixes` | `any_`, `every_`, `random_`, `ordered_`; an iterator is a prefix plus a name in `lists` (never `links`). |
| `multi_bucket` | 133 names registered in more than one bucket; lookups are by (name, context). |
| `directories` | 227 script directories: path, content type, load level, whether vanilla has files there, since which version. |
| `schema` | Per-directory record schema for 185 directories: allowed fields with their kind (`value`, `block`, `list`, `trigger_block`, `effect_block`, `enum`, `reference`), provenance (`engine` or `vanilla` in 1.20.0.2), vanilla usage counts, and `required` only where a parser message proves the engine checks it (`required_evidence`). |
| `errors` | The error-message catalogue: 1,967 parser and loader messages with a stable id, category, the exact text and since which version. |
| `retired` | 16 keywords removed in this version, with the bucket, the replacement (or none) and a note. |
| `noise_dropped` | Names the string scan found that are not keywords, with the reason they were dropped. |
| `scope_validity` | Reserved for per-keyword supported scopes; empty until a `script_docs` oracle run fills it (the known gap). |

## How the engine uses it

- `packages/engine/spec.config.json` names the package to bundle. By default it points at the
  vendored copy under `packages/engine/spec/`: `ck3-spec-<version>.json.gz` (gzipped because the
  pre-commit hook rejects files over 1 MB), `ck3-spec-<version>.sha256` and `schema.json`.
- `npm run build` in `packages/engine` runs `scripts/copy-spec.js`, which checks the sha256 of
  the uncompressed JSON against the checksum file and writes `dist/data/`. The extension's
  webpack build copies that to `vscode-extension/dist/data/engine/`.
- At run time `loadSpec()` / `defaultSpec()` give one `Spec` object per workspace with `has`,
  `bucketsOf`, `doc`, `isIterator`, `listBase`, `isModifier`, `directoryOf`, `schemaOf`,
  `message`, `retired`, `scopeValidity` and `version` (see `packages/engine/README.md`).
- `Spec.withOverlay()` layers extra names over the package (the extension uses it for mods
  found by the mod registry in `data/mods/`); the package's own entries always win.
- `Workspace.keywordTemplateFor()` accepts a name that fills a `keyword_templates` entry when
  the slot is a top-level key of a file under the template's `keys` folder in the workspace
  or the `--vanilla` base game (any fill is accepted when no base game is loaded).

## Adopting a new CK3 version

The package is regenerated in pdx-parser-re and then adopted here. The steps on the
pdx-parser-re side follow its Phase 1 and Phase 2 procedure (the `agents/ck3-tooling` work of
2026-10-01):

1. **Snapshot and analyse the new executable** (on the Windows analysis machine): import it
   into a fresh Ghidra project, dump the keyword registrar tables and the modifier table
   (`ModifierTable.java` in re-tools, `tools/python/derive_modifiers.py`), and build the
   keyword delta against the previous version (`keyword_delta.py`, `KEYWORD_DELTA.md`).
2. **Update `spec/`**: replace the six bucket files in `spec/keywords/` (each header carries
   the version, the executable sha256, the Ghidra and ghidra-cli versions and the profile
   hash from the delta folder's `MANIFEST.json`); regenerate `spec/directories.yml` from the
   loader-path strings (`tools/python/directories_from_strings.py`); refresh
   `spec/schema/<database>.yml` from the game snapshot (`tools/python/schema_inventory.py`);
   classify the parser messages into `spec/errors/parser_messages_<version>.tsv`
   (`tools/python/build_error_catalogue.py`); record removed keywords in `spec/retired.yml`.
   `tools/python/adopt_keywords.py` writes the bucket files from the delta folder.
3. **Build the package**: `python tools/python/build_spec_package.py` writes
   `spec/package/ck3-spec-<version>.json`, its `.sha256` and `schema.json`, and validates the
   output against the schema. `python tools/python/regression_check.py <repo> <scratch>`
   rebuilds it and must reproduce the committed bytes; `tools/python/compare_with_pychivalry.py`
   reports the difference against what pychivalry ships.

Then, in this repository:

4. Copy the three files into `packages/engine/spec/` (gzip the JSON:
   `gzip -9 -n -c ck3-spec-<version>.json > ck3-spec-<version>.json.gz`) and point
   `packages/engine/spec.config.json` at them. To try a package without vendoring it, point
   `spec.config.json` straight at the uncompressed JSON in a pdx-parser-re checkout.
5. `task engine:test` (unit, golden, corpus and CLI tests), then the vanilla acceptance run
   against the new game files: `node packages/engine/scripts/vanilla-acceptance.js "<game dir>"`
   (every vanilla `.txt` under `common/`, `events/` and `history/` must parse and check clean;
   its record is `packages/engine/test/acceptance/vanilla-<version>.json`).
6. Update the version strings that name the package (`packages/engine/README.md`, the root
   README, `Documentation/developer-guide/spec-package.md`), regenerate the diagnostics
   reference (`npm run docs:diagnostics`), run `task ci`, and note the adoption in
   `CHANGELOG.md`.
