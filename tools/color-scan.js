#!/usr/bin/env node
/**
 * Colour-notation evidence scan (development tool; needs a CK3 game directory and,
 * optionally, the real-mod corpus, neither committed).
 *
 *   node tools/color-scan.js <game dir> [corpus dir] [--json <out.json>] [--keys <out.json>]
 *
 * Reads every `.gui`, `.gfx`, `.txt` and `.asset` file under <game dir>/{gui,gfx,common}
 * and under each mod folder of <corpus dir> with a tolerant token scan (no parser, so GUI
 * syntax the engine does not accept is still read) and counts, per file kind and per
 * source, how colour values are written:
 *
 *   bare-unit   `{ r g b }` / `{ r g b a }`, every r g b between 0 and 1
 *   bare-byte   `{ r g b }` / `{ r g b a }`, r g b integers, one above 1, none above 255
 *   bare-other  `{ r g b }` / `{ r g b a }`, anything else (fractions above 1, negatives)
 *   rgb         `rgb { … }`        hsv  `hsv { … }`        hsv360  `hsv360 { … }`
 *   hex         `hex { rrggbb }`, `"#rrggbb"`, `0xrrggbb`
 *   named       a word naming a colour defined in a `common/named_colors` file
 *
 * Colour keys (which keys a bare `{ … }` list is a colour under) are derived from the data:
 *
 *   1. every key that is ever written with an `rgb`, `hsv`, `hsv360` or `hex` value: the
 *      notation itself says the game reads that field as a colour;
 *   2. in `.gui`, `.gfx` and `.asset` files only, every key whose own name contains
 *      "color"/"colour" and whose values are three- or four-number lists in at least 90 %
 *      of its occurrences that are not data bindings (`"[…]"`), at least 3 times. GUI
 *      properties are never written with a prefix, so rule 1 cannot find them. Script
 *      (`.txt`) keys need rule 1: the DNA fields `hair_color`/`eye_color`/`skin_color`
 *      are four-number palette coordinates, not colours, and are excluded by it.
 *
 * The entries of the `colors = { … }` block of a `common/named_colors` file are named-colour
 * definitions and are counted as colours whatever their key. The scan writes the counts,
 * the value ranges per notation and the derived key list with each key's evidence
 * (--json), and the key list the colour provider reads (--keys).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PREFIXES = new Set(['rgb', 'hsv', 'hsv360', 'hex']);
const EXTENSIONS = ['.gui', '.gfx', '.txt', '.asset'];
const NOTATIONS = ['bare-unit', 'bare-byte', 'bare-other', 'rgb', 'hsv', 'hsv360', 'hex', 'named'];

function walk(dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
            out.push(full);
        }
    }
    return out;
}

/** Tokens: { type: 'word'|'string'|'op'|'{'|'}', value }. Comments are dropped. */
function tokenize(text) {
    const tokens = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
        const c = text[i];
        if (c === '#') {
            while (i < n && text[i] !== '\n') {
                i++;
            }
            continue;
        }
        if (c === '"') {
            let j = i + 1;
            while (j < n && text[j] !== '"' && text[j] !== '\n') {
                j++;
            }
            tokens.push({ type: 'string', value: text.slice(i + 1, j) });
            i = j + 1;
            continue;
        }
        if (c === '{' || c === '}') {
            tokens.push({ type: c, value: c });
            i++;
            continue;
        }
        if ('=<>!?'.includes(c)) {
            let j = i + 1;
            while (j < n && '=<>'.includes(text[j])) {
                j++;
            }
            tokens.push({ type: 'op', value: text.slice(i, j) });
            i = j;
            continue;
        }
        if (/\s/.test(c)) {
            i++;
            continue;
        }
        let j = i;
        while (j < n && !/[\s{}="#<>!?]/.test(text[j])) {
            j++;
        }
        tokens.push({ type: 'word', value: text.slice(i, j === i ? i + 1 : j) });
        i = j === i ? i + 1 : j;
    }
    return tokens;
}

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const HEX_WORD = /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

