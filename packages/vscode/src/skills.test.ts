import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import {
    claudeSkillsDir,
    installSkills,
    loadSkillsRecords,
    readSkillsRecords,
    removeSkills,
    saveSkillsRecords,
    SKILL_FILE,
    withSkillsRecord,
    type Skill,
} from './skills.js';

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-skills-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

function skill(name: string, text: string): Skill {
    const bytes = Buffer.from(text, 'utf8');
    return {
        name,
        files: [
            {
                path: SKILL_FILE,
                bytes,
                sha256: createHash('sha256').update(bytes).digest('hex'),
            },
        ],
    };
}

const v1 = [
    skill('pychivalry-a', '---\nname: pychivalry-a\n---\none\n'),
    skill('pychivalry-b', 'b1'),
];
const v2 = [
    skill('pychivalry-a', '---\nname: pychivalry-a\n---\ntwo\n'),
    skill('pychivalry-c', 'c2'),
];

const read = (dir: string, name: string): string =>
    readFileSync(path.join(dir, name, SKILL_FILE), 'utf8');

test("Claude Code's skills folder: CLAUDE_CONFIG_DIR's, else ~/.claude's, on Linux and Windows", () => {
    assert.equal(
        claudeSkillsDir({ env: {}, platform: 'linux', home: '/home/u' }),
        '/home/u/.claude/skills',
    );
    assert.equal(
        claudeSkillsDir({
            env: { CLAUDE_CONFIG_DIR: '/cfg/claude' },
            platform: 'linux',
            home: '/h',
        }),
        '/cfg/claude/skills',
    );
    assert.equal(
        claudeSkillsDir({ env: { CLAUDE_CONFIG_DIR: '' }, platform: 'linux', home: '/h' }),
        '/h/.claude/skills',
        'an empty variable counts as unset',
    );
    assert.equal(
        claudeSkillsDir({ env: {}, platform: 'win32', home: 'C:\\Users\\A B' }),
        'C:\\Users\\A B\\.claude\\skills',
    );
    // On Windows the variable is read in any letter case, and the path is Windows'.
    assert.equal(
        claudeSkillsDir({
            env: { claude_config_dir: 'D:\\Claude & co (100%)' },
            platform: 'win32',
            home: 'C:\\Users\\u',
        }),
        'D:\\Claude & co (100%)\\skills',
    );
    assert.equal(
        claudeSkillsDir({ env: { claude_config_dir: '/x' }, platform: 'linux', home: '/h' }),
        '/h/.claude/skills',
        'on Linux the name is exact',
    );
    // Claude Code normalises its folder to NFC: so does this.
    assert.equal(
        claudeSkillsDir({ env: {}, platform: 'linux', home: '/home/Re\u0301my' }),
        '/home/R\u00e9my/.claude/skills',
    );
    assert.throws(
        () => claudeSkillsDir({ env: { CLAUDE_CONFIG_DIR: 'rel' }, platform: 'linux', home: '/h' }),
        /not an absolute path: rel/,
    );
    assert.throws(
        () =>
            claudeSkillsDir({
                env: { CLAUDE_CONFIG_DIR: 'cfg' },
                platform: 'win32',
                home: 'C:\\u',
            }),
        /not an absolute path/,
    );
});

test('installed into an empty folder, then again: written once, then nothing changes', (t) => {
    const dir = path.join(scratch(t), 'claude config', 'skills');
    const first = installSkills(v1, dir, null);
    assert.deepEqual(first.written, ['pychivalry-a', 'pychivalry-b']);
    assert.deepEqual([first.unchanged, first.removed, first.refused], [[], [], []]);
    assert.equal(read(dir, 'pychivalry-a'), '---\nname: pychivalry-a\n---\none\n');
    assert.deepEqual(first.record.names, ['pychivalry-a', 'pychivalry-b']);
    assert.equal(first.record.sha256.length, 2);
    const again = installSkills(v1, dir, first.record);
    assert.deepEqual(again.written, []);
    assert.deepEqual(again.unchanged, ['pychivalry-a', 'pychivalry-b']);
    assert.deepEqual(again.record, first.record);
    // Nothing but the skills' own folders: no manifest, no temporary file.
    assert.deepEqual(readdirSync(dir).sort(), ['pychivalry-a', 'pychivalry-b']);
    assert.deepEqual(readdirSync(path.join(dir, 'pychivalry-a')), [SKILL_FILE]);
});

test("a newer version replaces pychivalry's own copies and takes away a skill it no longer has", (t) => {
    const dir = scratch(t);
    const first = installSkills(v1, dir, null);
    const second = installSkills(v2, dir, first.record);
    assert.deepEqual(second.written, ['pychivalry-a', 'pychivalry-c']);
    assert.deepEqual(second.removed, ['pychivalry-b']);
    assert.equal(read(dir, 'pychivalry-a'), '---\nname: pychivalry-a\n---\ntwo\n');
    assert.ok(!existsSync(path.join(dir, 'pychivalry-b')));
    assert.deepEqual(second.record.names, ['pychivalry-a', 'pychivalry-c']);
    // Every version's bytes are remembered, so an older copy is still known as pychivalry's.
    assert.equal(second.record.sha256.length, 4);
    // Back to the first version: its copies are replaced again.
    const back = installSkills(v1, dir, second.record);
    assert.deepEqual(back.written, ['pychivalry-a', 'pychivalry-b']);
    assert.deepEqual(back.removed, ['pychivalry-c']);
});

