# Fixture mods

Small hand-written mods, one behaviour each. One folder per mod, named for what it shows.

```text
fixtures/mods/<name>/
  README.md        what it shows, and what a correct tool reports on it
  descriptor.mod
  common/ events/ localization/ ...   the game's own layout
  expected.json    where a test compares whole output: the findings a correct tool reports
```

## Check pairs

A check is tested on a pair of mods: one it fires on and one it is silent on.

```text
fixtures/mods/<check-name>-bad/
fixtures/mods/<check-name>-good/
```

The good mod differs from the bad one only in the defect. The check inventory
(`docs/checks.md`, build step 4) names the pair of every check.

## Carried over from release 2.3.0

The old tests' fixture mods are data and are carried over by the step that owns the behaviour,
rewritten to this layout. Where one is carried over, its README says which file under
`legacy/` it came from.

Nothing is here yet. Build step 2, the parser, adds the first.