/** The items of `{ … }` starting at tokens[at] when they are all words; else undefined. */
function wordList(tokens, at) {
    if (!tokens[at] || tokens[at].type !== '{') {
        return undefined;
    }
    const values = [];
    let j = at + 1;
    while (j < tokens.length && tokens[j].type === 'word') {
        values.push(tokens[j].value);
        j++;
    }
    return tokens[j] && tokens[j].type === '}' ? { values, end: j } : undefined;
}

function bareClass(values) {
    const rgb = values.slice(0, 3).map(Number);
    if (rgb.every((v) => v >= 0 && v <= 1)) {
        return 'bare-unit';
    }
    const ints = values.slice(0, 3).every((v) => /^\d+$/.test(v));
    if (ints && rgb.every((v) => v >= 0 && v <= 255)) {
        return 'bare-byte';
    }
    return 'bare-other';
}

/**
 * Every `key op value` occurrence of a file: { key, parent, kind, values?, word? } with
 * kind 'bare' (3 or 4 numbers), a prefix name, 'scalar' or 'block'.
 */
function occurrences(text) {
    const tokens = tokenize(text);
    const out = [];
    const stack = [];
    let pendingKey;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === '{') {
            stack.push(pendingKey);
            pendingKey = undefined;
            continue;
        }
        if (t.type === '}') {
            stack.pop();
            continue;
        }
        const op = tokens[i + 1];
        const value = tokens[i + 2];
        if (t.type !== 'word' || !op || op.type !== 'op' || !value) {
            continue;
        }
        const parent = stack.length > 0 ? stack[stack.length - 1] : undefined;
        const base = { key: t.value, parent, depth: stack.length };
        if (value.type === '{') {
            const list = wordList(tokens, i + 2);
            if (list && (list.values.length === 3 || list.values.length === 4) && list.values.every((v) => NUMBER.test(v))) {
                out.push({ ...base, kind: 'bare', values: list.values });
                i = list.end;
            } else {
                out.push({ ...base, kind: 'block' });
                pendingKey = t.value;
                i += 1;
            }
            continue;
        }
        if (value.type === 'word' && PREFIXES.has(value.value.toLowerCase())) {
            const list = wordList(tokens, i + 3);
            const prefix = value.value.toLowerCase();
            const ok =
                list &&
                (prefix === 'hex'
                    ? list.values.length === 1 && HEX_WORD.test(list.values[0])
                    : (list.values.length === 3 || list.values.length === 4) && list.values.every((v) => NUMBER.test(v)));
            if (ok) {
                out.push({ ...base, kind: prefix, values: list.values, written: value.value });
                i = list.end;
                continue;
            }
        }
        if (value.type === 'word' || value.type === 'string') {
            out.push({ ...base, kind: 'scalar', word: value.value, quoted: value.type === 'string' });
        }
    }
    return out;
}

function isBinding(word) {
    return word.startsWith('[') || word.startsWith('@') || word.startsWith('$');
}

function newRange() {
    return { count: 0, inRange: 0, arity: {}, min: [], max: [], alphaAboveOne: 0, integerOnly: 0, decimals: {} };
}

/**
 * The ranges the colour provider accepts per notation (the decision this scan supports):
 * bare-unit r g b a in 0..1; bare-byte r g b integers 0..255 with alpha 0..1; rgb three
 * integers 0..255; hsv h s v a in 0..1; hsv360 h 0..360, s v 0..100; hex six digits.
 */
function inRange(notation, values) {
    const v = values.map(Number);
    const within = (x, lo, hi) => x >= lo && x <= hi;
    switch (notation) {
        case 'bare-unit':
        case 'hsv':
            return v.every((x) => within(x, 0, 1));
        case 'bare-byte':
            return v.slice(0, 3).every((x) => within(x, 0, 255)) && (v.length === 3 || within(v[3], 0, 1));
        case 'rgb':
            return v.length === 3 && v.every((x) => within(x, 0, 255));
        case 'hsv360':
            return v.length === 3 && within(v[0], 0, 360) && within(v[1], 0, 100) && within(v[2], 0, 100);
        default:
            return false;
    }
}

