/**
 * The argument reader (args.ts): flags, options with a value written two ways, options given
 * again, comma-separated lists, `--`, and each kind of mistake.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listValues, oneValue, parseArgs, UsageError, type OptionSpec } from './args.js';

const OPTIONS: OptionSpec[] = [
    { name: '--json', help: '' },
    { name: '--spec', value: '<file>', help: '' },
    { name: '--code', value: '<code>', repeat: true, help: '' },
];

test('flags, values, repeated options and positionals', () => {
    const parsed = parseArgs(
        ['mod', '--json', '--spec', 'a.gz', '--code=names/*,syntax/*', '--code', ' x '],
        OPTIONS,
    );
    assert.deepEqual(parsed.positionals, ['mod']);
    assert.ok(parsed.flags.has('--json'));
    assert.equal(oneValue(parsed, '--spec'), 'a.gz');
    assert.equal(oneValue(parsed, '--json'), undefined);
    assert.deepEqual(listValues(parsed, '--code'), ['names/*', 'syntax/*', 'x']);
    assert.deepEqual(listValues(parsed, '--spec'), ['a.gz']);
});

test('-- ends the options; a single dash is a positional', () => {
    const parsed = parseArgs(['--json', '--', '--spec', '-'], OPTIONS);
    assert.deepEqual(parsed.positionals, ['--spec', '-']);
    assert.ok(parsed.flags.has('--json'));
});

test('each mistake is a usage error', () => {
    for (const argv of [['--nope'], ['--json=yes'], ['--spec'], ['--spec', 'a', '--spec', 'b']]) {
        assert.throws(() => parseArgs(argv, OPTIONS), UsageError, argv.join(' '));
    }
});
