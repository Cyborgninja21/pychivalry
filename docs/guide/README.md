# pychivalry: user guide

pychivalry is a VS Code extension for Crusader Kings 3 modding. It tells a modder, and any AI
agent working on a mod, what the game itself would say about their script, and helps them write
script the game accepts.

**It is being rebuilt, and 1.0.0 is not released yet.** The second preview, 0.2.0, installs
from a `.vsix` file ([Installing](install.md)). This guide grows with the build: each step that ships a
feature writes its part here. What each page covers today is what has been decided and built,
and nothing more.

| Page | What it covers |
| --- | --- |
| [Installing](install.md) | Installing the preview from its `.vsix`, updating and removing it, what you need, and building it from source |
| [Commands](commands.md) | The commands the extension adds, the skills it gives your AI, the editor features, the command line in VS Code's terminal, and the tasks for building it from source |
| [Settings](settings.md) | The settings, and how pychivalry finds the game |
| [Formatting](formatting.md) | The one formatting pychivalry gives every CK3 file: what it is, Format Document and on-type formatting, the `format` command, and the `style/` findings |
| [The agent server](agent-server.md) | How an AI agent uses pychivalry: starting the server, its tools, what it reads, and an example exchange |
| [Checks](checks.md) | Every code pychivalry reports: its severity, what it finds, the game's evidence for it and its fix |
| [Checking a preview by hand](by-hand-check.md) | The check a person makes on Linux and on Windows before a preview or a release: the signed-in AI harnesses, Claude Code, an update, the terminal |
| [Checking the skills by hand](ai-checklist.md) | The checklist a person runs in VS Code's own AI, which no script can drive: the same kinds of request the scored run makes, and what to look for in each |

Writing content with AI is built in step 9: the skills ([Commands](commands.md#the-skills));
how well it does is measured by the scored authoring run, still to come. Coming with the step
that builds them: the editor's views (step 12).

## What pychivalry will and will not tell you

- An **error** or a **warning** is something the game itself rejects or complains about. Each
  one rests on evidence from the game.
- **Information** and **hints** are advice: usually right, not something the game enforces.
- The **`style/`** findings are the one exception: they say where a file is not in pychivalry's
  format ([Formatting](formatting.md)). A file not in the format is a warning, by the owner's
  decision, though the game does not care; each has a safe fix.
- Where pychivalry does not know, it says nothing. It does not guess.
