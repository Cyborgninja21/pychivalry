/**
 * Status-bar text mapping (#84), the pure functions behind statusBar.ts CK3HealthStatusBar.
 */

import * as assert from 'assert';
import {
    HealthSummary,
    statusBarBackground,
    statusBarText,
    statusBarTooltip,
    WorkspaceHealth,
} from '../../client/workspace-health';

const base: HealthSummary = {
    errors: 0,
    warnings: 0,
    information: 0,
    filesAffected: 0,
    state: 'idle',
    done: 0,
    total: 0,
    limited: false,
};

describe('Status bar mapping', () => {
    it('shows the totals, and a spinner with done/total while a pass runs', () => {
        assert.strictEqual(
            statusBarText({ ...base, errors: 3, warnings: 12 }),
            '$(error) 3 $(warning) 12'
        );
        assert.strictEqual(
            statusBarText({ ...base, state: 'running', done: 40, total: 1313, errors: 1 }),
            '$(sync~spin) 40/1313 $(error) 1 $(warning) 0'
        );
    });

    it('the colour follows the worst severity', () => {
        assert.strictEqual(
            statusBarBackground({ ...base, errors: 1, warnings: 5 }),
            'statusBarItem.errorBackground'
        );
        assert.strictEqual(
            statusBarBackground({ ...base, warnings: 5 }),
            'statusBarItem.warningBackground'
        );
        assert.strictEqual(statusBarBackground({ ...base, information: 9 }), undefined);
    });

    it('the tooltip has the three counts, the files affected and the last full pass', () => {
        const tooltip = statusBarTooltip(
            {
                ...base,
                errors: 2,
                warnings: 3,
                information: 4,
                filesAffected: 2,
                lastFullPassAt: 5,
            },
            (ms) => `t${ms}`
        );
        assert.deepStrictEqual(tooltip.split('\n'), [
            'CK3 workspace: 2 errors, 3 warnings, 4 information',
            'Files with errors or warnings: 2',
            'Last full validation: t5',
            'Click to open the Problems panel',
        ]);
        const running = statusBarTooltip({
            ...base,
            state: 'running',
            done: 1,
            total: 9,
            limited: true,
        });
        assert.ok(running.includes('No full validation yet'));
        assert.ok(running.includes('Validating: 1/9 files'));
        assert.ok(running.includes('Only open files are validated'));
    });

    it('follows the notification stream through the store', () => {
        const health = new WorkspaceHealth();
        health.apply({ state: 'running', done: 0, total: 2, limited: false });
        health.apply({ uri: 'file:///m/a.txt', errors: 1, warnings: 2, information: 0 });
        assert.strictEqual(
            statusBarText(health.summary()),
            '$(sync~spin) 0/2 $(error) 1 $(warning) 2'
        );
        health.apply({ state: 'idle', done: 2, total: 2, limited: false });
        assert.strictEqual(statusBarText(health.summary()), '$(error) 1 $(warning) 2');
    });
});
