# pychivalry

pychivalry tells a Crusader Kings 3 modder, and any AI agent working on a mod, what the game
itself would say about their script, and helps them write script the game accepts. It is a
VS Code extension with a language server, a command-line checker and an agent server, all built
on one core that takes its CK3 vocabulary only from a spec package derived from the game.

## State

pychivalry is being rebuilt from the ground up. **1.0.0 is not released yet**, and these pages
grow with the build. The old version, release 2.3.0, is still published as the
`ck3-language-support` extension and is no longer developed.

How far the rebuild has got is in the Progress table of the [build plan](../PLAN.md).

## Pages

| Page | What it covers |
| --- | --- |
| [User guide](../guide/README.md) | What pychivalry is for and what it will and will not tell you |
| [Installing](../guide/install.md) | What to install, on which systems |
| [Commands](../guide/commands.md) | The extension's commands, the skills it gives your AI, and the tasks for building from source |
| [Settings](../guide/settings.md) | Configuration, and how pychivalry finds the game |
| [References](../references/README.md) | Every source pychivalry draws on and how far each is trusted |
| [Test data](../test-data.md) | What the tests run on |
| [Decision log](../decisions.md) | Every decision about the rebuild, with its date |

## In the repository

- [What is being built, and why](../MVP.md)
- [The build plan](../PLAN.md)
- [Rules for working on pychivalry](../../AGENTS.md)
- [Reporting a problem or proposing a change](../../CONTRIBUTING.md)
