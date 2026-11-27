# Game logs

Test logs for the game-log analysis of build step 11 ([docs/game-log.md](../../docs/game-log.md)).

**No real game log is here yet.** The game has not been launched for this step. The owner gave
his word for the eight captures of item 11.1 on the analysis machine on 2026-11-27
(docs/decisions.md, decision 200); none is made yet. Every log below is **hand-made**, and says so
in its folder's name. The matcher has not seen a real log.

| Folder | What it holds |
| --- | --- |
| [hand-made/](hand-made/) | Logs written from the spec package's catalogue messages: each line is a catalogue template with its placeholders filled by names and files of the planted-defect mod (`fixtures/defects/mod/`, over the game stub `fixtures/game/planted-defects/`), or a catalogue text the matcher does not use |
| `captured/` | Not yet made: the eight real captures of item 11.1 (decision 200), each with its capture record, its logs scrubbed by the capture and committed only after the check of each file for names and paths in [docs/game-log-capture.md](../../docs/game-log-capture.md#before-the-logs-are-committed) (decision 202) |

## The hand-made logs

Each was written by hand from catalogue templates. They show what the matcher and the ties do on
a line that is a catalogue message; they do **not** show what the game writes: not its line
prefix, not whether a message takes one line or several, not which message the game writes for
which defect, not how it writes a place in a script file. Wherever a template has an `at {}` (a
place, as the script reader prints it, a form no real log has shown yet), its value is the bare
path of the file, with no line.

| File | Lines | What it shows |
| --- | --- | --- |
| `planted-defects.log` | 18, Windows line breaks | Seventeen catalogue messages about the planted-defect mod and its game stub, one of them over two lines (a template whose text holds a newline). No line prefix. `packages/core/src/log/analyze.test.ts` holds each line to its message and to the places it ties to: 14 to the mod, 1 to the base game, 2 to nothing |
| `planted-defects-stand-in-prefix.log` | 18, Unix line breaks | The same lines, the first line of each message after a stand-in prefix, `hand-made line NN \| `, which no game writes. The same messages and places come out with no prefix given and with this one given as a pattern: the matcher does not depend on a prefix |
| `unmatched.log` | 3 | Lines the matcher must list as unmatched: a template with too little fixed text, filled (`ERROR: %s`); a text the package marks as no message (a line of the game's own documentation); and a catalogue message cut short |

The test `every line of the hand-made logs is made from the catalogue` checks that the first two
match with no line left over, and what each line of the third comes from. Their bytes are kept
exact on every platform (`.gitattributes`).
