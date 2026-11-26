# Installing pychivalry

## Today: the preview, 0.3.0

pychivalry 1.0.0 is not released. The third **preview**, version 0.3.0, is a build of the
rebuild as it stands after build step 9: the checks, lookups and editor features built so far,
the formatter and the quick fixes, the agent server for your AI, the command line, and the skills
that tell your AI how to explain an error, fix one and write new content
([Commands](commands.md#the-skills)). It is a preview: it will change, it has not been through a
release's checks, and it is installed and updated by hand. Its file, `pychivalry-0.3.0.vsix`, is
attached to the pre-release
[pychivalry 0.3.0 (preview)](https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.3.0)
on the repository's GitHub releases page, published on 2026-11-26. The first two previews,
[0.1.0](https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.1.0) and
[0.2.0](https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.2.0), are still there; 0.3.0
updates either in place.

The old version, release 2.3.0, is still published as the `ck3-language-support` extension and
still works. It is no longer developed. pychivalry is a new extension named `pychivalry`
(`cyborgninja21.pychivalry`): it does not update 2.3.0 in place. The two can be installed side
by side, but both then check the same files; disable one of them for a mod.

### Installing the preview

1. Download `pychivalry-0.3.0.vsix` from the
   [0.3.0 pre-release](https://github.com/Cyborgninja21/pychivalry/releases/tag/v0.3.0). It is
   4,277,332 bytes, and its SHA-256 is
   `8259b159a1ac8ba1932aa96ec8ffb417ff982c7c1b09ff25e7e13820c28b26b5`.
2. In VS Code, open the Extensions view, choose the `...` menu at its top, then
   "Install from VSIX...", and choose the file. From a terminal, the same is
   `code --install-extension pychivalry-0.3.0.vsix`.
3. Open your mod's folder, the one holding `descriptor.mod`. The extension starts by itself:
   the Problems panel fills with pychivalry's findings, and the first time it reads your game,
   which takes up to a minute, a progress notice shows it working. If the game is not found, it
   says so once: set `pychivalry.gamePath` ([Settings](settings.md)).
4. For Claude Code, run **pychivalry: Set up for Claude Code** from the Command Palette, once
   per mod folder ([Commands](commands.md)): it adds the agent server and copies the skills. If
   you set up Claude Code with 0.2.0, run it again in your mod's folder to add the skills. VS
   Code's own AI needs nothing: it sees the agent server and the skills as soon as the extension
   is installed.

Nothing else is downloaded and nothing is installed with npm: the language server, the agent
server and the command line are all inside the file, and VS Code runs them.

### Updating and removing it

- **Updates are by hand.** The preview is not on the VS Code Marketplace, so VS Code does not
  update it. Install the newer `.vsix` the same way, over the old one. Claude Code's set-up
  keeps working across the update: the extension keeps its servers in a folder whose path does
  not change.
- **Removing it.** For Claude Code, first run **pychivalry: Remove from Claude Code** in each
  mod folder you set up, which 0.3.0 and later have ([Commands](commands.md)): it
  removes the server's entry and, with the last folder, the skills it copied. With 0.2.0, or
  by hand: run `claude mcp remove --scope local pychivalry` in each mod folder you set up (or
  delete the `pychivalry` entry from the `.mcp.json` the set-up wrote, if it wrote one), and
  delete the folders `pychivalry-explain-error`, `pychivalry-fix-error` and
  `pychivalry-write-content` from Claude Code's `skills` folder if a set-up copied them there.
  Then uninstall the extension from the Extensions view. pychivalry's index of the game is in
  your cache folder ([Settings](settings.md)) and can be deleted.

## When 1.0.0 is released

- **One thing to install: the extension**, as for the preview: a file attached to each release
  on GitHub, installed with "Install from VSIX". It contains the skills too.
- **Updates are by hand**, as for the preview.
- **Claude Code.** After installing, run "Set up for Claude Code" once per mod folder: it adds
  the server and the skills.

## What you need

| | |
| --- | --- |
| Editor | VS Code 1.146 or later. The extension's AI wiring was proven on 1.146 and 1.147; it does not install on an older VS Code |
| Operating system | Linux or Windows. macOS is untested |
| Game | Crusader Kings 3, installed. pychivalry reads names the game defines in its files |
| Game version | The current one. pychivalry is built for one game version at a time; when the installed game is newer or older than the version it was built for, it says so once and keeps working |
| Anything else | No Node, no Python, no API key. Claude Code only if you use it |

## Building from source

For working on pychivalry itself. Needs Node 22 (22.13 or later) and
[Task](https://taskfile.dev/).

```bash
git clone https://github.com/Cyborgninja21/pychivalry.git
cd pychivalry
task ci
```

`task ci` installs, builds, lints, checks formatting and runs every test. It needs no game
files, no display, no model and no key. `task vscode:package` then writes the installable
file, `packages/vscode/dist/pychivalry-<version>.vsix` (today `pychivalry-0.3.0.vsix`, the
published preview's version, which a build from `main` keeps until the next is given). See
[Commands](commands.md) for the rest,
and [Checking a preview by hand](by-hand-check.md) for the check made before a preview goes
out.
