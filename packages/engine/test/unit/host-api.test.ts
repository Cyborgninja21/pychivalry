/**
 * API added for hosts that embed the engine (the VS Code extension, Phase 4).
 */

import * as assert from 'assert';
import * as path from 'path';

import { defaultSpec, loadSpec, packageRoot, setDefaultSpec } from '../../src/spec';

const VENDORED = path.join(packageRoot(), 'spec', 'ck3-spec-1.20.0.2.json.gz');

describe('Host API: setDefaultSpec', () => {
    it('makes the given spec the one defaultSpec() returns', () => {
        const previous = defaultSpec();
        const other = loadSpec(VENDORED);
        assert.notStrictEqual(other, previous);
        try {
            setDefaultSpec(other);
            assert.strictEqual(defaultSpec(), other);
        } finally {
            setDefaultSpec(previous);
        }
        assert.strictEqual(defaultSpec(), previous);
    });
});
