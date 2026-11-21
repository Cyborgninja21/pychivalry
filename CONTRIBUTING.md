# Contributing to pychivalry

pychivalry is being rebuilt from the ground up. What is being built is in
[docs/MVP.md](docs/MVP.md), how and in what order is in [docs/PLAN.md](docs/PLAN.md), and how
far it has got is in the plan's Progress table.

## Reporting a problem

Open an issue with the bug form. The most useful report holds:

- the few lines of script that show the problem, written out, not a whole mod;
- what pychivalry said, and what the game says or does with the same script;
- the pychivalry version, the game version, and the operating system.

A finding pychivalry raises that the game accepts is a bug, and so is something the game
rejects that pychivalry misses. Say which.

Problems with release 2.3.0, the `ck3-language-support` extension, are welcome as records of
behaviour the rebuild should get right. Release 2.3.0 itself is no longer changed.

## Proposing a change

Open an issue first and say what you want to change. The rebuild follows a written plan in
order, one step at a time, so a pull request that arrives without one may land on work that is
already assigned or not yet reached.

Pull requests against `legacy/` are not taken. It is release 2.3.0, kept unchanged as a
reference, and it is deleted when the rebuild is done.

## Working on the code

The rules for anyone, agent or person, working in this repository are in
[AGENTS.md](AGENTS.md). The ones that matter most to a first change:

1. `task ci` must pass. It needs Node 22 and [Task](https://taskfile.dev/), and no game files,
   display, model or key.
2. Every error and warning needs evidence from the game. A finding without it is advice.
3. No lists of game keywords in the code. Vocabulary comes from the spec package or from the
   user's installed game.
4. A check comes with a fixture pair: a file it fires on and a file it is silent on
   ([fixtures/README.md](fixtures/README.md)).
5. Never commit game files, files from a published mod, or anything that names a private
   machine, path or person.

Where things are: [docs/README.md](docs/README.md) lists every document, and
[docs/references/](docs/references/README.md) lists every source and how far it is trusted.

## Licence

pychivalry is licensed under Apache-2.0 ([LICENSE](LICENSE)). By contributing you agree that
your contribution is licensed the same way.
