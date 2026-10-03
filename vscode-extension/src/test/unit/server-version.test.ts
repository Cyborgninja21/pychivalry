/**
 * serverInfo.version is the extension's package.json version.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { extensionVersion } from '../../server/version';

describe('Server version', () => {
    it('equals the version in the extension package.json', () => {
        const pkg: unknown = JSON.parse(
            fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'package.json'), 'utf8')
        );
        assert.ok(typeof pkg === 'object' && pkg !== null);
        assert.strictEqual(Reflect.get(pkg, 'name'), 'ck3-language-support');
        assert.strictEqual(extensionVersion(), Reflect.get(pkg, 'version'));
        assert.strictEqual(extensionVersion(), '2.2.0');
    });
});
