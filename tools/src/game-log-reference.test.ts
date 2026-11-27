/**
 * docs/game-log.md's part written from the code (game-log-reference.ts): the committed page is
 * the one the matcher gives on the committed catalogue.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { currentGameLogPage, GAME_LOG_PAGE } from './game-log-reference.js';
import { repoRoot } from './util.js';

const root = repoRoot();

test('the committed game-log page is the one the matcher gives (task docs:game-log writes it)', () => {
    const committed = readFileSync(path.join(root, GAME_LOG_PAGE), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(committed, currentGameLogPage(root));
});
