/**
 * Work in steps (docs/shared-index.md): a long piece of work written as a generator that pauses
 * between its parts, a file at a time, so that its caller decides how to run it. A program that
 * does nothing else runs it straight through (`drain`), which is the same as calling the plain
 * function; a server that must keep answering others runs it in slices, giving way between them
 * (`drainInSlices`). Either way the work and its result are the same.
 */

/** Work that pauses between its parts and returns `T` at its end. */
export type Steps<T> = Generator<undefined, T, undefined>;

/** Run work straight through and return its result. */
export function drain<T>(steps: Steps<T>): T {
    let next = steps.next();
    while (next.done !== true) {
        next = steps.next();
    }
    return next.value;
}

/**
 * Run work in slices of about `sliceMs` milliseconds, giving the event loop its turn between
 * slices, and return its result.
 */
export async function drainInSlices<T>(steps: Steps<T>, sliceMs = 10): Promise<T> {
    let started = performance.now();
    let next = steps.next();
    while (next.done !== true) {
        if (performance.now() - started >= sliceMs) {
            await new Promise<void>((resolve) => setImmediate(resolve));
            started = performance.now();
        }
        next = steps.next();
    }
    return next.value;
}
