# Commands

## In VS Code

The extension is not built yet, so it adds no commands today. One is decided:

| Command | What it does | Arrives with |
| --- | --- | --- |
| Set up for Claude Code | Registers pychivalry's agent server with Claude Code, which does not see what VS Code extensions register | Build step 7 |

Each later step that adds a command adds its row here.

## Building and testing from source

Everything goes through `task`; `task --list` shows every task.

| Task | What it does |
| --- | --- |
| `task ci` | Everything public CI runs: install, build, lint, format check, tests, and the spec, record and wiki checks |
| `task install` | Installs the workspace from the lock file |
| `task build` | Compiles every package and the tools |
| `task test` | Runs every package's tests |
| `task lint` | Lints every TypeScript file; warnings count as errors |
| `task format` / `task format:check` | Formats the sources / checks the formatting |
| `task spec:check` | Verifies the committed spec package against its checksum |
| `task records:check` | Checks every committed record |
| `task wiki:check` | Checks that the wiki builds from `docs/` and every link in it resolves |

## Tasks that need the game

These read a local install of the game and the five test mods, and run only on a machine that
has them. Each writes a record that is committed. They are for developing pychivalry, not for
checking your own mod; the command-line checker for that arrives with build step 5.

| Task | Needs | What it does |
| --- | --- | --- |
| `task game:parse` | `CK3_GAME_PATH` | The base-game parse suite |
| `task game:check` | `CK3_GAME_PATH` | The base-game check suite |
| `task game:mods` | `CK3_GAME_PATH`, `CK3_CORPUS` | The real-mod suite |
| `task game:bench` | `CK3_GAME_PATH`, `CK3_CORPUS` | The benchmarks |

`CK3_GAME_PATH` is the game's `game` folder. `CK3_CORPUS` is the folder holding the pinned copy
of the test mods. `CK3_CORPUS_SLUGS` limits a run to some of them.

## Publishing the wiki

| Task | What it does |
| --- | --- |
| `task wiki:build` | Builds the wiki pages from `docs/` into `.wiki-build/` to look at. Publishes nothing |
| `task wiki:publish` | Publishes them to the repository's public wiki. `WIKI_DRY_RUN=true` shows the changes and publishes nothing |
