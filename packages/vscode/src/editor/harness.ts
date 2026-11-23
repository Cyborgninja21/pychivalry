/**
 * The editor tests' own small runner: each case runs in turn inside the VS Code the runner
 * started (`run.ts`), and the suite fails when any case fails. Node's test runner is not used
 * here: it reports when its process ends, and this process is VS Code's extension host.
 */

/** One editor test. */
export interface EditorCase {
    readonly name: string;
    readonly run: () => Promise<void>;
}

/** A case that does not apply here, with the reason, written into the output. */
export class Skip extends Error {
    override name = 'Skip';
}

/** Run every case in turn; reject naming how many failed. */
export async function runCases(suite: string, cases: readonly EditorCase[]): Promise<void> {
    let failed = 0;
    for (const c of cases) {
        const started = Date.now();
        try {
            await c.run();
            console.log(`ok - ${suite}: ${c.name} (${String(Date.now() - started)} ms)`);
        } catch (err) {
            if (err instanceof Skip) {
                console.log(`ok - ${suite}: ${c.name} # SKIP ${err.message}`);
                continue;
            }
            failed++;
            const text = err instanceof Error ? (err.stack ?? err.message) : String(err);
            console.log(`not ok - ${suite}: ${c.name}\n${text}`);
        }
    }
    if (failed > 0) {
        throw new Error(`${String(failed)} of ${String(cases.length)} editor tests failed`);
    }
}

/** Wait until `ready()` holds, checking every 100 ms; fail after `ms`. */
export async function waitFor(what: string, ready: () => boolean, ms = 30_000): Promise<void> {
    const until = Date.now() + ms;
    while (!ready()) {
        if (Date.now() > until) {
            throw new Error(`timed out after ${String(ms)} ms waiting for ${what}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

/** A variable the runner set for the suite; fails when it is missing. */
export function given(name: string): string {
    const value = process.env[name];
    if (value === undefined || value === '') {
        throw new Error(`the runner did not set ${name}`);
    }
    return value;
}
