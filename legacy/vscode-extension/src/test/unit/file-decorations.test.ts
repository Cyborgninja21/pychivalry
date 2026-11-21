/**
 * Explorer decoration rules (#87), the pure mapping behind client/file-decorations.ts.
 */

import * as assert from 'assert';
import {
    badgeText,
    decorationFor,
    parentFolderUris,
    WorkspaceHealth,
} from '../../client/workspace-health';

describe('File decoration rules', () => {
    it('badge = count of the highest severity, at most two characters', () => {
        assert.strictEqual(badgeText(1), '1');
        assert.strictEqual(badgeText(9), '9');
        assert.strictEqual(badgeText(10), '9+');
        assert.strictEqual(badgeText(1500), '9+');
        assert.deepStrictEqual(decorationFor({ errors: 3, warnings: 40, information: 2 }), {
            badge: '3',
            color: 'list.errorForeground',
            tooltip: 'CK3: 3 errors, 40 warnings, 2 information',
        });
        assert.deepStrictEqual(decorationFor({ errors: 0, warnings: 12, information: 0 }), {
            badge: '9+',
            color: 'list.warningForeground',
            tooltip: 'CK3: 0 errors, 12 warnings, 0 information',
        });
        assert.strictEqual(
            decorationFor({ errors: 1, warnings: 1, information: 0 })?.tooltip,
            'CK3: 1 error, 1 warning, 0 information'
        );
    });

    it('nothing for information-only, clean or unknown files', () => {
        assert.strictEqual(decorationFor({ errors: 0, warnings: 0, information: 7 }), undefined);
        assert.strictEqual(decorationFor({ errors: 0, warnings: 0, information: 0 }), undefined);
        assert.strictEqual(decorationFor(undefined), undefined);
    });

    it('a file fixed to zero or deleted (empty publish) loses its decoration', () => {
        const health = new WorkspaceHealth();
        health.apply({ uri: 'file:///m/events/a.txt', errors: 2, warnings: 0, information: 0 });
        assert.strictEqual(decorationFor(health.countsOf('file:///m/events/a.txt'))?.badge, '2');
        health.apply({ uri: 'file:///m/events/a.txt', errors: 0, warnings: 0, information: 0 });
        assert.strictEqual(decorationFor(health.countsOf('file:///m/events/a.txt')), undefined);
    });

    it('parent folders stop at the workspace folder', () => {
        assert.deepStrictEqual(
            parentFolderUris('file:///home/me/mod/events/sub/a.txt', ['file:///home/me/mod']),
            ['file:///home/me/mod/events/sub', 'file:///home/me/mod/events', 'file:///home/me/mod']
        );
        assert.deepStrictEqual(
            parentFolderUris('file:///c%3A/mod/events/a.txt', ['file:///c%3A/mod/']),
            ['file:///c%3A/mod/events', 'file:///c%3A/mod']
        );
        // Outside every workspace folder: up to the file system root.
        assert.deepStrictEqual(parentFolderUris('file:///x/y/a.txt', ['file:///home/me/mod']), [
            'file:///x/y',
            'file:///x',
        ]);
        assert.deepStrictEqual(parentFolderUris('untitled:Untitled-1'), []);
    });
});
