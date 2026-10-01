# Release record 2.0.0 (branch `agents/ck3-tooling`)

What was verified before the 2.0.0 merge, with the command behind each number. The tag is
created after the merge, not on the branch.

## Versions

`packages/engine/package.json` 2.0.0, `vscode-extension/package.json` 2.0.0 (dependency
`pychivalry-engine` 2.0.0), spec package CK3 1.20.0.2.

## CI

- GitHub Actions run 36928472075 on commit 9b7fb4d: success on ubuntu-latest, windows-latest
  and macos-latest, every step (install, engine build, engine lint and format check, engine
  tests, diagnostics reference check, extension lint and format check, webpack, test compile,
  unit tests, integration tests):
  https://github.com/Cyborgninja21/pychivalry/actions/runs/36928472075
- Local, after `rm -rf vscode-extension/dist packages/engine/dist tools/dist && npm ci`:
  `task ci` exit 0: engine 307 passing, 1 pending (the vanilla acceptance re-parse, which
  needs `CK3_VANILLA_DIR`); diagnostics reference 42 pages up to date; extension lint and
  format clean; extension unit tests 294 passing.
- Local `xvfb-run -a task test:integration` (VS Code 1.140.0): 96 passing, 0 failing.

## VSIX

`task package` (`npm run package` in `vscode-extension/`: production webpack bundle, then
`vsce package --no-dependencies`, @vscode/vsce 4.0.0) writes
`vscode-extension/ck3-language-support-2.0.0.vsix`: 1,496,288 bytes, 37 zip entries (the 35
files below plus `extension.vsixmanifest` and `[Content_Types].xml`). Bundles:
`dist/extension.js` 372,792 bytes, `dist/server-main.js` 489,953 bytes.

`vsce ls --no-dependencies` (sizes from the archive, uncompressed bytes):

| File | Bytes |
| --- | --- |
| `CHANGELOG.md` | 5,639 |
| `LICENSE` | 11,357 |
| `README.md` | 7,107 |
| `language-configuration-localization.json` | 501 |
| `language-configuration.json` | 553 |
| `package.json` | 16,210 |
| `dist/extension.js` | 372,792 |
| `dist/extension.js.map` | 1,439,831 |
| `dist/server-main.js` | 489,953 |
| `dist/server-main.js.map` | 1,985,996 |
| `snippets/ck3-localization.json` | 3,796 |
| `snippets/ck3.json` | 7,908 |
| `syntaxes/ck3-localization.tmLanguage.json` | 5,345 |
| `syntaxes/ck3.tmLanguage.json` | 4,893 |
| `dist/data/animations.yaml` | 26,696 |
| `dist/data/concepts/categories.yaml` | 33,313 |
| `dist/data/concepts/concepts.yaml` | 333,910 |
| `dist/data/engine/ck3-spec.json.gz` | 321,662 |
| `dist/data/engine/ck3-spec.sha256` | 89 |
| `dist/data/engine/schema.json` | 12,767 |
| `dist/data/icons/categories.yaml` | 124,231 |
| `dist/data/icons/icons.yaml` | 621,193 |
| `dist/data/traits/childhood.yaml` | 1,533 |
| `dist/data/traits/education.yaml` | 10,338 |
| `dist/data/traits/fame.yaml` | 16,926 |
| `dist/data/traits/health.yaml` | 12,568 |
| `dist/data/traits/lifestyle.yaml` | 7,555 |
| `dist/data/traits/personality.yaml` | 9,778 |
| `dist/data/traits/special.yaml` | 18,103 |
| `dist/data/mods/mod_registry.yaml` | 9,683 |
| `dist/data/mods/carnalitas/effects.yaml` | 6,349 |
| `dist/data/mods/carnalitas/opinion_modifiers.yaml` | 2,782 |
| `dist/data/mods/carnalitas/scopes.yaml` | 1,813 |
| `dist/data/mods/carnalitas/traits.yaml` | 4,009 |
| `dist/data/mods/carnalitas/triggers.yaml` | 5,248 |

## Install and activation

With the VS Code 1.140.0 build that the integration tests download
(`vscode-extension/.vscode-test/vscode-linux-x64-1.140.0/bin/code`, separate
`--extensions-dir` and `--user-data-dir`. The only other VS Code CLI here is the WSL remote
CLI of the operator's Windows VS Code Insiders, which was not touched):

- `code --install-extension ck3-language-support-2.0.0.vsix`: "Extension
  'ck3-language-support-2.0.0.vsix' was successfully installed."; `--list-extensions
  --show-versions`: `cyborgninja21.ck3-language-support@2.0.0`.
- `xvfb-run -a code --wait --disable-workspace-trust "example mod"` (folder only): the
  extension-host log shows `ExtensionService#_doActivateExtension
  cyborgninja21.ck3-language-support, startup: true, activationEvent:
  'workspaceContains:**/descriptor.mod'`; the CK3: Index channel shows "CK3 spec package
  1.20.0.2 loaded", "Found 54 CK3 files in example mod", "Indexed 54 files", "Workspace
  initialized successfully".

## Step 5.0: corrected spec package adopted

The vendored package was replaced by the corrected one from pdx-parser-re (`agents/ck3-tooling`
at 9f476ea): package JSON sha256 `18239875f2aba05e10292dd63267567d6ff58dff50d8e55df2e1df4b33246673`
(was `f43f2aecb0b8357188515a308a8f8dd442b73bab44f90b00061be97f41465e1a`), `package_format` 2,
13 `keyword_templates`; `src/check/supplement.ts` is deleted. Re-verified on the branch:

- `task ci` exit 0: engine 314 passing, 1 pending; diagnostics reference 42 pages up to date;
  extension unit tests 297 passing.
- `xvfb-run -a task test:integration` (VS Code 1.140.0, VS Code host variables unset):
  96 passing.
- Vanilla acceptance (`node packages/engine/scripts/vanilla-acceptance.js <game dir>`, CK3
  1.20.0.2 `common/`, `events/`, `history/`): 4,035 files, one parse error
  (`history/characters/japanese.txt`), unchanged; registry findings 19 → 14 (the two
  `has_required_heir_governments` and three `has_scheme_countermeasure_parameter` findings are
  gone: both names are in the corrected triggers bucket); none added. Record:
  `packages/engine/test/acceptance/vanilla-1.20.0.2.json`.
- `npm run package` in `vscode-extension/`: `ck3-language-support-2.0.0.vsix` 1,499,619 bytes,
  37 zip entries; `dist/extension.js` 372,792 bytes, `dist/server-main.js` 490,401 bytes,
  `dist/data/engine/ck3-spec.json.gz` 323,169 bytes, `dist/data/engine/schema.json` 14,200
  bytes, `readme.md` 5,006 bytes (the rewritten user README).
- Installed into the same VS Code 1.140.0 build (separate `--extensions-dir`/`--user-data-dir`):
  `cyborgninja21.ck3-language-support@2.0.0`; opening `example mod` activates it on
  `workspaceContains:**/descriptor.mod` and the CK3: Index channel shows "CK3 spec package
  1.20.0.2 loaded", "Found 54 CK3 files in example mod", "Indexed 54 files", "Workspace
  initialized successfully". The bundled server answers `initialize` with
  `serverInfo {"name":"CK3 Language Server (TypeScript)","version":"2.0.0"}`.
