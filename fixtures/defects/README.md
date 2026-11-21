# The planted-defect mod

The mod the scored agent-use run is graded on. Build step 6 writes it.

```text
fixtures/defects/
  mod/             the mod as an agent receives it: 20 to 30 defects, one per check code,
                   and lines that look wrong and are not
  reference/       the same mod with every defect fixed; it passes every grader
  manifest.json    each planted defect: the file, the check code, the text it sits on;
                   and each look-alike line
```

## How it is used

For each trial the scored run makes a fresh copy of `mod/` with no history, and an AI agent is
asked to fix it using pychivalry's agent server. A trial passes when:

1. the checker reports zero errors;
2. every planted defect is gone;
3. nothing outside the planted lines changed;
4. the look-alike lines are untouched;
5. no content was deleted.

The graders are code and have their own tests, which run in public CI: they pass on
`reference/` and fail on the untouched `mod/`. The scored runs themselves call a model, so they
are started by a person or an agent and never by CI.

## Rules

- One defect per check code, so a failure names the check.
- A defect added here is added to `manifest.json` and fixed in `reference/` in the same change.
- The mod is written by hand, like every fixture.

Nothing is here yet.
