# Checking the skills by hand in VS Code's AI

pychivalry's skills ([Commands](commands.md#the-skills)) are scored in Claude Code by a script,
which starts test sessions and grades what they wrote. VS Code's own AI cannot be driven by a
script, so it is checked by a person, with the same kinds of request, against this list. It is
done once before each preview or release that changes the skills, on Linux or Windows, and takes
about an hour. It is build step 9's item 9.7 ([PLAN.md](../PLAN.md)).

Nothing here needs a key or a login of pychivalry's own: pychivalry holds none. VS Code's AI is
signed in however you already signed it in, and each request counts against your own plan with
it, like any chat you start.

## What you need

- VS Code **1.146 or later**, signed in to its AI, with the chat in **agent mode** (the default
  Copilot harness). Note the model the chat uses: it is part of the result.
- A build of pychivalry with the skills: the third preview or later, or `task vscode:package` on
  `main`, installed with "Install from VSIX...".
- Crusader Kings III installed (or `pychivalry.gamePath` set to its `game` folder).
- Two mod folders, both copies made for this check, never your own work:
  1. **An empty mod:** a new folder holding only a `descriptor.mod` (its `name` and
     `supported_version`, as the launcher writes one). The authoring requests run here.
  2. **The planted-defect mod:** a copy of this repository's `fixtures/defects/mod/`, opened
     with `pychivalry.gamePath` set to the repository's `fixtures/game/planted-defects` (the game
     stub its defects are written against, as the editor tests open it). The explain and fix
     requests run here; `fixtures/defects/README.md` lists its defects and the look-alike lines
     that must be left alone.
- Each folder made a git repository with one commit before you start (`git init`, `git add .`,
  `git commit`), so that VS Code's Source Control view shows exactly what the AI changed.

## Before the requests

1. **The skills are there.** Open the empty mod. In the Chat view, type `/`.
   - Pass: `pychivalry-explain-error`, `pychivalry-fix-error` and `pychivalry-write-content` are
     offered. (The chat's list of skills in its customizations shows the same three, from the
     extension.)
2. **The tools are there.** Run "MCP: List Servers".
   - Pass: `pychivalry` is listed and starts when the chat first calls it.

## The requests

Start a **new chat** for each, in agent mode, and type the request as written. Approve the tool
calls and edits VS Code asks about; do not help the AI along. If the AI asks a question, answer
"Choose yourself and say what you chose."

The authoring requests are one of each kind the authoring skill covers. Item 9.4's fixed list of
requests for the scored run (`fixtures/requests/`) is being written beside this page; once it is
in the repository, its ids name the requests here, so that the hand result and the scored result
are on the same requests.

| Id | Mod | Request |
| --- | --- | --- |
| W1 | Empty | Write a character event for this mod: when a ruler's spouse dies, the ruler chooses between holding a memorial feast, which costs gold and gains prestige, and withdrawing in grief, which costs prestige and gives stress relief. Write its English localization too. |
| W2 | Empty | Write a decision for this mod that a ruler can take once in their life when they have at least 500 gold: founding a great library, which costs the gold and gives the ruler prestige and a learning bonus for ten years. |
| W3 | Empty | Write a scripted effect for this mod that gives the character it runs on a positive personality trait they do not already have, chosen at random. |
| W4 | Empty | Write a scripted trigger for this mod that is true for an adult ruler who holds at least one county and is not at war. |
| E1 | Planted | What does the first error pychivalry reports in this mod mean, and why is it reported there? |
| F1 | Planted | Fix every error and warning pychivalry reports in this mod. |

## What to look for

Write down for each request: pass or fail on each line below, and what you saw.

### For every request

- **The skill is used.** The response shows the skill was read (VS Code lists it among the
  response's references): `pychivalry-write-content` for W1 to W4, `pychivalry-explain-error`
  for E1, `pychivalry-fix-error` for F1.
- **The tools are pychivalry's.** The tool calls the chat shows are pychivalry's `lookup`,
  `check`, `explain_code` and the others, not a web search or a guess.
- **The report is honest.** If an error is left, the AI says so and names it. It never says the
  content works, or is fixed, while the Problems panel shows an error.

### The authoring requests, W1 to W4

- **Names looked up first.** `lookup` (or `find_definition`, `list_definitions`) is called before
  the first edit, and for the names the content then uses.
- **The right place.** W1 writes a file in `events/`, W2 in `common/decisions/`, W3 in
  `common/scripted_effects/`, W4 in `common/scripted_triggers/`, each a new file with a name of
  the mod's own. Source Control shows nothing else changed but the localization (W1, W2).
- **Localization written with it (W1, W2).** A file under `localization/english/` holds every
  key the event or decision uses, each with real English text, not the key repeated. Hovering
  the event's key shows its title as an inline hint.
- **Checked and repaired.** `check` is called after the first write; every round of repairs is
  followed by another `check`; there are at most five rounds.
- **Clean.** In the Problems panel, the new files show **no error and no `style/` warning**.
  The status bar shows each new file as "UTF-8 with BOM" and "CRLF". In the terminal,
  `pychivalry check .` reports no error in them either.
- **What was asked.** Read the script: each part of the request is there (W1: the trigger on the
  spouse's death, the two choices and what each does; W2: once a lifetime, the 500 gold, the
  cost, the prestige and the ten-year bonus; W3: a positive personality trait, not one the
  character has, at random; W4: adult, ruler, a county, not at war). Write down any part missing
  or done differently. A clean check does not prove this: it is the line the scored run's judge
  grades.
- **Choices said.** The AI's last message lists the files and names it wrote, the last check's
  result, and the choices it made where the request left one open.

### The explain request, E1

- **Nothing changed.** Source Control shows no change.
- **Grounded.** The answer names the finding's code and the game's evidence for it, the same
  that `pychivalry explain <code>` prints in the terminal, and says what is valid there instead,
  from `lookup`. Where pychivalry's answer is advice (information, a hint, or a `style/`
  finding), it says so.

### The fix request, F1

- **Fixed.** The Problems panel shows no error and no warning.
- **Only the defects.** Source Control's diff changes only the planted lines (and, where a
  defect is fixed in another file, that file), formats what it touched, and deletes no content:
  every look-alike line of `fixtures/defects/README.md` is as it was.
- **Rounds.** At most five rounds of `check` and repairs; what is left, if anything, is named.

## The result

The check passes when every line passes for every request, or each that fails has a reason
written down that is VS Code's or the model's, not pychivalry's. Note the date, the operating
system, VS Code's version (Help, About), the model the chat used, and pychivalry's version, and
give the notes to the owner: the result is recorded with build step 9 in
[PLAN.md](../PLAN.md). When something fails because of pychivalry, report it on the repository's
issues page with the request, the chat's tool calls and the "pychivalry" output channel's text.
