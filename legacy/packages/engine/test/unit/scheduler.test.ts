/**
 * The workspace validator (index/scheduler.ts): background validation of every file,
 * incremental re-validation on change and save, cancellation, progress, the file ceiling.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Diagnostic } from '../../src/diagnostics';
import { ValidationProgress, WorkspaceValidator } from '../../src/index/scheduler';
import { Workspace } from '../../src/index/workspace';

/**
 * A mod with a scripted effect defined in one file and called from two others, a
 * scripted trigger used by a third, and an unrelated file.
 */
const MOD: Record<string, string> = {
    'common/scripted_effects/my_effects.txt': 'my_effect = { add_gold = 1 }\n',
    'common/scripted_triggers/my_triggers.txt': 'my_trigger = { is_adult = yes }\n',
    'events/a.txt':
        'namespace = a\na.1 = {\n\ttype = character_event\n\timmediate = { my_effect = yes }\n}\n',
    'events/b.txt':
        'namespace = b\nb.1 = {\n\ttype = character_event\n\timmediate = { my_effect = yes }\n}\n',
    'events/c.txt':
        'namespace = c\nc.1 = {\n\ttype = character_event\n\ttrigger = { my_trigger = yes }\n}\n',
    'events/d.txt':
        'namespace = d\nd.1 = {\n\ttype = character_event\n\timmediate = { add_gold = 5 }\n}\n',
};

function makeMod(files: Record<string, string> = MOD): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-sched-'));
    for (const [rel, text] of Object.entries(files)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, text);
    }
    return root;
}

interface Harness {
    root: string;
    ws: Workspace;
    validator: WorkspaceValidator;
    /** Mod-relative path → number of times diagnosed. */
    diagnosed: Map<string, number>;
    published: Map<string, Diagnostic[]>;
    progress: ValidationProgress[];
    rel: (file: string) => string;
    abs: (rel: string) => string;
}

function harness(
    options: {
        files?: Record<string, string>;
        concurrency?: number;
        fileLimit?: number;
        isOpen?: (file: string) => boolean;
        onPublish?: (rel: string, count: number) => void;
    } = {}
): Harness {
    const root = makeMod(options.files);
    const ws = new Workspace(root);
    const diagnosed = new Map<string, number>();
    const published = new Map<string, Diagnostic[]>();
    const progress: ValidationProgress[] = [];
    let publishCount = 0;
    const validator = new WorkspaceValidator(ws, {
        concurrency: options.concurrency,
        fileLimit: options.fileLimit,
        isOpen: options.isOpen,
        onProgress: (p) => progress.push(p),
        publish: (rel, _uri, diagnostics) => {
            diagnosed.set(rel, (diagnosed.get(rel) ?? 0) + 1);
            published.set(rel, diagnostics);
            options.onPublish?.(rel, ++publishCount);
        },
    });
    return {
        root,
        ws,
        validator,
        diagnosed,
        published,
        progress,
        rel: (file) => ws.relativePath(file),
        abs: (rel) => path.join(root, rel),
    };
}

const ALL = Object.keys(MOD).sort();

function counts(h: Harness): Record<string, number> {
    return Object.fromEntries(Array.from(h.diagnosed.entries()).sort());
}

