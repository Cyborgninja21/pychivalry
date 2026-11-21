# Installing pychivalry

## Today

pychivalry 1.0.0 is not released. There is nothing to install from this rebuild yet.

The old version, release 2.3.0, is still published as the `ck3-language-support` extension and
still works. It is no longer developed. 1.0.0 is a new extension named `pychivalry`: it does
not update 2.3.0 in place, and people on 2.3.0 install the new one by hand when it is out.

## When 1.0.0 is released

- **One thing to install: the extension.** It is a file attached to each release on GitHub,
  installed in VS Code with "Install from VSIX". It contains the language server, the agent
  server, the command-line checker and the skills. Nothing else is downloaded and nothing is
  installed with npm.
- **Updates are by hand.** 1.0.0 is not listed on the VS Code Marketplace, so VS Code does not
  update it for you. Download the newer file and install it over the old one.
- **Claude Code.** After installing, run the command "Set up for Claude Code" once. Claude Code
  does not see what VS Code extensions register, so this tells it where pychivalry's agent
  server is. The extension keeps that location working when it updates.

## What you need

| | |
| --- | --- |
| Editor | A recent VS Code: 1.146 or later, unless a later build step finds an earlier release will do |
| Operating system | Linux or Windows. macOS is untested |
| Game | Crusader Kings 3, installed. pychivalry reads names the game defines in its files |
| Game version | The current one. pychivalry is built for one game version at a time; when the installed game is newer or older than the version it was built for, it says so once and keeps working |
| Anything else | No Node, no Python, no API key |

## Building from source

For working on pychivalry itself. Needs Node 22 (22.13 or later) and
[Task](https://taskfile.dev/).

```bash
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry
task ci
```

`task ci` installs, builds, lints, checks formatting and runs every test. It needs no game
files, no display, no model and no key. See [Commands](commands.md) for the rest.
