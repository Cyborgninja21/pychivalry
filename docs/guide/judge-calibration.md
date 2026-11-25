# Grading results by hand for the judge's calibration

The scored authoring test ([tools/scored-run/README.md](../../tools/scored-run/README.md)) has a
**judge**: one more test session of your own Claude Code that reads a content request and what a
session wrote, and answers a few questions about it. The calibration measures how far that judge
can be trusted: you answer the same questions by hand, the judge answers them again, and the
record says how often the two of you agree. It is build step 9's item 9.6
([PLAN.md](../PLAN.md)). It starts test sessions, so it runs only when you choose; each counts
against your own Claude plan like any session you open.

## The sheets, and which first

| Order | Sheet | Results | Answers | Judge test sessions | Record |
| --- | --- | --- | --- | --- | --- |
| 1 | [`fixtures/requests/calibration/grades.json`](../../fixtures/requests/calibration/README.md) | 10 **hand-made** results of six requests | 26 | 10 | `records/scored/calibration-hand-made.json` |
| 2 | [`fixtures/requests/calibration/run-2/grades.json`](../../fixtures/requests/calibration/run-2/README.md) | 12 **real** results of the second scored run, one of each of its twelve requests | 36 | 12 | `records/scored/calibration-run-2.json` |
| 3 | [`fixtures/requests/calibration/expert/grades.json`](../../fixtures/requests/calibration/expert/README.md) | 24 **hand-made** results of the twelve expert requests, two of each | 88 | 24 | `records/scored/calibration-expert.json` |

Grade the **hand-made sheet first**. Its results were written by hand for this, and some of them
are deliberately wrong or cannot be judged from their files: it is the only sheet on which a
right answer can be "no" or "cannot tell" by design, so it is the one that shows whether the judge
can say no at all. The second run's judge said yes to every question it was asked, and the real
results are what it said yes to; on their own they can show the judge agreeing with you, not that
it would notice a fault. The real sheet comes second, so that the real results are read with the
same care.

The third sheet is of the **expert requests**, added after the second run (decision 131). Its
results were written by hand too, and every one of them passes everything code checks: nothing the
checker reports, every expectation met. Some are right and some are wrong in a way only reading
what the script does shows: an effect given to the wrong character, a condition tested in the
wrong scope, an amount or a time that is not the one asked for. It is the sheet that asks most of
the judge, and the largest. You chose to grade all three before the release run (decision 135),
this one last.

The real results are **trial 1 of each request**, taken by number before any of them was read, so
none was picked for being good or bad. Each is the trial's mod as its session left it, with the
skills folder the run gave the session taken out. Grade them **before** you look at the judge's
answers in `records/scored/authoring.json`.

## Grading a sheet

1. **Open its page**: [fixtures/requests/calibration/README.md](../../fixtures/requests/calibration/README.md)
   for the hand-made sheet, [fixtures/requests/calibration/run-2/README.md](../../fixtures/requests/calibration/run-2/README.md)
   for the real one, [fixtures/requests/calibration/expert/README.md](../../fixtures/requests/calibration/expert/README.md)
   for the expert one. Each lists its result folders, each with the request it answers and the
   questions to answer.
2. **Read each result** in the sheet's `results/<name>/`: only its files, as the judge sees them.
   Do not look for a key: none is written down.
3. **Answer each question** with one of three answers:
   - `yes`: the files show the result does what the question asks;
   - `no`: the files show it does not (a wrong amount, the wrong character, a missing or extra
     part, texts that do not fit);
   - `cannot-tell`: the files do not show it either way (for example, the result calls a script
     defined nowhere in its files).
4. **Write the answers** into the sheet's `grades.json`, replacing each `"?"` with `"yes"`, `"no"`
   or `"cannot-tell"`, and save it where it is. (Whether filled-in grades are committed is still
   your question in [decisions.md](../decisions.md#asked-awaiting-the-owner); until you answer
   it, leave the file uncommitted.) A sheet with a `?` left is refused before any test session
   starts.
5. **Run its one command** from the repository's folder, with Claude Code 2.1.280 or later (the
   scored runs named the copy VS Code's Claude Code extension installed, 2.1.330):

   The hand-made sheet, **10 judge test sessions**:

   ```sh
   SCORED_SESSION_LIMIT=3 SCORED_CLAUDE=<that Claude Code> SCORED_GRADES=fixtures/requests/calibration/grades.json SCORED_RECORD=records/scored/calibration-hand-made.json CK3_GAME_PATH=<game dir> task scored:calibrate
   ```

   The real sheet, **12 judge test sessions**:

   ```sh
   SCORED_SESSION_LIMIT=3 SCORED_CLAUDE=<that Claude Code> SCORED_GRADES=fixtures/requests/calibration/run-2/grades.json SCORED_RECORD=records/scored/calibration-run-2.json CK3_GAME_PATH=<game dir> task scored:calibrate
   ```

   The expert sheet, last, **24 judge test sessions**:

   ```sh
   SCORED_SESSION_LIMIT=3 SCORED_CLAUDE=<that Claude Code> SCORED_GRADES=fixtures/requests/calibration/expert/grades.json SCORED_RECORD=records/scored/calibration-expert.json CK3_GAME_PATH=<game dir> task scored:calibrate
   ```

   Each judge session has session limit 3 and runs on Fable 5.2 (the judge you chose;
   `SCORED_JUDGE_MODEL` names another). `CK3_GAME_PATH` is the game's `game` folder, as for a
   run: since 2026-11-25 the judge is given, with each result, what pychivalry's checker reports
   in it over the installed game and the game's own description of every keyword it writes, and
   takes names from them, never from its memory of the game (version 2 of its prompt). That is
   what a run's judge is given, so the calibration measures the judge the runs use. Your grades
   are unaffected: you grade the results, not the judge. Each command writes its own record, named by
   `SCORED_RECORD`, so the second does not replace the first: for each question and over all,
   how often the judge agreed with you, and how often each of you said "cannot tell". The three
   sheets are **46 judge test sessions** in all. A command with no `SCORED_RECORD` writes
   `records/scored/calibration.json`.

## Grading more real results later

A run keeps its results only when asked: add `SCORED_KEEP=true` to the authoring run's command,
and it prints the folder where each trial's mod is kept (`<request>-<n>/mod/`). Copy the results
you grade into a folder beside a new grades file (the same format as `grades.json`, each `result`
a folder path from the grades file's folder), without the trial's `.claude/` folder, grade them
without reading the judge's answers first, and run the command above with `SCORED_GRADES` naming
the new file and `SCORED_RECORD` a new record. One judge test session for each result you grade.