describe('WorkspaceValidator', () => {
    const roots: string[] = [];
    const make = (options?: Parameters<typeof harness>[0]): Harness => {
        const h = harness(options);
        roots.push(h.root);
        return h;
    };
    after(() => {
        for (const root of roots) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('validates every file exactly once after start() and reaches idle', async () => {
        const h = make();
        h.ws.load();
        h.validator.start();
        await h.validator.whenIdle();
        assert.deepStrictEqual(counts(h), Object.fromEntries(ALL.map((f) => [f, 1])));
        assert.deepStrictEqual(
            ALL.map((f) => h.published.get(f)?.filter((d) => d.severity === 'error')),
            ALL.map(() => [])
        );
        // A second start() with nothing queued does not validate again.
        h.validator.start();
        await h.validator.whenIdle();
        assert.strictEqual(
            Array.from(h.diagnosed.values()).reduce((a, b) => a + b, 0),
            ALL.length
        );
    });

    it('yields to the event loop between files', async () => {
        const h = make({ concurrency: 3 });
        h.ws.load();
        let ticks = 0;
        const timer = setInterval(() => ticks++, 0);
        const ticksAt: number[] = [];
        const validator = new WorkspaceValidator(h.ws, {
            concurrency: 3,
            publish: () => {
                ticksAt.push(ticks);
            },
        });
        validator.start();
        await validator.whenIdle();
        clearInterval(timer);
        assert.strictEqual(ticksAt.length, ALL.length);
        // A setImmediate yield after each file: the publish callbacks are not all in one tick.
        assert.ok(new Set(ticksAt).size > 1, `ticks: ${ticksAt.join(',')}`);
    });

    it('progress runs from 0 to total and ends idle with done === total', async () => {
        const h = make();
        h.ws.load();
        h.validator.start();
        await h.validator.whenIdle();
        const running = h.progress.filter((p) => p.state === 'running');
        assert.ok(running.length > 0);
        assert.strictEqual(running[0].done, 0);
        assert.strictEqual(running[0].total, ALL.length);
        assert.ok(running.some((p) => p.current !== undefined));
        const last = h.progress[h.progress.length - 1];
        assert.deepStrictEqual(
            { state: last.state, done: last.done, total: last.total, cancelled: last.cancelled },
            { state: 'idle', done: ALL.length, total: ALL.length, cancelled: undefined }
        );
        assert.strictEqual(h.validator.stats.filesValidated, ALL.length);
        assert.strictEqual(h.validator.stats.completedRuns, 1);
        assert.ok(h.validator.stats.longestFile !== undefined);
    });

    it('a change re-validates only that file', async () => {
        const h = make();
        h.ws.load();
        h.validator.start();
        await h.validator.whenIdle();
        h.diagnosed.clear();
        h.validator.invalidate(h.abs('events/a.txt'));
        await h.validator.whenIdle();
        assert.deepStrictEqual(counts(h), { 'events/a.txt': 1 });
    });

    it('a save re-validates the file and exactly its dependents', async () => {
        const h = make();
        h.ws.load();
        h.validator.start();
        await h.validator.whenIdle();
        h.diagnosed.clear();
        h.validator.invalidateWithDependents(h.abs('common/scripted_effects/my_effects.txt'));
        await h.validator.whenIdle();
        assert.deepStrictEqual(counts(h), {
            'common/scripted_effects/my_effects.txt': 1,
            'events/a.txt': 1,
            'events/b.txt': 1,
        });
        h.diagnosed.clear();
        h.validator.invalidateWithDependents(h.abs('common/scripted_triggers/my_triggers.txt'));
        await h.validator.whenIdle();
        assert.deepStrictEqual(counts(h), {
            'common/scripted_triggers/my_triggers.txt': 1,
            'events/c.txt': 1,
        });
    });

    it('a save after removing a definition still re-validates its former callers', async () => {
        const h = make();
        h.ws.load();
        h.validator.start();
        await h.validator.whenIdle();
        const effects = h.abs('common/scripted_effects/my_effects.txt');
        fs.writeFileSync(effects, 'other_effect = { add_gold = 2 }\n');
        h.ws.indexFile(effects);
        h.diagnosed.clear();
        h.validator.invalidateWithDependents(effects);
        await h.validator.whenIdle();
        assert.deepStrictEqual(counts(h), {
            'common/scripted_effects/my_effects.txt': 1,
            'events/a.txt': 1,
            'events/b.txt': 1,
        });
        // The callers now report the effect as unknown.
        assert.deepStrictEqual(
            h.published.get('events/a.txt')?.map((d) => d.code),
            ['unknown_effect_X']
        );
    });

    it('an invalidated file goes ahead of the rest of a running pass', async () => {
        const order: string[] = [];
        const ref: { h?: Harness } = {};
        const h = make({
            concurrency: 1,
            onPublish: (rel, count) => {
                order.push(rel);
                if (count === 1) {
                    ref.h?.validator.invalidate(ref.h.abs('events/d.txt'));
                }
            },
        });
        ref.h = h;
        h.ws.load();
        h.validator.start();
        await h.validator.whenIdle();
        assert.strictEqual(order[1], 'events/d.txt');
        assert.strictEqual(order.length, ALL.length);
    });

    it('cancel() stops before the next file and start() resumes from the queue', async () => {
        const ref: { validator?: WorkspaceValidator } = {};
        const h = make({
            concurrency: 2,
            onPublish: (_rel, count) => {
                if (count === 3) {
                    ref.validator?.cancel();
                }
            },
        });
        ref.validator = h.validator;
        h.ws.load();
        h.validator.start();
        await h.validator.whenIdle();
        // Cancelled inside the third file's publish: no fourth file was started.
        assert.strictEqual(Array.from(h.diagnosed.values()).length, 3);
        const stopped = h.validator.progress;
        assert.deepStrictEqual(
            [stopped.state, stopped.done, stopped.total, stopped.cancelled],
            ['idle', 3, ALL.length, true]
        );
        assert.strictEqual(h.validator.queued, ALL.length - 3);
        h.validator.start();
        await h.validator.whenIdle();
        assert.deepStrictEqual(counts(h), Object.fromEntries(ALL.map((f) => [f, 1])));
        assert.strictEqual(h.validator.queued, 0);
    });

    it('above fileLimit only open files are validated unless forced', async () => {
        const open = new Set<string>();
        const h = make({ fileLimit: 3, isOpen: (f) => open.has(f) });
        open.add(path.resolve(h.abs('events/b.txt')));
        h.ws.load();
        h.validator.start();
        await h.validator.whenIdle();
        assert.deepStrictEqual(counts(h), { 'events/b.txt': 1 });
        assert.strictEqual(h.validator.progress.limited, true);
        // An unopened file changing on disk is not validated while limited.
        h.diagnosed.clear();
        h.validator.invalidate(h.abs('events/d.txt'));
        await h.validator.whenIdle();
        assert.deepStrictEqual(counts(h), {});
        // Forced: every file, and the limit no longer applies.
        h.validator.start({ force: true });
        await h.validator.whenIdle();
        assert.deepStrictEqual(counts(h), Object.fromEntries(ALL.map((f) => [f, 1])));
        assert.strictEqual(h.validator.progress.limited, false);
    });

    it('whenIdle resolves at once when nothing runs, and disabled does nothing', async () => {
        const root = makeMod();
        roots.push(root);
        const ws = new Workspace(root).load();
        let published = 0;
        const validator = new WorkspaceValidator(ws, {
            enabled: false,
            publish: () => {
                published++;
            },
        });
        await validator.whenIdle();
        validator.start();
        validator.invalidate(path.join(root, 'events/a.txt'));
        await validator.whenIdle();
        assert.strictEqual(published, 0);
        validator.configure({ enabled: true });
        validator.start();
        await validator.whenIdle();
        assert.strictEqual(published, ALL.length);
    });

    it('uses the host read and diagnose steps', async () => {
        const root = makeMod();
        roots.push(root);
        const ws = new Workspace(root).load();
        const seen: Array<[string, string]> = [];
        const validator = new WorkspaceValidator<number>(ws, {
            read: async (file) => (file.endsWith('a.txt') ? 'editor text' : 'disk text'),
            diagnose: (file, _uri, text) => {
                seen.push([ws.relativePath(file), text]);
                return text.length;
            },
            publish: () => undefined,
        });
        validator.start();
        await validator.whenIdle();
        assert.deepStrictEqual(
            seen.find(([f]) => f === 'events/a.txt'),
            ['events/a.txt', 'editor text']
        );
        assert.strictEqual(seen.length, ALL.length);
    });
});
