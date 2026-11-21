#!/usr/bin/env node
/**
 * pychivalry-engine check <modDir> [--spec <file>] [--json] [--vanilla <dir>]
 *
 * Prints the engine diagnostics of every script file under <modDir>: grouped by file as
 * text (default) or one JSON object per line (--json). --vanilla points at a vanilla game
 * directory (the one holding common/ and events/) used as the base game for scripted-name
 * lookups. Exit code 1 when any error is reported, 2 on a usage error.
 */

import * as fs from 'fs';

import { diagnoseWorkspace, Diagnostic } from './diagnostics';
import { Workspace } from './index/workspace';
import { defaultSpec, loadSpec } from './spec/spec';

const USAGE =
    'usage: pychivalry-engine check <modDir> [--spec <file>] [--json] [--vanilla <dir>]\n';

interface CliArgs {
    modDir: string;
    spec?: string;
    json: boolean;
    vanilla?: string;
}

function parseArgs(argv: string[]): CliArgs | string {
    if (argv[0] !== 'check') {
        return USAGE;
    }
    const args: CliArgs = { modDir: '', json: false };
    for (let i = 1; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--json') {
            args.json = true;
        } else if (arg === '--spec' || arg === '--vanilla') {
            const value = argv[++i];
            if (value === undefined) {
                return `${arg} needs a value\n${USAGE}`;
            }
            if (arg === '--spec') {
                args.spec = value;
            } else {
                args.vanilla = value;
            }
        } else if (arg.startsWith('--')) {
            return `unknown option ${arg}\n${USAGE}`;
        } else if (args.modDir === '') {
            args.modDir = arg;
        } else {
            return `unexpected argument ${arg}\n${USAGE}`;
        }
    }
    if (args.modDir === '') {
        return USAGE;
    }
    return args;
}

/** Text output: files in order, one line per diagnostic, a summary line at the end. */
export function formatText(results: Map<string, Diagnostic[]>): string {
    const lines: string[] = [];
    let errors = 0;
    let warnings = 0;
    let other = 0;
    for (const [file, diagnostics] of results) {
        if (diagnostics.length === 0) {
            continue;
        }
        lines.push(file);
        for (const d of diagnostics) {
            const pos = `${d.range.start.line + 1}:${d.range.start.character + 1}`;
            lines.push(`  ${pos}  ${d.severity}  ${d.code}  ${d.message}`);
            if (d.severity === 'error') {
                errors++;
            } else if (d.severity === 'warning') {
                warnings++;
            } else {
                other++;
            }
        }
        lines.push('');
    }
    lines.push(
        `${results.size} files checked: ${errors} errors, ${warnings} warnings, ${other} other`
    );
    return `${lines.join('\n')}\n`;
}

export function formatJson(results: Map<string, Diagnostic[]>): string {
    const lines: string[] = [];
    for (const diagnostics of results.values()) {
        for (const d of diagnostics) {
            lines.push(JSON.stringify(d));
        }
    }
    return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

export function main(argv: string[]): number {
    const parsed = parseArgs(argv);
    if (typeof parsed === 'string') {
        process.stderr.write(parsed);
        return 2;
    }
    if (!fs.existsSync(parsed.modDir) || !fs.statSync(parsed.modDir).isDirectory()) {
        process.stderr.write(`not a directory: ${parsed.modDir}\n`);
        return 2;
    }
    const spec = parsed.spec ? loadSpec(parsed.spec) : defaultSpec();
    const workspace = new Workspace(parsed.modDir, { spec, vanilla: parsed.vanilla });
    const results = diagnoseWorkspace(workspace);
    process.stdout.write(parsed.json ? formatJson(results) : formatText(results));
    const hasError = Array.from(results.values()).some((ds) =>
        ds.some((d) => d.severity === 'error')
    );
    return hasError ? 1 : 0;
}

if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}
