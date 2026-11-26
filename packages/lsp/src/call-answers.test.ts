/**
 * The same call graph on every surface (docs/MVP.md, "Same answers on every surface", extended by
 * build step 10): for every definition of the fixture mod `call-graph` (read alone) and of the mod
 * `lookup-definitions-and-uses` over the game stub `lookup`, the command line's `calls --json`,
 * the agent server's `call_graph` and the language server's call hierarchy give the same links:
 * the same callers and callees, each at the same place. The command line and the agent server
 * run in this process; the language server is spawned and spoken to over the protocol.
 */

import { defaultSpecDir as cliSpecDir, run, type Io } from '@pychivalry/cli';
import { answer, Session, TOOLS } from '@pychivalry/mcp';
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import type {
    CallHierarchyIncomingCall,
    CallHierarchyItem,
    CallHierarchyOutgoingCall,
} from 'vscode-languageserver-protocol/node';
import {
    committedSpec,
    GAMES,
    MODS,
    readDocument,
    scratch,
    serverInProcess,
    spawnServer,
    type TestClient,
} from './testing.js';
import { uriToPath, THIS_SYSTEM } from './paths.js';

/** A link reduced to what every surface says: the other end and the place it is written. */
type Link = string;

function key(other: string, layer: string, file: string, line: number, column: number): Link {
    return `${other} @ ${layer} ${file}:${String(line)}:${String(column)}`;
}

/** The command line in this process. */
function cli(argv: readonly string[], cache: string): string {
    let out = '';
    let err = '';
    const io: Io = {
        stdout: (text) => {
            out += text;
        },
        stderr: (text) => {
            err += text;
        },
        cwd: process.cwd(),
        env: { XDG_CACHE_HOME: cache, LOCALAPPDATA: cache },
        platform: process.platform,
        home: cache,
        specDir: cliSpecDir(),
        findGame: () => null,
    };
    const code = run(argv, io);
    assert.ok(code === 0 || code === 1, err);
    return out;
}

interface Sides {
    readonly callers: Link[];
    readonly callees: Link[];
}

interface CliAnswer {
    readonly name: string;
    readonly callers: readonly {
        from: { name: string };
        at: { layer: string; file: string; range: { start: { line: number; character: number } } };
    }[];
    readonly callees: readonly {
        to: { name: string };
        at: { layer: string; file: string; range: { start: { line: number; character: number } } };
    }[];
}

function cliSides(
    names: readonly string[],
    args: readonly string[],
    cache: string,
): Map<string, Sides> {
    const out = new Map<string, Sides>();
    const lines = cli(['calls', ...names, ...args, '--json'], cache)
        .trimEnd()
        .split('\n');
    for (const line of lines) {
        const a = JSON.parse(line) as CliAnswer;
        const at = (p: CliAnswer['callers'][number]['at']): [string, string, number, number] => [
            p.layer,
            p.file,
            p.range.start.line + 1,
            p.range.start.character + 1,
        ];
        out.set(a.name, {
            callers: a.callers.map((l) => key(l.from.name, ...at(l.at))).sort(),
            callees: a.callees.map((l) => key(l.to.name, ...at(l.at))).sort(),
        });
    }
    return out;
}

/** The agent server's answers, asking again for the names a result leaves in `not_answered`. */
function mcpSides(names: readonly string[], session: Session): Map<string, Sides> {
    const tool = TOOLS.find((t) => t.name === 'call_graph');
    assert.ok(tool !== undefined);
    const out = new Map<string, Sides>();
    const side = (links: Record<string, unknown>[]): Link[] =>
        links
            .map((l) =>
                key(
                    String(l['name']),
                    String(l['layer']),
                    String(l['file']),
                    Number(l['line']),
                    Number(l['column']),
                ),
            )
            .sort();
    let asked: readonly string[] = names;
    while (asked.length > 0) {
        const result = answer(tool, { names: asked }, session);
        assert.notEqual(result.isError, true);
        const content = result.structuredContent as {
            results: {
                name: string;
                callers: { links: Record<string, unknown>[] };
                callees: { links: Record<string, unknown>[] };
                detail?: string;
            }[];
            not_answered: { names: string[] } | null;
        };
        assert.ok(content.results.length > 0, 'every call answers at least one name');
        for (const r of content.results) {
            assert.equal(r.detail, undefined, `${r.name} is answered whole`);
            out.set(r.name, { callers: side(r.callers.links), callees: side(r.callees.links) });
        }
        asked = content.not_answered?.names ?? [];
    }
    return out;
}

