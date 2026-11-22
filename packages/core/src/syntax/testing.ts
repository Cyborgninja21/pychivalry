/**
 * Helpers for the syntax layer's tests: a one-line summary of a tree, the committed spec's
 * error catalogue, and the fixture mods. Used by tests only; not exported by the package.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpec } from '../spec/reader.js';
import { catalogueFromSpec, type MessageCatalogue } from './findings.js';
import type { Item, Value } from './tree.js';

/** The repository root: compiled tests live in `packages/core/dist/syntax/`. */
export const repoRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

/**
 * A tree on one line, close to how it was written: scalars as written, pairs as
 * `key op value`, blocks as `{ ... }` (an open block has no `}`), comments in parentheses.
 * A name before a key is written `<name>`; a missing operator or value is written `<none>`.
 */
export function summary(items: readonly Item[]): string {
    return items.map(itemSummary).join(' ');
}

function itemSummary(item: Item | Value): string {
    switch (item.kind) {
        case 'scalar':
        case 'operator':
            return item.text;
        case 'comment':
            return `(${item.text})`;
        case 'block': {
            const inner = summary(item.items);
            const open = inner === '' ? '{' : `{ ${inner}`;
            return item.closed ? `${open} }` : open;
        }
        case 'tagged':
            return `${item.tag.text} ${itemSummary(item.body)}`;
        case 'pair': {
            const parts = [
                ...(item.prefix === null ? [] : [`<${item.prefix.text}>`]),
                item.key.text,
                item.operator === null ? '<none>' : item.operator.text,
                item.value === null ? '<none>' : itemSummary(item.value),
            ];
            return parts.join(' ');
        }
    }
}

/**
 * The committed spec package file, parsed: `spec/ck3-spec-<version>.json.gz`, read and checked
 * by the spec reader once per test process.
 */
export function committedSpecPackage(): unknown {
    return openSpec(path.join(repoRoot, 'spec')).data;
}

let catalogue: MessageCatalogue | undefined;

/** The committed spec's error catalogue. */
export function committedCatalogue(): MessageCatalogue {
    catalogue ??= catalogueFromSpec(committedSpecPackage());
    return catalogue;
}

/** The fixture mods' folder. */
export const fixtureMods = path.join(repoRoot, 'fixtures', 'mods');

/** Every file under `dir` whose name ends with `extension`, as paths relative to `dir`. */
export function filesUnder(dir: string, extension: string): string[] {
    const out: string[] = [];
    const walk = (at: string): void => {
        for (const name of readdirSync(at).sort()) {
            const full = path.join(at, name);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (name.endsWith(extension)) {
                out.push(path.relative(dir, full).split(path.sep).join('/'));
            }
        }
    };
    if (existsSync(dir)) {
        walk(dir);
    }
    return out;
}

/** A small deterministic random number generator (mulberry32), for repeatable edits. */
export function random(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
