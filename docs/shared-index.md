# One shared index

The owner's decision of 2026-11-23 ([decisions.md](decisions.md), decision 87): the language
server, the agent servers the extension registers and the terminal's command line hold one copy
of the base game's index between them, not one each. This document says how, which other ways
were weighed, and why they were not chosen. It was written before the code.

## What one copy costs

Measured on the largest corpus mod, rice, with the game 1.21.0.3, Node 22, before this change:
each program loads the base game's index from the on-disk cache (a 280 MiB file) and indexes
the mod over it.

| Program | Peak resident memory |
| --- | ---: |
| Language server, at its first full result | 0.95 GiB |
| Agent server, after `check` | 1.06 GiB |
| Command line, `check --json` | 1.02 GiB |
| All three | 3.02 GiB |

Of each program's figure, about 540 MiB is the loaded base game: 280 MiB of packed integer arrays
(the cache file's bytes: definitions 142 MiB, uses 69 MiB, line starts 44 MiB, the rest small) and
about 250 MiB of strings and tables built from them (613,622 interned names and the maps from a
name to where it is defined). The mod's own index is small beside it.

## The options

1. **The agent server and the command line ask the language server.** The language server already
   holds the base game, for as long as the editor is open. The others send it their whole request
   and get back the answer their own code would give. One copy while the editor is open.
2. **A small index host process that the others attach to.** A process of its own that holds the
   base game and answers for everyone.
3. **A memory-mapped, or otherwise shareable, form on disk** that each program maps read-only, so
   that the operating system keeps one copy of its pages without the programs talking at all.
4. **A combination** of these.

**Chosen: the first.** The language server must keep the base game in its own process: it
re-checks a file on every pause in typing and answers hover and completion from the index, many
small questions each time, which no channel between processes could carry at that speed. So any
host other than the language server means two copies at least, the host's and the language
server's. The language server is the one program that is always there when the extension is,
and lives as long as the editor window does.

**Not chosen: a host process of its own (2).** For the reason above it saves one copy where the
first saves two, or it turns the language server into a client of the host for every keystroke.
It also adds a process whose life someone must manage: who starts it, who stops it, and what
happens when two editors start one each.

**Not chosen: a mapped form on disk (3).** Node has no way to map a file into memory; it would
take a native module, the core's first run-time dependency, built for each system and for each
VS Code release's runtime. And it would share only the 280 MiB of arrays: the 250 MiB of strings
and tables would still be built in every process, unless the whole index were re-encoded into a
form that is read in place. On Windows a mapped file cannot be replaced while it is mapped, so the
cache could no longer be written over atomically while any program had it open. Too much cost
for half the saving.

**Not chosen: a combination (4).** With the first option the language server holds the only
copy; nothing is left for a second mechanism to share.

## How it works

- **The base game, frozen, and forks of it.** The language server loads the base game as before
  and freezes it. Every mod it works on is a fork: an index that shares every file, name and table
  of the base game and holds only what is added after it, copied on write. The editor's own mod is
  one fork, with the text of the open files; each agent server's mod is another, as on disk; each
  run of the command line gets one for the time of the run. A fork answers exactly as an index
  that had the same files added after the base game: the same numbers for the same names, in the
  same order. The base game is never changed by any of them.
- **The request runs the surface's own code.** The command line sends its arguments, its working
  folder and the few variables of its environment it reads; the agent server sends the tool and
  its arguments. The language server runs the command line's own command, or the agent server's
  own tool, over a fork, and sends back what it printed or returned. Every surface still gives
  its own answer, computed by its own code; only where the index is held changes.
- **What writes files runs where it was started.** `check --fix` edits the user's mod, so it is
  never sent: the command line checks, fixes and checks again in its own process, with its own
  copy of the base game, and the language server refuses such a request should one reach it. The
  findings, with the fixes they carry, are the same either way; only reading is lent.
- **The language server keeps answering the editor** while it works for the others: a forwarded
  request is worked through a file at a time, with a pause for the editor between slices, the way
  the language server's background check already works.
- **Where the others find it.** When its base game is loaded, the language server writes an
  address file in the user's own cache folder (`<cache>/pychivalry/host/`, created owner-only),
  named by the spec package's checksum. It holds the local address, a random token and the
  server's process number. A program that finds no address file, or one whose program is gone,
  works alone. Each request names what makes a base game the one it wants: the spec package,
  the game folder, the platform and the fallback encoding; the language server lists the game's
  files again, as the asking program would, and refuses a request whose base game is not its
  own or whose game changed on disk since it read it.
- **Local only.** The channel is a Unix domain socket in that owner-only folder, or on Windows a
  named pipe whose name holds 128 random bits, known only from the owner-only address file. It is
  never a TCP or UDP port and never a network address; the code can bind a path and nothing else,
  and a test holds it to that. Every request carries the token; one without it is refused.
- **Nothing waits on anything.** A request waits at most a second to connect, and the language
  server tells the waiting program it is still working every half second; ten seconds without a
  word, a closed connection, a refusal (another spec package, another game folder, a game that
  changed on disk since the language server read it) or any error, and the program does the work
  itself, loading the base game as it always has. The command line prints nothing until it has
  the whole answer, so a fallback never prints anything twice.
- **When the editor is not there.** The command line in a plain shell, and an agent server Claude
  Code starts with VS Code closed, find no address file and work alone. An agent server that
  loaded its own copy drops it as soon as a language server answers it again.
- **A second editor window.** Its language server finds the first one's address and does not
  host; it loads the base game for itself, since it must hold one in its own process. When the
  first window closes, the second takes the address over within a few seconds, and the others
  then use it.
- **A host that dies** takes nothing with it: its clients see the connection close and work
  alone; the address file it leaves names a process that is gone, which the next program ignores.
- **Turning it off.** `PYCHIVALRY_SHARED_INDEX=off` in a program's environment makes it neither
  host nor ask, so each works alone as before.

## The exception to rule 12

AGENTS.md rule 12 forbids a networking module in what ships, and its test
(`tools/src/no-key-no-network.test.ts`) refused `node:net` without exception. `node:net` is the
only way Node opens a Unix domain socket or a named pipe. The test now allows it in one file,
`packages/core/src/share/channel.ts`, and nowhere else, with its reason; and a test holds that
file to binding and connecting a path only, never a port or a host.

## What only a real Windows machine can show

CI runs every test of this on Linux and Windows: the unit tests of the channel, the address
file, the asking and lending and every fallback, and the editor tests, in which the command line
typed into VS Code's terminal and the agent server VS Code's AI is given are answered by the
language server over the named pipe. What it cannot show:

- **Another account on the same machine.** A named pipe's default permissions let only its
  creator, administrators and the system write to it (other accounts may open it for reading,
  which sends nothing); the pipe's name is random and written only in the first account's own
  folder, and every request must carry the token beside it. CI has one account, so that another
  cannot reach the pipe is shown only on a machine with two ([by-hand check](guide/by-hand-check.md),
  "Only on Windows").
- **A real VS Code and a real Claude Code on Windows** sharing it on a desktop with the game:
  the by-hand check's step 9.

## Measured

On 2026-11-23, on the laptop of MVP.md's "Speed" (Linux, 16 logical CPUs, 62 GiB, in ordinary
use: one-minute load average 3 to 5), game 1.21.0.3, every heavy run alone.

