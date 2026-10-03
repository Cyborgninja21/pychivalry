#!/usr/bin/env node
/**
 * Count the colour values the extension's colour provider finds (development tool; run
 * `task compile:tests` first, it reads vscode-extension/out).
 *
 *   node tools/color-count.js <dir> [--game <game dir>] [--ext gui,gfx,txt,asset]
 *
 * For every file of <dir> with one of the extensions (default: gui), the provider's
 * findColors decides the path: the engine's tree when the file parses without errors,
 * the lexer-token scan when it does not. Printed per path: files and colour values, per
 * notation; and, for the files the tree path read, how many values the token scan finds on
 * the same text (the two paths must agree there). Named colours are resolved against
 * <game dir>/common/named_colors when --game is given.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { ColorProvider } = require(
    path.join(root, 'vscode-extension', 'out', 'server', 'lsp', 'color-provider.js')
);
const { CK3Parser, pathToUri } = require(path.join(root, 'packages', 'engine'));

function walk(dir, extensions, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, extensions, out);
        } else if (extensions.includes(path.extname(entry.name).slice(1).toLowerCase())) {
            out.push(full);
        }
    }
    return out;
}

async function main() {
    const args = process.argv.slice(2);
    const option = (name, fallback) => {
        const at = args.indexOf(name);
        if (at < 0) {
            return fallback;
        }
        const value = args[at + 1];
        args.splice(at, 2);
        return value;
    };
    const game = option('--game');
    const extensions = option('--ext', 'gui').split(',');
    const dir = args[0];
    if (!dir) {
        process.stderr.write('usage: node tools/color-count.js <dir> [--game <dir>] [--ext gui,...]\n');
        process.exit(2);
    }
    const parser = new CK3Parser();
    const provider = new ColorProvider(parser);
    if (game) {
        await provider.named.load([game], parser);
    }
    const result = {
        dir,
        namedColors: provider.named.size,
        tree: { files: 0, values: 0, notations: {} },
        scan: { files: 0, values: 0, notations: {} },
        scanOnTreeFiles: { values: 0, filesDisagreeing: 0 },
    };
    for (const file of walk(dir, extensions, []).sort()) {
        const text = fs.readFileSync(file, 'utf8');
        const uri = pathToUri(file);
        const found = provider.findColors(text, uri);
        const bucket = result[found.path];
        bucket.files++;
        bucket.values += found.values.length;
        for (const v of found.values) {
            bucket.notations[v.notation] = (bucket.notations[v.notation] || 0) + 1;
        }
        if (found.path === 'tree') {
            const scanned = provider.fromTokens(text, uri);
            result.scanOnTreeFiles.values += scanned.length;
            const same =
                scanned.length === found.values.length &&
                scanned.every(
                    (s, i) =>
                        s.notation === found.values[i].notation &&
                        JSON.stringify(s.range) === JSON.stringify(found.values[i].range)
                );
            if (!same) {
                result.scanOnTreeFiles.filesDisagreeing++;
            }
        }
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exit(1);
});