async function lspSides(
    t: TestContext,
    names: readonly string[],
    mod: string,
    gamePath: string,
    layers: ReadonlyMap<string, { layer: string; root: string }>,
): Promise<Map<string, Sides>> {
    // Without a game, in this process with no Steam search, so that no real game is looked for.
    const { client }: { client: TestClient } =
        gamePath === ''
            ? serverInProcess(t, { gamePath }, { findGame: () => null })
            : spawnServer(t, { gamePath });
    await client.start([mod]);
    await client.settled();
    // A place of the protocol (a URI and a range) as the other surfaces write it: its layer, its
    // path inside the layer, its line and column counted from 1.
    const placeOfUri = (
        uri: string,
        range: { start: { line: number; character: number } },
    ): [string, string, number, number] => {
        const disk = uriToPath(uri, THIS_SYSTEM);
        assert.ok(disk !== null, uri);
        for (const { layer, root } of layers.values()) {
            const relative = path.relative(root, disk);
            if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
                return [
                    layer,
                    relative.split(path.sep).join('/'),
                    range.start.line + 1,
                    range.start.character + 1,
                ];
            }
        }
        throw new Error(`no layer holds ${disk}`);
    };
    const out = new Map<string, Sides>();
    for (const name of names) {
        // Prepare from a place that writes the name: its first definition's key, from the core's
        // own answer, so that every definition of the name is asked about.
        const sides: Sides = { callers: [], callees: [] };
        const definitions = (
            JSON.parse(
                cli(
                    [
                        'calls',
                        name,
                        '--mod',
                        mod,
                        ...(gamePath === '' ? ['--no-vanilla'] : ['--vanilla', gamePath]),
                        '--json',
                    ],
                    scratch(t),
                ),
            ) as {
                definitions: {
                    layer: string;
                    file: string;
                    range: { start: { line: number; character: number } };
                }[];
            }
        ).definitions;
        const seen = new Set<string>();
        for (const d of definitions) {
            const root = [...layers.values()].find((l) => l.layer === d.layer)?.root;
            assert.ok(root !== undefined, d.layer);
            const file = path.join(root, ...d.file.split('/'));
            const text = readDocument(file);
            const uri = await client.open(file, text);
            const items = await client.connection.sendRequest<CallHierarchyItem[] | null>(
                'textDocument/prepareCallHierarchy',
                {
                    textDocument: { uri },
                    position: d.range.start,
                },
            );
            assert.ok(items !== null && items.length === 1, `${name}: one item at its key`);
            const [item] = items;
            const incoming = await client.connection.sendRequest<CallHierarchyIncomingCall[]>(
                'callHierarchy/incomingCalls',
                { item },
            );
            for (const call of incoming) {
                for (const range of call.fromRanges) {
                    const k = key(call.from.name, ...placeOfUri(call.from.uri, range));
                    if (!seen.has(`in ${k}`)) {
                        seen.add(`in ${k}`);
                        sides.callers.push(k);
                    }
                }
            }
            const outgoing = await client.connection.sendRequest<CallHierarchyOutgoingCall[]>(
                'callHierarchy/outgoingCalls',
                { item },
            );
            for (const call of outgoing) {
                for (const range of call.fromRanges) {
                    sides.callees.push(key(call.to.name, ...placeOfUri(item?.uri ?? '', range)));
                }
            }
            await client.close(uri);
        }
        out.set(name, { callers: sides.callers.sort(), callees: sides.callees.sort() });
    }
    return out;
}

/** The callees the language server cannot show: those nothing defines, which have no file. */
function withoutUndefined(
    sides: Map<string, Sides>,
    undefinedNames: ReadonlySet<string>,
): Map<string, Sides> {
    return new Map(
        [...sides].map(([n, s]) => [
            n,
            {
                callers: s.callers,
                callees: s.callees.filter((l) => !undefinedNames.has(l.split(' @ ')[0] ?? '')),
            },
        ]),
    );
}

test('the call-graph fixture: the same callers and callees on the command line, the agent server and the editor', async (t) => {
    const mod = path.join(MODS, 'call-graph');
    const names = [
        'fixture_calls.1',
        'fixture_calls.2',
        'fixture_calls.3',
        'fixture_call_effect',
        'fixture_call_inner_effect',
        'fixture_call_trigger',
        'fixture_call_outer_trigger',
        'fixture_on_action_a',
        'fixture_on_action_b',
        'fixture_call_decision',
    ];
    const cache = scratch(t);
    const fromCli = cliSides(names, ['--mod', mod, '--no-vanilla'], cache);
    const session = new Session({
        spec: committedSpec(),
        modDir: mod,
        game: { dir: null, source: null, notFound: false },
        cacheDir: null,
    });
    const fromMcp = mcpSides(names, session);
    assert.deepEqual(fromMcp, fromCli);
    assert.ok([...fromCli.values()].every((s) => s.callers.length + s.callees.length > 0));
    const fromLsp = await lspSides(
        t,
        names,
        mod,
        '',
        new Map([['mod', { layer: 'mod', root: mod }]]),
    );
    // fixture_calls.9 is fired and defined nowhere: the editor has no file to show it in.
    assert.deepEqual(fromLsp, withoutUndefined(fromCli, new Set(['fixture_calls.9'])));
    assert.ok(
        fromCli.get('fixture_calls.3')?.callees.some((l) => l.startsWith('fixture_calls.9 @')),
    );
});

test('over a base game: the same links, game places in their layers', async (t) => {
    const mod = path.join(MODS, 'lookup-definitions-and-uses');
    const game = path.join(GAMES, 'lookup', 'game');
    const names = ['fixture_scripted_trigger'];
    const cache = scratch(t);
    const fromCli = cliSides(names, ['--mod', mod, '--vanilla', game], cache);
    const session = new Session({
        spec: committedSpec(),
        modDir: mod,
        game: { dir: game, source: 'vanilla', notFound: false },
        cacheDir: null,
    });
    const fromMcp = mcpSides(names, session);
    assert.deepEqual(fromMcp, fromCli);
    const callers = fromCli.get('fixture_scripted_trigger')?.callers ?? [];
    assert.ok(
        callers.some((l) => l.includes('@ game ')) && callers.some((l) => l.includes('@ mod ')),
    );
    const fromLsp = await lspSides(
        t,
        names,
        mod,
        game,
        new Map([
            ['mod', { layer: 'mod', root: mod }],
            ['game', { layer: 'game', root: game }],
        ]),
    );
    assert.deepEqual(fromLsp, fromCli);
    // Every place the agent server writes outside the mod says how it is read.
    const tool = TOOLS.find((x) => x.name === 'call_graph');
    assert.ok(tool !== undefined);
    const out = answer(tool, { names, direction: 'callers' }, session).structuredContent as {
        results: { callers: { links: Record<string, unknown>[] } }[];
    };
    for (const link of out.results[0]?.callers.links ?? []) {
        assert.equal(link['read_with'], link['layer'] === 'mod' ? undefined : 'source');
    }
});
