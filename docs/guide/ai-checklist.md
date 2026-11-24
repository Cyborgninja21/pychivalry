# Checking the skills by hand in VS Code's AI

pychivalry's skills ([Commands](commands.md#the-skills)) are scored in Claude Code by a script,
which starts test sessions and grades what they wrote. VS Code's own AI cannot be driven by a
script, so it is checked by a person, with the same kinds of request, against this list. It is
done once before each preview or release that changes the skills, on Linux or Windows, and takes
about an hour. It is build step 9's item 9.7 ([PLAN.md](../PLAN.md)).

Nothing here needs a key or a token of pychivalry's own: pychivalry holds none. VS Code's AI is
signed in however you already signed it in, and each request counts against your own plan with
it, like any chat you start.

## What you need

- VS Code **1.146 or later**, signed in to its AI, with the chat in **agent mode** (the default
  Copilot harness). Note the model the chat uses: it is part of the result.
- A build of pychivalry with the skills: the third preview or later, or `task vscode:package` on
  `main`, installed with "Install from VSIX...".
- Crusader Kings III installed (or `pychivalry.gamePath` set to its `game` folder).
- Three mod folders, each a copy made for this check, never your own work:
  1. **An empty mod:** a copy of this repository's `fixtures/requests/bases/empty/`, a
     `descriptor.mod` alone. Three of the authoring requests run here.
  2. **The feast mod:** a copy of `fixtures/requests/bases/feast/`, which already has an event,
     a scripted effect and a scripted trigger. The decision request runs here.
  3. **The planted-defect mod:** a copy of this repository's `fixtures/defects/mod/`, opened
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

The authoring requests are four of the scored run's twelve
([fixtures/requests/](../../fixtures/requests/README.md)), named by the same ids and typed with
the same words, so that the hand result and the scored result are on the same requests: one of
each kind the authoring skill covers, at each difficulty, one of them building on a mod that
already has content. A person with more time runs any of the other eight the same way, in a copy
of the base mod the list names for it, and reads its expectations and questions in
`fixtures/requests/requests.json` for what to look for.

| Id | Mod | Request |
| --- | --- | --- |
| `event-letter-from-spouse` | Empty | Write two character events (`character_event`) in a new file under `events/`, in the namespace `authoring_letter`. The first, `authoring_letter.0001`, comes once a year through the on-action `yearly_playable_pulse`, which you hook in a new file under `common/on_action/`; it may happen only to a ruler (`is_ruler`) who is married (`is_married`): a letter arrives from the character's spouse. Its one option gives the character 10 piety (`add_piety`) and fires the second event, `authoring_letter.0002`, 3 days later (`trigger_event`). In the second event the character answers: one option gives the character's spouse (`primary_spouse`) 20 prestige (`add_prestige`), the other lowers the character's own stress by 10 (`add_stress`). Write the English localization of both events in a new file under `localization/english/`: `authoring_letter.0001.t`, `authoring_letter.0001.desc`, `authoring_letter.0001.a`, `authoring_letter.0002.t`, `authoring_letter.0002.desc`, `authoring_letter.0002.a` and `authoring_letter.0002.b`. |
| `decision-hold-feast` | Feast | The mod in this folder already has the scripted trigger `feast_can_host_trigger`, the scripted effect `feast_host_reward_effect` and the character event `feast.0001`. Write a decision `authoring_hold_feast_decision` in a new file under `common/decisions/` that uses them. It is shown to characters for whom `feast_can_host_trigger` holds, and can be taken only with at least 100 gold (`gold`). Taking it takes 100 gold from the character (`add_gold`), runs `feast_host_reward_effect`, and fires `feast.0001` 7 days later (`trigger_event`). It can be taken again only 5 years after it was last taken (`cooldown`). Write its English localization in a new file under `localization/english/`: the title `authoring_hold_feast_decision` and the description `authoring_hold_feast_decision_desc`. Change none of the mod's other files. |
| `effect-war-chest` | Empty | Write a scripted effect `authoring_war_chest_effect` in a new file under `common/scripted_effects/`, for a character. When the character is at war (`is_at_war`) it gives 100 gold (`add_gold`); otherwise it gives 50 prestige (`add_prestige`): write it with `if` and `else`. Either way it then raises the character's stress by 5 (`add_stress`). |
| `trigger-can-host` | Empty | Write a scripted trigger `authoring_can_host_trigger` in a new file under `common/scripted_triggers/`. It holds for a character who is an adult (`is_adult`), is a ruler (`is_ruler`) and has at least 50 gold (`gold`). |
| E1 | Planted | What does the first error pychivalry reports in this mod mean, and why is it reported there? |
| F1 | Planted | Fix every error and warning pychivalry reports in this mod. |

## What to look for

Write down for each request: pass or fail on each line below, and what you saw.

### For every request

- **The skill is used.** The response shows the skill was read (VS Code lists it among the
  response's references): `pychivalry-write-content` for the authoring requests, `pychivalry-explain-error`
  for E1, `pychivalry-fix-error` for F1.
- **The tools are pychivalry's.** The tool calls the chat shows are pychivalry's `lookup`,
  `check`, `explain_code` and the others, not a web search or a guess.
- **The report is honest.** If an error is left, the AI says so and names it. It never says the
  content works, or is fixed, while the Problems panel shows an error.

### The authoring requests

- **Names looked up first.** `lookup` (or `find_definition`, `list_definitions`) is called before
  the first edit, and for the names the content then uses.
- **The right place.** `event-letter-from-spouse` writes new files in `events/` and
  `common/on_action/`, `decision-hold-feast` in `common/decisions/`, `effect-war-chest` in
  `common/scripted_effects/`, `trigger-can-host` in `common/scripted_triggers/`, each a new file
  of the mod's own. Source Control shows nothing else changed but the localization (the event
  and the decision); in the feast mod, none of its own files changed.
- **Localization written with it (the event and the decision).** A file under `localization/english/` holds every
  key the event or decision uses, each with real English text, not the key repeated. Hovering
  the event's key shows its title as an inline hint.
- **Checked and repaired.** `check` is called after the first write; every round of repairs is
  followed by another `check`; there are at most five rounds.
- **Clean.** In the Problems panel, the new files show **no error and no `style/` warning**.
  The status bar shows each new file as "UTF-8 with BOM" and "CRLF". In the terminal,
  `pychivalry check .` reports no error in them either.
- **What was asked.** Read the script: each part of the request is there.
  `event-letter-from-spouse`: the first event comes through `yearly_playable_pulse` to a married
  ruler, its one option gives 10 piety and fires the second event 3 days later; the second's two
  options give the spouse 20 prestige and lower the character's stress by 10.
  `decision-hold-feast`: shown where `feast_can_host_trigger` holds, valid with 100 gold, taking
  the gold, running `feast_host_reward_effect`, firing `feast.0001` 7 days later, a cooldown of 5
  years. `effect-war-chest`: 100 gold at war, 50 prestige otherwise, with `if` and `else`, and 5
  stress either way. `trigger-can-host`: an adult ruler with at least 50 gold. Write down any
  part missing or done differently. A clean check does not prove this: it is what the scored
  run's expectations and judge grade, on the questions `fixtures/requests/requests.json` gives
  each request.
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
