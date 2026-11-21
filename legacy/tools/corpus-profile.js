#!/usr/bin/env node
/**
 * preLaunchTask of the "Corpus Suite - one mod (editor path)" launch configuration: writes a
 * VS Code profile (user-data folder) whose only setting is ck3LanguageServer.gamePath, so the
 * Extension Development Host checks the mod against the base game, as runTest.ts does for
 * `task test:integration` with CK3_CORPUS and CK3_GAME_PATH. Your own VS Code profile is not
 * touched.
 *
 *   node tools/corpus-profile.js <game dir>
 */
'use strict';

const fs = require('fs');
const path = require('path');

const game = process.argv[2];
if (!game || !fs.existsSync(path.join(game, 'common'))) {
    process.stderr.write('usage: node tools/corpus-profile.js <CK3 game dir holding common/>\n');
    process.exit(2);
}
const user = path.resolve(__dirname, '..', 'vscode-extension', '.vscode-test', 'corpus-profile', 'User');
fs.mkdirSync(user, { recursive: true });
fs.writeFileSync(
    path.join(user, 'settings.json'),
    JSON.stringify({ 'ck3LanguageServer.gamePath': game }, null, 4) + '\n'
);
process.stdout.write(`corpus profile: ${path.dirname(user)} (gamePath ${game})\n`);