**Memory, all three in use on rice, the largest test mod.** The language server (Node 22,
started by a test client over standard input and output) is opened on rice with the game folder
set and left to its first full result; then the agent server is started and asked `check` (one
page, every severity); then the command line runs `check --json` on rice. Each program's peak
resident memory (the language server's and the agent server's from the system, the command
line's from GNU `time`), summed. The same script before and after, five runs before and six
after, the last two of each alternating:

| | Before | After |
| --- | ---: | ---: |
| Language server, peak | 0.90 to 1.08 GiB | 1.33 to 1.75 GiB |
| Agent server, peak | 1.03 to 1.23 GiB | 0.22 to 0.23 GiB |
| Command line, peak | 0.92 to 1.02 GiB | 0.08 GiB |
| **All three, the sum of their peaks (median)** | **3.02 GiB** (2.98 to 3.25) | **1.83 GiB** (1.64 to 2.05) |
| The language server and the agent server, 20 s later | 1.74 and 2.04 GiB | 1.57 and 1.63 GiB |

The base game is held once: the agent server and the command line never load it (0.23 GiB is
the agent server with its spec package and libraries before it reads anything; 0.08 GiB the
command line with nothing but Node). The language server's own peak rises by what it does for
the other two: a fork of the base game for each mod it answers about, with that mod's own index
and the check's working memory (about 0.1 GiB each on rice, measured in one process), and the
agent server's session, which it keeps for its next pages.

**Speed of the editor.** `task vscode:corpus` before and after, by the method of MVP.md
"Speed": the packaged extension in VS Code 1.147.0 on a virtual display, the time from its
activation to its first full result, the median of five warm runs a mod:

| | balance-of-power-ui | divine-intervention | elf-destiny | rice | viet-events |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before | 1.99 s | 11.70 s | 3.82 s | 5.78 s | 2.78 s |
| After | 2.00 s | 10.34 s | 3.88 s | 6.91 s | 3.09 s |
| Language server's peak memory, before | 0.65 GiB | 1.32 GiB | 0.72 GiB | 0.87 GiB | 0.72 GiB |
| Language server's peak memory, after | 0.65 GiB | 1.35 GiB | 0.72 GiB | 0.88 GiB | 0.72 GiB |

Equal on two mods, faster on one, slower on rice and viet-events. This machine's noise is about
that size (the same build measured twice on one day: rice 6.41 s and 5.78 s, divine-intervention
9.86 s and 11.70 s), so the two builds' language servers were also run alternately, before then
after, nine times or more a mod, from start to first full result:

| Language server alone, alternating, median | Before | After |
| --- | ---: | ---: |
| rice (16 pairs) | 7.41 s | 7.50 s |
| viet-events (9 pairs) | 3.22 s | 3.45 s |
| elf-destiny (9 pairs) | 4.16 s | 4.08 s |
| Its background pass: rice, viet-events, elf-destiny | 4.04, 1.06, 1.64 s | 4.20, 1.08, 1.59 s |

What the change adds to the editor's own path is the fork of the base game, 5 to 8 ms, and the
lookups through it; a check of rice through a fork, in one process, took 2.84 to 3.10 s against
2.99 to 3.22 s through an index of its own. The editor is not measurably slower; viet-events'
start is the one figure to watch.
