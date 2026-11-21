/**
 * The game-log oracle (Phase 4.6): every error.log line that names a file of the example
 * corpus must map to an engine diagnostic with the same catalogue id at that line.
 *
 * Fixture origin: no recorded error.log existed under src/test/fixtures/, and no game run
 * is possible on the machine that wrote this test, so src/test/fixtures/game-logs/
 * error.log was recorded by hand on 2026-10-01 from the example corpus. Each error line
 * is the spec package's catalogue text (strings taken from the CK3 1.20.0.2 executable)
 * filled in for a defect the corpus fixtures contain (their `# ERROR` annotations and the
 * engine expectations of packages/engine/test/fixtures/corpus-expectations.json), with
 * the `[time][E][source.cpp:line]: ` prefix of game log lines and a `<file>:<line>`
 * location in the form the engine itself prints (unknown_modifier_type_X_at_X). The cpp
 * sources and line numbers in the prefixes are illustrative. Replace the fixture with a
 * real error.log when one is captured from the game; the test is written for that.
 *
 * The log subsystem is used as it is: CK3LogAnalyzer reads each line and, where one of
 * its patterns recognises it, the file and line it extracts must equal the location the
 * oracle reads. The catalogue id comes from Spec.matchMessage.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { defaultSpec, diagnose, Workspace } from 'pychivalry-engine';
import { CK3LogAnalyzer } from '../../server/log/analyzer';

const LOCATION = /\s+at\s+([A-Za-z0-9_/\\.-]+\.txt):(\d+)\s*$/;
const PREFIX = /^\[[^\]]*\](?:\[[A-Z]\])?\[[^\]]*\]:\s*/;

function fixturesRoot(): string {
    // out/test/unit → src/test/fixtures
    return path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures');
}

describe('Game log oracle: error.log lines map to engine diagnostics', () => {
    const corpus = path.join(fixturesRoot(), 'mock-ck3-mod');
    const logFile = path.join(fixturesRoot(), 'game-logs', 'error.log');
    const lines = fs
        .readFileSync(logFile, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim());
    const workspace = new Workspace(corpus).load();
    const spec = defaultSpec();
    const analyzer = new CK3LogAnalyzer();

    const located = lines
        .map((line) => ({ line, at: LOCATION.exec(line) }))
        .filter((x) => x.at && fs.existsSync(path.join(corpus, x.at[1])));

    it('the fixture names corpus files', () => {
        assert.ok(located.length >= 10, `only ${located.length} located lines`);
    });

    for (const { line, at } of located) {
        const rel = at ? at[1] : '';
        const lineNumber = at ? Number(at[2]) : 0;
        it(`${rel}:${lineNumber}`, () => {
            const message = line.replace(PREFIX, '');
            const matched = spec.matchMessage(message);
            assert.ok(matched, `no catalogue entry matches: ${message}`);

            // The log subsystem, where it recognises the line, finds the same location.
            const analysis = analyzer.analyzeLine(line, 'error.log');
            if (analysis && analysis.sourceFile !== undefined) {
                assert.strictEqual(analysis.sourceFile.replace(/\\/g, '/'), rel);
                assert.strictEqual(analysis.lineNumber, lineNumber);
            }

            const diagnostics = diagnose(workspace, path.join(corpus, rel));
            const here = diagnostics.filter((d) => d.range.start.line + 1 === lineNumber);
            assert.ok(
                here.some((d) => d.code === matched.id),
                `${rel}:${lineNumber} expected ${matched.id}; the engine reports ` +
                    JSON.stringify(here.map((d) => d.code))
            );
        });
    }
});
