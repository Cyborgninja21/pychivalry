# Engine test mods

Copied from [pdx-parser-re](https://github.com/Cyborgninja21/pdx-parser-re) `test_mods/`
(`broken_syntax`, `unknown_trigger`, `unknown_effect`) at commit `642972a` on branch
`agents/ck3-tooling`; the files were last changed upstream in `d27a2b8` (2026-02-04). The
only change is the repository's pre-commit hook stripping trailing tabs from blank lines;
line numbers and content are otherwise identical. They are the golden corpus of `test/golden/golden.test.ts`: each mod must
yield exactly the diagnostics recorded in `test/golden/<mod>.json`.