test('a skill of the same name pychivalry did not write, or one the person changed, is left as it is', (t) => {
    const dir = scratch(t);
    mkdirSync(path.join(dir, 'pychivalry-b'), { recursive: true });
    writeFileSync(path.join(dir, 'pychivalry-b', SKILL_FILE), 'my own');
    const first = installSkills(v1, dir, null);
    assert.deepEqual(first.written, ['pychivalry-a']);
    const [refusal, ...more] = first.refused;
    assert.ok(refusal !== undefined && more.length === 0);
    assert.equal(refusal.name, 'pychivalry-b');
    assert.match(refusal.reason, /SKILL\.md in .* is not pychivalry's/);
    assert.equal(read(dir, 'pychivalry-b'), 'my own');
    assert.deepEqual(first.record.names, ['pychivalry-a'], "not recorded as pychivalry's");
    // The person edits pychivalry's copy: an update leaves it, and a removal keeps it.
    writeFileSync(path.join(dir, 'pychivalry-a', SKILL_FILE), 'edited');
    const update = installSkills(v2, dir, first.record);
    assert.deepEqual(
        update.refused.map((r) => r.name),
        ['pychivalry-a'],
    );
    assert.equal(read(dir, 'pychivalry-a'), 'edited');
    // A file of the person's own beside pychivalry's copy is left, and does not stop an update.
    const other = scratch(t);
    const done = installSkills(v1, other, null);
    writeFileSync(path.join(other, 'pychivalry-a', 'notes.md'), 'mine');
    assert.deepEqual(installSkills(v2, other, done.record).written, [
        'pychivalry-a',
        'pychivalry-c',
    ]);
    assert.equal(readFileSync(path.join(other, 'pychivalry-a', 'notes.md'), 'utf8'), 'mine');
});

test('a refresh after an update brings copies up to date but writes no skill that was taken away', (t) => {
    const dir = scratch(t);
    const first = installSkills(v1, dir, null);
    rmSync(path.join(dir, 'pychivalry-b'), { recursive: true });
    const refreshed = installSkills(
        [skill('pychivalry-a', 'newer'), skill('pychivalry-b', 'b2')],
        dir,
        first.record,
        true,
    );
    assert.deepEqual(refreshed.written, ['pychivalry-a']);
    assert.equal(read(dir, 'pychivalry-a'), 'newer');
    assert.ok(!existsSync(path.join(dir, 'pychivalry-b')));
    assert.deepEqual(refreshed.record.names, ['pychivalry-a']);
});

test('removed: only the files pychivalry wrote, the folders they leave empty, and nothing else', (t) => {
    const root = scratch(t);
    const dir = path.join(root, 'skills');
    mkdirSync(path.join(dir, 'someone-elses'), { recursive: true });
    writeFileSync(path.join(dir, 'someone-elses', SKILL_FILE), 'theirs');
    const first = installSkills(v1, dir, null);
    writeFileSync(path.join(dir, 'pychivalry-b', 'notes.md'), 'mine');
    const removal = removeSkills(first.record);
    assert.deepEqual(removal.removed, ['pychivalry-a']);
    assert.deepEqual(
        removal.kept.map((k) => k.name),
        ['pychivalry-b'],
    );
    assert.match(removal.kept[0]?.reason ?? '', /notes\.md in .* was not written by pychivalry/);
    assert.ok(!existsSync(path.join(dir, 'pychivalry-a')));
    assert.deepEqual(readdirSync(path.join(dir, 'pychivalry-b')), ['notes.md']);
    assert.equal(read(dir, 'someone-elses'), 'theirs');
    assert.deepEqual(removal.record.names, []);
    // Removed twice: nothing left to do, nothing fails.
    assert.deepEqual(removeSkills({ ...first.record, names: ['pychivalry-a'] }).removed, [
        'pychivalry-a',
    ]);
});

test('the records: kept as JSON in a file of global storage, one per folder, dropped when empty', (t) => {
    const a = { dir: '/a/skills', names: ['x'], sha256: ['1'] };
    const b = { dir: 'C:\\b\\skills', names: ['y'], sha256: ['2'] };
    const records = readSkillsRecords(
        JSON.parse(
            JSON.stringify([a, b, 'junk', { dir: 1 }, { dir: '/c', names: [1], sha256: [] }]),
        ),
    );
    assert.deepEqual(records, [a, b]);
    assert.deepEqual(readSkillsRecords(undefined), []);
    const replaced = withSkillsRecord(records, { ...a, names: ['x', 'z'] });
    assert.deepEqual(replaced, [b, { ...a, names: ['x', 'z'] }]);
    assert.deepEqual(withSkillsRecord(records, { ...a, names: [] }), [b]);
    // Saved and loaded again; an absent or broken file is no record.
    const file = path.join(scratch(t), 'global storage', 'claude-code-skills.json');
    assert.deepEqual(loadSkillsRecords(file), []);
    saveSkillsRecords(file, replaced);
    assert.deepEqual(loadSkillsRecords(file), replaced);
    writeFileSync(file, '{ broken');
    assert.deepEqual(loadSkillsRecords(file), []);
});