function recordRange(stats, notation, values) {
    stats.count++;
    if (inRange(notation, values)) {
        stats.inRange++;
    }
    stats.arity[values.length] = (stats.arity[values.length] || 0) + 1;
    const nums = values.map(Number);
    nums.forEach((v, i) => {
        stats.min[i] = stats.min[i] === undefined ? v : Math.min(stats.min[i], v);
        stats.max[i] = stats.max[i] === undefined ? v : Math.max(stats.max[i], v);
    });
    if (nums.length === 4 && nums[3] > 1) {
        stats.alphaAboveOne++;
    }
    if (values.every((v) => /^[+-]?\d+$/.test(v))) {
        stats.integerOnly++;
    }
    const places = Math.max(...values.map((v) => (v.includes('.') ? v.split('.')[1].length : 0)));
    stats.decimals[places] = (stats.decimals[places] || 0) + 1;
}

function isNamedColourFile(file) {
    return /[\\/]common[\\/]named_colors[\\/]/i.test(file);
}

function main() {
    const args = process.argv.slice(2);
    const option = (name) => {
        const at = args.indexOf(name);
        if (at < 0) {
            return undefined;
        }
        const value = args[at + 1];
        args.splice(at, 2);
        return value;
    };
    const jsonOut = option('--json');
    const keysOut = option('--keys');
    const [gameDir, corpusDir] = args;
    if (!gameDir) {
        process.stderr.write('usage: node tools/color-scan.js <game dir> [corpus dir] [--json <out>] [--keys <out>]\n');
        process.exit(2);
    }
    const sources = [{ name: 'game', files: ['gui', 'gfx', 'common'].flatMap((d) => walk(path.join(gameDir, d), [])) }];
    if (corpusDir) {
        for (const slug of fs.readdirSync(corpusDir).sort()) {
            const dir = path.join(corpusDir, slug);
            if (fs.statSync(dir).isDirectory()) {
                sources.push({ name: `corpus:${slug}`, files: walk(dir, []) });
            }
        }
    }

    const all = [];
    for (const source of sources) {
        for (const file of source.files) {
            all.push({
                source: source.name,
                kind: path.extname(file).toLowerCase().slice(1),
                namedColours: isNamedColourFile(file),
                occ: occurrences(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')),
            });
        }
    }

    // Named-colour definitions: entries of the top-level `colors` block of named_colors files.
    const isDefinition = (f, o) => f.namedColours && o.depth === 1 && o.parent === 'colors';
    const namedColours = new Set();
    for (const f of all) {
        for (const o of f.occ) {
            if (isDefinition(f, o)) {
                namedColours.add(o.key);
            }
        }
    }

    // Per-key evidence, definitions excluded.
    const perKey = new Map();
    for (const f of all) {
        for (const o of f.occ) {
            if (isDefinition(f, o)) {
                continue;
            }
            if (!perKey.has(o.key)) {
                perKey.set(o.key, { total: 0, prefixed: 0, lists: 0, bindings: 0, gui: 0, txt: 0 });
            }
            const s = perKey.get(o.key);
            s.total++;
            s[f.kind === 'txt' ? 'txt' : 'gui']++;
            if (PREFIXES.has(o.kind)) {
                s.prefixed++;
            } else if (o.kind === 'bare') {
                s.lists++;
            } else if (o.kind === 'scalar' && isBinding(o.word)) {
                s.bindings++;
            }
        }
    }
    const colourKeys = new Map();
    for (const [key, s] of perKey) {
        if (s.prefixed > 0) {
            colourKeys.set(key, { ...s, rule: 1 });
        }
    }
    for (const [key, s] of perKey) {
        if (colourKeys.has(key) || !/colou?r/i.test(key) || s.gui === 0) {
            continue;
        }
        // Rule 2 counts only the key's GUI/GFX/asset occurrences.
        const g = { total: 0, lists: 0, bindings: 0 };
        for (const f of all) {
            if (f.kind === 'txt') {
                continue;
            }
            for (const o of f.occ) {
                if (o.key !== key) {
                    continue;
                }
                g.total++;
                if (o.kind === 'bare') {
                    g.lists++;
                } else if (o.kind === 'scalar' && isBinding(o.word)) {
                    g.bindings++;
                }
            }
        }
        const counted = g.total - g.bindings;
        if (g.lists >= 3 && g.lists / counted >= 0.9) {
            colourKeys.set(key, { ...s, rule: 2 });
        }
    }

    // Count notations: prefixed values and named-colour definitions anywhere; bare lists,
    // hex strings and names under colour keys.
    const table = {};
    const ranges = Object.fromEntries(NOTATIONS.map((n) => [n, newRange()]));
    const examples = {};
    const writtenForms = {};
    const definitions = Object.fromEntries(NOTATIONS.map((n) => [n, 0]));
    const bump = (source, kind, notation) => {
        const row = (table[`${source}|${kind}`] ||= Object.fromEntries(NOTATIONS.map((n) => [n, 0])));
        row[notation]++;
    };
    for (const f of all) {
        for (const o of f.occ) {
            const definition = isDefinition(f, o);
            let notation;
            if (PREFIXES.has(o.kind)) {
                notation = o.kind;
                writtenForms[o.written] = (writtenForms[o.written] || 0) + 1;
            } else if (!definition && !colourKeys.has(o.key)) {
                continue;
            } else if (o.kind === 'bare') {
                notation = bareClass(o.values);
            } else if (o.kind === 'scalar') {
                if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(o.word) || /^0x[0-9a-fA-F]{6,8}$/.test(o.word)) {
                    notation = 'hex';
                } else if (namedColours.has(o.word)) {
                    notation = 'named';
                } else {
                    continue;
                }
            } else {
                continue;
            }
            bump(f.source, f.kind, notation);
            if (definition) {
                definitions[notation]++;
            }
            if (o.values && notation !== 'hex') {
                recordRange(ranges[notation], notation, o.values);
            } else {
                ranges[notation].count++;
                ranges[notation].inRange++;
            }
            if (!examples[notation]) {
                examples[notation] = `${o.key} = ${o.written ? `${o.written} ` : ''}${o.values ? `{ ${o.values.join(' ')} }` : o.word}`;
            }
        }
    }

    const keyList = [...colourKeys.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, s]) => ({ key, rule: s.rule, prefixed: s.prefixed, lists: s.lists, occurrences: s.total }));
    const result = {
        generated: 'node tools/color-scan.js <game dir> <corpus dir>',
        files: Object.fromEntries(sources.map((s) => [s.name, s.files.length])),
        table,
        namedColourDefinitions: { names: namedColours.size, byNotation: definitions },
        ranges,
        examples,
        writtenForms,
        colourKeys: keyList,
    };
    const json = JSON.stringify(result, null, 2) + '\n';
    if (jsonOut) {
        fs.writeFileSync(jsonOut, json);
    } else {
        process.stdout.write(json);
    }
    if (keysOut) {
        const keys = {
            source:
                'Generated by tools/color-scan.js from the CK3 1.20 base game (gui, gfx, common) and the real-mod corpus; ' +
                'rule 1 = written with an rgb/hsv/hsv360/hex value somewhere, rule 2 = a GUI/GFX/asset key named *color*/*colour* ' +
                'whose values are number lists in at least 90% of its non-binding occurrences. ' +
                'See Documentation/developer-guide/color-notations.md.',
            keys: keyList.map((k) => ({ key: k.key, rule: k.rule, prefixed: k.prefixed, lists: k.lists })),
        };
        fs.writeFileSync(keysOut, JSON.stringify(keys, null, 4) + '\n');
    }
}

main();
