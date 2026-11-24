# Grading results by hand for the judge's calibration

The scored authoring test ([tools/scored-run/README.md](../../tools/scored-run/README.md)) has a
**judge**: one more test session of your own Claude Code that reads a content request and what a
session wrote, and answers a few questions about it. The calibration measures how far that judge
can be trusted: you answer the same questions by hand, the judge answers them again, and the
record says how often the two of you agree. It is build step 9's item 9.6
([PLAN.md](../PLAN.md)). It starts test sessions, so it runs only when you choose; each counts
against your own Claude plan like any session you open.

The first scored authoring run (2026-11-24) kept none of its results, so there is nothing real to
grade yet. Until there is, grade the ten **hand-made** results described below: they were written
by hand for this, not by a test session, and some of them are deliberately wrong.

## Grading the hand-made results (now)

1. **Open** [fixtures/requests/calibration/README.md](../../fixtures/requests/calibration/README.md).
   It lists ten result folders, each with the request it answers and the questions to answer.
2. **Read each result** in `fixtures/requests/calibration/results/<name>/`: only its files, as
   the judge sees them. Do not look for a key: none is written down.
3. **Answer each question** with one of three answers:
   - `yes`: the files show the result does what the question asks;
   - `no`: the files show it does not (a wrong amount, the wrong character, a missing or extra
     part, texts that do not fit);
   - `cannot-tell`: the files do not show it either way (for example, the result calls a script
     defined nowhere in its files).
4. **Write the answers** into [fixtures/requests/calibration/grades.json](../../fixtures/requests/calibration/grades.json),
   replacing each `"?"` with `"yes"`, `"no"` or `"cannot-tell"`. Save it where it is. (Whether
   filled-in grades are committed is still your question in
   [decisions.md](../decisions.md#asked-awaiting-the-owner); until you answer it, leave the file
   uncommitted.) A sheet with a `?` left is refused before any test session starts.
5. **Run one command** from the repository's folder, with Claude Code 2.1.280 or later (the first
   run named the copy VS Code's Claude Code extension installed):

   ```sh
   SCORED_SESSION_LIMIT=3 SCORED_CLAUDE=<that Claude Code> SCORED_GRADES=fixtures/requests/calibration/grades.json task scored:calibrate
   ```

   It starts **10 judge test sessions**, one per result, each with session limit 3, on Fable 5.2
   (the judge you chose; `SCORED_JUDGE_MODEL` names another). It writes
   `records/scored/calibration.json`: for each question and over all, how often the judge agreed
   with you, and how often each of you said "cannot tell".

## Grading real results (after the next run)

A run keeps its results only when asked: add `SCORED_KEEP=true` to the authoring run's command,
and it prints the folder where each trial's mod is kept (`<request>-<n>/mod/`). The smallest set
worth calibrating on is one result of each of the twelve requests:

- `SCORED_TRIALS=1 SCORED_KEEP=true` added to the authoring run: **24 test sessions** (12 that
  write, 12 judge sessions);
- then the calibration of those 12 results: **12 more**, 36 in all. Or keep the results of the
  next full run (5 trials of each request, 120 test sessions) and grade any of them: one judge
  session for each result you grade.

Copy the results you grade into a folder beside a new grades file (the same format as
`grades.json`, each `result` a folder path from the grades file's folder), grade them without
reading the judge's answers first, and run the command above with `SCORED_GRADES` naming it. A
run without `SCORED_CONTINUE=true` writes a new `records/scored/authoring.json`: commit it if it is
the run you meant, or restore the committed one with `git checkout -- records/scored/authoring.json`.
