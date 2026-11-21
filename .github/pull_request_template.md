## What this changes

<!-- One or two sentences. For a build step, name the step and its items in docs/PLAN.md. -->

## How it was checked

<!-- What you ran and what it showed. For a step, go through its "Done when" list. -->

## Checklist

- [ ] `task ci` passes.
- [ ] Every new error or warning names its game evidence; anything without it is advice.
- [ ] No list of game keywords was added to the code.
- [ ] A new check has its fixture pair and its row in `docs/checks.md`.
- [ ] Records were re-run and committed if the change affects a suite that needs game files.
- [ ] `docs/` is updated: the Progress table, `CHANGELOG.md`, the user guide for anything a
      user can see, `docs/references/` for a new source, `docs/decisions.md` for a decision.
- [ ] Nothing committed names a private machine, path or person, and no game or mod files are
      included.
- [ ] Nothing under `legacy/` changed.
