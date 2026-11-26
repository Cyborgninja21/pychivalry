# The third preview: the pre-release, drafted

Item 9.9 of [PLAN.md](PLAN.md): the third preview build, attached to a GitHub pre-release.
**This page is a draft. Nothing here is published: there is no tag `v0.3.0` and no release.** A
release is public the moment it is made, so it is made only on the owner's word, and the owner
decides when; until then this page holds what it would be. It is made the way the first two were
([preview-release.md](preview-release.md#how-a-preview-is-made)): the pull request that drafts this
page merged, public CI green on Linux and Windows for that commit, `task ci` and
`task vscode:package` on a clean checkout of it, the by-hand check on Linux and Windows with that
file ([guide/by-hand-check.md](guide/by-hand-check.md)), then the GitHub pre-release.

**What the plan put before it, and where that stands.** The plan has the third preview wait for
the owner's hand calibration of the judge, on his three sheets, and his hand checklist on VS Code's
built-in AI (decisions 129, 132 and 135). On 2026-11-26 the owner had the release run made first,
before both (decision 178); neither has been done yet. Whether the preview is published before them
is the owner's to decide ([decisions.md](decisions.md#asked-awaiting-the-owner)). If either is
done first, the notes' sentences on it are changed before they go out.

## What it would be

| | |
| --- | --- |
| Tag | `v0.3.0` |
| Title | pychivalry 0.3.0 (preview) |
| Marked | Pre-release |
| Commit | The merge into `main` of the pull request that files the release run and drafts this page (not yet made) |
| Attached | `pychivalry-0.3.0.vsix`, its size and SHA-256 written here when it is built from that commit |

The extension's version is `0.3.0` and its manifest still says `"preview": true`. The pull request's
branch packages to `pychivalry-0.3.0.vsix` (`task vscode:package`: 4,277,332 bytes, 53 entries, the
three skills among them; 0.2.0's was 4,050,490 bytes), and the editor tests pass on it, the smoke
test of the installed file among them; that file is a proof that 0.3.0 builds, not the one to
attach, which is built from the merge.

## What is new since 0.2.0

From build step 9 and what was built beside it ([CHANGELOG.md](../CHANGELOG.md)):

- **The three skills** ([skills/](../skills/README.md)): explain an error, fix an error, write new
  content (events with their localization, decisions, scripted effects, scripted triggers), each
  driving the agent server's tools by their full names (decision 168). VS Code's own AI has them
  from the extension (`contributes.chatSkills`); "Set up for Claude Code" copies them into Claude
  Code's personal skills folder, and the new command "pychivalry: Remove from Claude Code" undoes a
  folder's set-up, with the skills when it is the last (item 9.3).
- **`apply_format`** (decision 126): the agent server's one tool that writes, one file of the mod
  in pychivalry's format, as `pychivalry format <file>` writes it; the skills run it on each file
  they write.
- **What an agent is given** (decisions 140, 143 and 144, tool schema version 5): `lookup` answers
  every name whole or names it in `not_answered`, with no cursor; `lookup`'s `evidence` gives one
  name's spec package evidence on request; `source`, on the agent server and the command line
  (`pychivalry source <layer> <file> <line>`), shows the game's own text around a place, read-only
  and bounded; every place every tool names says its layer.
- **The spec package in format 9** (decisions 147 to 152): the base game's errors fell from 806 to
  13, every one a defect of the game's own files.
- **The checks format 9 unblocked** (decisions 153, 155 and 156): `structure/triggered-desc-other-field`
  (warning), the opener left open of `localization/unbalanced-brackets` (warning, with a fix),
  `scope/title-text-reads-scope-saved-late` and `variables/read-without-set` (advice); and **new
  best-practice hints**: `style/option-without-ai-weight`, `style/redundant-condition` and
  `style/redundant-false-condition` (decisions 153, 158 and 163), the last two with a safe fix.
- **`style/empty-block` never suggests a change of meaning** (decisions 167 and 171 to 177): an
  empty `any_` iterator asks for at least one item (a suggestion writes `count >= 1` in it); an
  empty `random_list` entry, `switch` case or `fallback`, and an event's empty `option`, are
  reported with what taking them away would change and get no fix; an empty `limit`, logical
  operator or scope switch, whose empty meaning the spec package leaves open, is reported saying so
  and gets no fix. A `duel`'s empty outcome is offered for removal as before, until the spec package
  gives `duel` a row (decision 176).
- **The scored authoring test and its release run** (items 9.4 to 9.8, decision 132): 24 content
  requests, 10 trials each, 480 test sessions of the developer's own Claude Code, the record
  `records/scored/authoring.json`: 240 of 240 trials held, every one with no error, no warning, in
  the format and meeting every expectation, and the judge yes to all 800 of its questions; every
  target of decision 127 met, with and without the expert requests
  ([tools/scored-run/README.md](../tools/scored-run/README.md#the-third-previews-release-run-decision-132)).
  **The judge is not yet calibrated against hand grading**: its ability to say no is unmeasured
  until the owner's three sheets are graded (decision 178).

## The notes, drafted

> **pychivalry 0.3.0 is the third preview** of the rebuilt pychivalry, a VS Code extension for
> Crusader Kings III modding: it tells you, and the AI you use, what the game itself would say
> about your mod's script, and now gives that AI skills for writing script the game accepts. It is
> not 1.0.0: it will change, and it is installed and updated by hand. It is the extension
> `cyborgninja21.pychivalry`, not an update of `ck3-language-support` 2.3.0; disable that one for a
> mod you open with this.
>
> **New since 0.2.0.**
>
> - **Skills for your AI.** Three skills: explain an error, fix one, and write new content (events
>   with their localization, decisions, scripted effects and scripted triggers). Writing content,
>   the AI looks every name up before using it, writes an event's localization with it, gives every
>   option of an event with several options an AI weight, checks what it wrote and repairs from the
>   findings for at most five rounds, formats every file it wrote, and never says the content works
>   while an error is left. VS Code's own AI has the skills as soon as the extension is installed.
>   For Claude Code, "pychivalry: Set up for Claude Code" now also copies them into Claude Code's own
>   skills folder, and a new command, "pychivalry: Remove from Claude Code", undoes the set-up: the
>   server's entry and, with the last folder, the skills. A skill of the same name you wrote
>   yourself, or a copy you edited, is left alone.
> - **Formatting from your AI.** A new tool, `apply_format`, puts a file of your mod in
>   pychivalry's format in place, as `pychivalry format` does in the terminal; it is the agent
>   server's only tool that writes, and the skills run it on every file they write.
> - **Lookups answered whole.** `lookup` answers every name it is asked whole, or says which names
>   to ask again: there are no pages to follow. With one name it can also give the spec package's
>   evidence for it, as `pychivalry lookup --json` does.
> - **The game's own text, read safely.** A new tool, `source`, and a new command,
>   `pychivalry source <layer> <file> <line>`, show the base game's own script or localization (or
>   your mod's) around a place another answer named: at most 40 lines, read-only, and only from
>   files pychivalry reads. Every place every tool names says whether it is in your mod or the game.
> - **Game 1.21.0.3, read more truly.** pychivalry reads a new format of its description of the
>   game, which settles much the old one left open: the base game's own errors fell from 806 to 13,
>   every one a real defect of the game's own files.
> - **New checks** it made possible: a warning for a key other than `desc` and `trigger` inside a
>   `triggered_desc`; the warning on unbalanced brackets in localization now also finds an opener
>   left open (`[`, `(`, `'`, `$`), with a fix; advice for a variable read where nothing sets it,
>   and for an event's title text reading a scope saved only in an option or in `after`. New
>   best-practice hints: an option of an event with several options and no AI weight; an
>   `always = yes` or an `always = no` that changes nothing where it is written, with a fix that
>   takes it away.
> - **The empty-block hint never suggests a change of meaning.** An empty block that means
>   something is still shown, with what it means, but no fix takes it away: an empty `any_` list
>   asks for at least one item (the suggestion writes `count >= 1` in it); taking away an empty
>   `random_list` entry would change the odds of the others, an empty `switch` case would let its
>   fallback run, and an event's empty option is a choice. Where the game's description leaves an
>   empty block's meaning open (an empty `limit`, logical operator or scope switch), the hint says
>   so and offers no fix. One case waits: a `duel`'s empty outcome is still offered for removal.
> - **Scored before release.** The skills and tools were tested on 24 fixed content requests, easy
>   to expert, each 10 times: test sessions of Claude Code, with Opus 5.5 writing the content in a
>   fresh mod, graded by pychivalry's checker, by code checking what each request asks, and by
>   another model, Fable 5.2, judging the rest. All 240 results had no error and no warning, were in
>   pychivalry's format and did everything code could check, and the judge said yes to all 800 of
>   its questions: every target set for a release was met. The judge has not yet been checked
>   against grading by hand, so those 800 yes do not yet show that it would say no to a wrong
>   result; and the test measures Claude Code only, not VS Code's own AI.
>
> **Not yet.** GUI files, the call graph, the game's error log, loading content in the running game
> and the CK3 Explorer views come with later steps; a few checks are not complete, waiting on the
> spec package or on decisions still to make. How well VS Code's own AI follows the skills has not
> been checked by hand yet. Linux and Windows are tested, macOS is not; the game must be on the same
> computer.
>
> **Installing.** Download `pychivalry-0.3.0.vsix` below. In VS Code 1.146 or later: Extensions
> view, `...`, "Install from VSIX...". It updates 0.2.0 in place. Open your mod's folder; if the
> game is not in a Steam library, set `pychivalry.gamePath` to its `game` folder. If you set up
> Claude Code with 0.2.0, run "pychivalry: Set up for Claude Code" again in your mod's folder to add
> the skills.
>
> pychivalry holds no API key, token or login and makes no network or model call. The skills are
> instructions for the AI you already use, which reads them and does the writing; pychivalry only
> answers its questions about the game. Please report what goes wrong on the issues page.
