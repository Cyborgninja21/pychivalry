# pychivalry: user guide

pychivalry is a VS Code extension for Crusader Kings 3 modding. It tells a modder, and any AI
agent working on a mod, what the game itself would say about their script, and helps them write
script the game accepts.

**It is being rebuilt, and 1.0.0 is not released yet.** This guide grows with the build: each
step that ships a feature writes its part here. What each page covers today is what has been
decided and built, and nothing more.

| Page | What it covers |
| --- | --- |
| [Installing](install.md) | What to install, on which systems, and what to use until 1.0.0 is out |
| [Commands](commands.md) | The commands the extension adds, and the command line for building it from source |
| [Settings](settings.md) | The settings, and how pychivalry finds the game |
| [Checks](checks.md) | Every code pychivalry reports: its severity, what it finds and the game's evidence for it |

Coming with the steps that build them: using pychivalry from an AI agent (step 6), the editor
features (steps 7, 8 and 12), and writing content with AI (step 9).

## What pychivalry will and will not tell you

- An **error** or a **warning** is something the game itself rejects or complains about. Each
  one rests on evidence from the game.
- **Information** and **hints** are advice: usually right, not something the game enforces.
- Where pychivalry does not know, it says nothing. It does not guess.
