/**
 * The judge of the scored authoring test (`judge.ts`): its fixed prompt, its fixed answer
 * schema and its fixed parsing, the arguments and the confinement of its session, and what it
 * is shown of a result. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { tempDir, writeTree } from '../testing.js';
import type { AuthoringRecord } from './authoring-record.js';
import {
    checkOver,
    DRAFTS_DIR,
    exampleResult,
    judgeStream,
    root,
    spec,
} from './authoring-testing.js';
import { checkExpectations } from './expectations.js';
import { sessionProblems } from './confinement.js';
import {
    checkerFindings,
    checkerText,
    CHECKER_FINDINGS_SHOWN,
    compileJudgeSchema,
    fillTemplate,
    JUDGE_ANSWERS,
    JUDGE_CONFINEMENT,
    JUDGE_PROMPT_FILE,
    JUDGE_PROMPT_VERSION,
    JUDGE_PROMPT_VERSIONS,
    JUDGE_SCHEMA_FILE,
    JUDGE_SLOTS,
    judgeArgs,
    judgeMaterial,
    judgePrompt,
    judgePromptVersion,
    judgeRecord,
    notJudged,
    parseJudgeAnswer,
    resultFiles,
    resultKeywords,
    resultText,
    type JudgeRun,
    type ResultFile,
} from './judge.js';
import { baseDir, committedRequests, type ContentRequest } from './requests.js';
import { SESSION_LIMIT_OPTION } from './run.js';
import { sha256OfFile } from '../util.js';
import { readStream } from './stream.js';

const list = committedRequests(root);
const template = readFileSync(path.join(root, JUDGE_PROMPT_FILE), 'utf8');
const validate = compileJudgeSchema(path.join(root, JUDGE_SCHEMA_FILE));

function request(id: string): ContentRequest {
    const found = list.requests.find((r) => r.id === id);
    assert.ok(found !== undefined, id);
    return found;
}

const alms = request('decision-give-alms');

/** A well-formed answer to every question of `r`, as a JSON object. */
function answerTo(
    r: ContentRequest,
    answers: Record<string, string> = {},
): Record<string, unknown> {
    return {
        request: r.id,
        answers: Object.fromEntries(
            r.judged.map((q) => [
                q.dimension,
                { answer: answers[q.dimension] ?? 'yes', reason: 'It does.' },
            ]),
        ),
    };
}

test('the prompt has each of its six slots once, and the answer schema its closed set of answers', () => {
    for (const slot of JUDGE_SLOTS) {
        assert.equal(template.split(`{{${slot}}}`).length, 2, slot);
    }
    assert.deepEqual(
        template.match(/\{\{[a-z_]+\}\}/g)?.sort(),
        JUDGE_SLOTS.map((s) => `{{${s}}}`).sort(),
    );
    // The prompt names the three answers, and the schema allows exactly them.
    for (const answer of JUDGE_ANSWERS) {
        assert.ok(template.includes(`"${answer}"`), answer);
    }
    const schema = JSON.parse(readFileSync(path.join(root, JUDGE_SCHEMA_FILE), 'utf8')) as {
        properties: {
            answers: { additionalProperties: { properties: { answer: { enum: string[] } } } };
        };
    };
    assert.deepEqual(schema.properties.answers.additionalProperties.properties.answer.enum, [
        ...JUDGE_ANSWERS,
    ]);
});

test('a filled prompt holds the request, its questions and every file of the result, each marked', (t) => {
    const r = request('decision-hold-banquet');
    const mod = exampleResult(t, r);
    // The harness's own folder is not part of the result.
    writeTree(mod, { '.claude/skills/x/SKILL.md': 'not shown' });
    const files = resultFiles(mod, baseDir(root, r.base));
    assert.deepEqual(
        files.map((f) => `${f.path} ${f.state}`),
        [
            'common/decisions/authoring_banquet_decisions.txt written',
            'common/scripted_effects/banquet_effects.txt as given',
            'common/scripted_triggers/banquet_triggers.txt as given',
            'descriptor.mod as given',
            'events/banquet_events.txt as given',
            'localization/english/authoring_banquet_l_english.yml written',
            'localization/english/banquet_l_english.yml as given',
        ],
    );
    const prompt = judgePrompt(
        template,
        r,
        judgeMaterial({ spec, files, game: '1.21.0.3', findings: [] }),
    );
    assert.ok(prompt.includes(`<request id="${r.id}">\n${r.request}\n</request>`));
    for (const q of r.judged) {
        assert.ok(prompt.includes(`- ${q.dimension}: ${q.question}`), q.dimension);
    }
    assert.ok(
        prompt.includes(
            '--- file common/decisions/authoring_banquet_decisions.txt (written while the request was worked on) ---\n# Hold a banquet for the court.\nauthoring_hold_banquet_decision = {',
        ),
    );
    assert.ok(prompt.includes('--- end of common/decisions/authoring_banquet_decisions.txt ---'));
    assert.ok(!prompt.includes('\r'), 'line breaks as \\n');
    assert.ok(!prompt.includes('\uFEFF'), 'no byte-order mark');
    assert.ok(!prompt.includes('not shown'));
    assert.ok(!/\{\{[a-z_]+\}\}/.test(prompt), 'every slot filled');

    // A changed and a removed file are marked so.
    const changed = exampleResult(t, request('trigger-banquet-guest'));
    writeFileSync(path.join(changed, 'descriptor.mod'), 'changed');
    const marks = resultFiles(changed, baseDir(root, 'banquet')).map((f) => `${f.path} ${f.state}`);
    assert.ok(marks.includes('events/banquet_events.txt changed'));
    assert.ok(marks.includes('descriptor.mod changed'));
    const empty = path.join(tempDir(t), 'empty');
    mkdirSync(empty);
    const gone = resultFiles(empty, baseDir(root, 'banquet'));
    assert.ok(gone.every((f) => f.state === 'removed' && f.text === null));
    assert.ok(
        resultText(gone).includes(
            '--- file events/banquet_events.txt (removed while the request was worked on) ---',
        ),
    );
    assert.equal(resultText([]), '(the mod holds no file)');
});

/** The labelled case of `fixtures/requests/judge/` (its README), or a draft, over its request's base. */
function resultOver(t: TestContext, dir: string, base: string): string {
    const mod = path.join(tempDir(t), 'mod');
    cpSync(baseDir(root, base), mod, { recursive: true });
    cpSync(dir, mod, { recursive: true });
    return mod;
}

const JUDGE_CASES = path.join(root, 'fixtures', 'requests', 'judge');

/** What the judge is given for one result over an empty base game, as a run builds it. */
function materialOf(t: TestContext, r: ContentRequest, mod: string) {
    const check = checkOver(t, mod);
    return {
        check,
        material: judgeMaterial({
            spec,
            files: resultFiles(mod, baseDir(root, r.base)),
            game: '1.21.0.3',
            findings: check.findings,
        }),
    };
}

test("the labelled case: what every trigger-loyal-realm result of the expert run wrote is given to the judge with the game's own meaning of popular_opinion", (t) => {
    // fixtures/requests/judge/README.md: five results of this logic were judged yes twice,
    // cannot-tell once and no twice, the judge saying from memory that popular_opinion is not a
    // trigger. In game 1.21.0.3 it is, and county_opinion is not.
    const r = request('trigger-loyal-realm');
    assert.deepEqual(readdirSync(JUDGE_CASES).sort(), [
        'README.md',
        'trigger-loyal-realm-popular-opinion',
    ]);
    const mod = resultOver(
        t,
        path.join(JUDGE_CASES, 'trigger-loyal-realm-popular-opinion'),
        r.base,
    );
    const { check, material } = materialOf(t, r, mod);
    // The checker finds nothing, and every expectation is met: the result is right.
    assert.deepEqual(
        check.findings.map((f) => `${f.severity} ${f.code}`),
        [],
    );
    assert.ok(
        checkExpectations(
            { index: check.index, modDir: mod, givenDir: baseDir(root, r.base) },
            r.expect,
        ).every((e) => e.met),
    );
    // What the judge is given, word for word: version 2 of its material.
    assert.equal(
        material.checker,
        "pychivalry's checker, over the installed game (version 1.21.0.3), reports no error and no warning in this result.",
    );
    assert.equal(
        material.keywords,
        [
            "The game's own description (version 1.21.0.3) of each trigger, effect, iterator and link the result's script files write:",
            '- any_sub_realm_county: an iterator (a trigger) over the list sub_realm_county from character to landed_title; the game\'s description: "Iterate through all counties in sub-realm, counting only titles that either hold land or have dejure vassals that hold land. any_sub_realm_county = { <count=num/all> / <percent=fixed_point> <triggers> }"',
            '- county_control: a trigger; supported scopes: landed_title; the game\'s description: "does the county title have the required county countrol?"',
            '- popular_opinion: a trigger; supported scopes: landed_title; the game\'s description: "Compares the county\'s current opinion of its holder"',
        ].join('\n'),
    );
    const prompt = judgePrompt(template, r, material);
    assert.ok(prompt.includes(`<checker>\n${material.checker}\n</checker>`));
    assert.ok(prompt.includes(`<keywords>\n${material.keywords}\n</keywords>`));
    assert.ok(prompt.includes('popular_opinion >= 20'));
    // The instruction: names and their meanings from the material, never from memory.
    const words = template.replace(/\s+/g, ' ');
    for (const sentence of [
        'what you remember of the game may be of another version.',
        "Take whether a name exists, what it means and which scope it works in from the checker's report and the list of keywords below, never from your memory of the game.",
        'A name the list describes exists in the installed game and means what its line says, whatever another version called it.',
        'A name the checker reports as unknown does not exist there.',
        'Whether the game accepts the files is the checker\'s to say, not yours: do not answer "no" or "cannot-tell" for it.',
    ]) {
        assert.ok(words.includes(sentence), sentence);
    }

    // Its first draft writes county_opinion: the checker's report and the keywords say so.
    const draft = resultOver(t, path.join(root, ...DRAFTS_DIR.split('/'), r.id), r.base);
    const wrong = materialOf(t, r, draft).material;
    assert.equal(
        wrong.checker,
        [
            "pychivalry's checker, over the installed game (version 1.21.0.3), reports 1 error and 0 warnings in this result:",
            "- error names/unknown-trigger at common/scripted_triggers/authoring_loyal_realm_triggers.txt line 6: Unknown trigger 'county_opinion'",
        ].join('\n'),
    );
    assert.ok(
        wrong.keywords.includes(
            '- county_opinion: not a trigger in version 1.21.0.3: the game removed it in 1.21.0.3',
        ),
    );
    assert.ok(!wrong.keywords.includes('- popular_opinion:'));
});

test("the result's keywords: read in their place as the checker reads them, each once, from the spec package", () => {
    const file = (
        p: string,
        text: string | null,
        state: ResultFile['state'] = 'written',
    ): ResultFile => ({
        path: p,
        state,
        text,
    });
    const lines = resultKeywords(spec, [
        file(
            'events/x_events.txt',
            [
                'namespace = x',
                'x.0001 = {',
                '\ttype = character_event',
                '\ttitle = x.0001.t',
                '\ttrigger = {',
                '\t\tis_ruler = yes',
                '\t\tcapital_county.popular_opinion >= 10',
                '\t\tcounty_opinion > 0',
                '\t\tis_ruler = yes',
                '\t}',
                '\timmediate = { add_gold = 5 }',
                '\toption = { name = x.0001.a }',
                '}',
            ].join('\n'),
        ),
        // Localization and removed files hold no keyword.
        file('localization/english/x_l_english.yml', 'l_english:\n add_gold: "x"\n'),
        file('events/gone.txt', null, 'removed'),
    ]).map((l) => `${l.name}: ${l.text.split(';')[0] ?? ''}`);
    assert.deepEqual(lines, [
        'is_ruler: a trigger',
        'capital_county: a link from character to landed_title',
        'popular_opinion: a trigger',
        'county_opinion: not a trigger in version 1.21.0.3: the game removed it in 1.21.0.3',
        'add_gold: an effect',
    ]);
    // Nothing of the game's: a result with no keyword says so.
    assert.equal(
        judgeMaterial({ spec, files: [], game: '1.21.0.3', findings: [] }).keywords,
        "The result's script files write no trigger, effect, iterator or link of the game (version 1.21.0.3).",
    );
});

test("the checker's report: errors and warnings by file and line, advice left out, at most CHECKER_FINDINGS_SHOWN shown", () => {
    const at = (line: number) => ({
        start: { line: line - 1, character: 0 },
        end: { line: line - 1, character: 1 },
    });
    const findings = checkerFindings([
        {
            severity: 'hint',
            code: 'style/unusual-field-order',
            file: 'a.txt',
            range: at(1),
            message: 'hint',
        },
        {
            severity: 'warning',
            code: 'style/not-formatted',
            file: 'b.txt',
            range: at(1),
            message: 'Not\n formatted',
        },
        {
            severity: 'error',
            code: 'names/unknown-trigger',
            file: 'a.txt',
            range: at(3),
            message: "Unknown trigger 'x'",
        },
    ]);
    assert.equal(
        checkerText('1.21.0.3', findings),
        [
            "pychivalry's checker, over the installed game (version 1.21.0.3), reports 1 error and 1 warning in this result:",
            "- error names/unknown-trigger at a.txt line 3: Unknown trigger 'x'",
            '- warning style/not-formatted at b.txt line 1: Not formatted',
        ].join('\n'),
    );
    const many = Array.from({ length: CHECKER_FINDINGS_SHOWN + 2 }, (_, i) => ({
        severity: 'error' as const,
        code: 'names/unknown-effect',
        file: 'c.txt',
        line: i + 1,
        message: 'm',
    }));
    const text = checkerText('1.21.0.3', many);
    assert.match(text, /reports 52 errors and 0 warnings in this result:/);
    assert.equal(text.split('\n').length, 1 + CHECKER_FINDINGS_SHOWN + 1);
    assert.ok(text.endsWith('- and 2 more findings'));
});

test("the judge's prompt is versioned: the committed file is the last version, and every committed authoring record names its version", () => {
    assert.deepEqual(
        JUDGE_PROMPT_VERSIONS.map((v) => v.version),
        JUDGE_PROMPT_VERSIONS.map((_, i) => i + 1),
    );
    assert.equal(
        new Set(JUDGE_PROMPT_VERSIONS.map((v) => v.sha256)).size,
        JUDGE_PROMPT_VERSIONS.length,
    );
    // A change to the prompt is a new version: this fails until a row names the new hash.
    assert.equal(sha256OfFile(path.join(root, JUDGE_PROMPT_FILE)), JUDGE_PROMPT_VERSION.sha256);
    assert.equal(JUDGE_PROMPT_VERSION.version, 2);
    assert.equal(judgePromptVersion('0'.repeat(64)), null);
    // The three authoring records the runs made were judged with version 1; the expert run's
    // kept results, judged again by task scored:rejudge (2026-11-25), with version 2; the expert
    // requests' second development run (2026-11-26, decision 165) with version 2 as it ran.
    const scored = path.join(root, 'records', 'scored');
    const records = readdirSync(scored).filter((f) => f.startsWith('authoring'));
    const judgedWith: Record<string, number> = {
        'authoring-expert-run-1-judge-2.json': 2,
        'authoring-expert-run-1.json': 1,
        'authoring-expert-run-2.json': 2,
        'authoring-run-1.json': 1,
        'authoring.json': 1,
    };
    assert.deepEqual(records.sort(), Object.keys(judgedWith).sort());
    for (const name of records) {
        const record = JSON.parse(readFileSync(path.join(scored, name), 'utf8')) as AuthoringRecord;
        assert.equal(
            judgePromptVersion(record.results.task.judge_prompt_sha256)?.version,
            judgedWith[name],
            name,
        );
    }
});

test('a slot is filled once, and a value written into another is not filled again', () => {
    assert.equal(fillTemplate('a {{x}} b {{y}}', { x: '{{y}}', y: '2' }), 'a {{y}} b 2');
    assert.throws(() => fillTemplate('{{x}}', {}), /a slot no value fills: \{\{x\}\}/);
    assert.throws(() => fillTemplate('{{x}} {{x}}', { x: '1' }), /the slot \{\{x\}\} twice/);
    assert.throws(() => fillTemplate('{{x}}', { x: '1', y: '2' }), /no slot for: \{\{y\}\}/);
});

test('an answer in the schema, about the request, answering exactly its questions, is parsed in their order', () => {
    const answer = answerTo(alms, { 'effects-as-asked': 'no', 'text-as-asked': 'cannot-tell' });
    const verdict = parseJudgeAnswer(JSON.stringify(answer), alms, validate);
    assert.deepEqual(verdict, {
        state: 'answered',
        answers: alms.judged.map((q) => ({
            dimension: q.dimension,
            answer:
                q.dimension === 'effects-as-asked'
                    ? 'no'
                    : q.dimension === 'text-as-asked'
                      ? 'cannot-tell'
                      : 'yes',
            reason: 'It does.',
        })),
    });
    // One fenced code block around it is taken off; nothing else is.
    assert.equal(
        parseJudgeAnswer(`\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``, alms, validate).state,
        'answered',
    );
    assert.equal(
        parseJudgeAnswer(`  ${JSON.stringify(answer)}\n`, alms, validate).state,
        'answered',
    );
});

test('any other answer is malformed, with what is wrong, and nothing is guessed from it', () => {
    const malformed = (text: string | null): string => {
        const verdict = parseJudgeAnswer(text, alms, validate);
        if (verdict.state !== 'malformed') {
            assert.fail(`${String(text)} was parsed as answered`);
        }
        return verdict.why;
    };
    const good = answerTo(alms);
    const answers = good['answers'] as Record<string, { answer: string; reason: string }>;
    assert.equal(malformed(null), 'the session gave no answer');
    assert.equal(malformed('   '), 'the session gave no answer');
    assert.equal(malformed('Yes, all three hold.'), 'the answer is not one JSON object');
    assert.equal(
        malformed(`Here it is: ${JSON.stringify(good)}`),
        'the answer is not one JSON object',
    );
    assert.equal(
        malformed(`${JSON.stringify(good)}\n${JSON.stringify(good)}`),
        'the answer is not one JSON object',
    );
    assert.match(
        malformed(
            JSON.stringify({
                ...good,
                answers: { ...answers, 'effects-as-asked': { answer: 'mostly', reason: 'x' } },
            }),
        ),
        /^\/answers\/effects-as-asked\/answer does not match the answer's schema/,
    );
    assert.match(
        malformed(
            JSON.stringify({
                ...good,
                answers: { ...answers, 'effects-as-asked': { answer: 'yes' } },
            }),
        ),
        /does not match the answer's schema \(must have required property 'reason'\)/,
    );
    assert.match(
        malformed(JSON.stringify({ ...good, confidence: 0.9 })),
        /does not match the answer's schema/,
    );
    assert.equal(
        malformed(JSON.stringify({ ...good, request: 'decision-night-vigil' })),
        'the answer is about the request "decision-night-vigil", not decision-give-alms',
    );
    const { 'text-as-asked': _dropped, ...fewer } = answers;
    assert.ok(_dropped !== undefined);
    assert.equal(
        malformed(JSON.stringify({ ...good, answers: fewer })),
        'no answer to: text-as-asked',
    );
    assert.equal(
        malformed(
            JSON.stringify({
                ...good,
                answers: { ...answers, 'scope-as-asked': { answer: 'yes', reason: 'x' } },
            }),
        ),
        'answers to questions it was not asked: scope-as-asked',
    );
});

test("the judge's session: the prompt on standard input, no tool, no server, no skill, the session limit", () => {
    assert.deepEqual(judgeArgs({ model: 'claude-test-1', sessionLimit: 0.5 }), [
        '-p',
        '--tools',
        '',
        '--strict-mcp-config',
        '--permission-mode',
        'dontAsk',
        SESSION_LIMIT_OPTION,
        '0.5',
        '--output-format',
        'stream-json',
        '--verbose',
        '--no-session-persistence',
        '--model',
        'claude-test-1',
        '--setting-sources',
        'project,local',
        '--disable-slash-commands',
    ]);
    // Confined: nothing offered is no problem; a tool, a server or a skill is.
    const quiet = readStream(judgeStream('{}'));
    assert.deepEqual(sessionProblems(quiet, 'finished', 0, 10, JUDGE_CONFINEMENT), []);
    const loud = readStream(
        judgeStream('{}', { tools: ['Read', 'mcp__pychivalry__check'] })
            .replace(
                '"mcp_servers":[]',
                '"mcp_servers":[{"name":"pychivalry","status":"connected"}]',
            )
            .replace('"skills":[]', '"skills":["simplify"]'),
    );
    assert.deepEqual(sessionProblems(loud, 'finished', 0, 10, JUDGE_CONFINEMENT), [
        'tools outside the confinement were offered: Read, mcp__pychivalry__check',
        'skills were offered: simplify',
        'agent servers were offered: pychivalry',
    ]);
});

test("a judge's record keeps its answers and leaves out its reasons", () => {
    const summary = readStream(judgeStream(JSON.stringify(answerTo(alms))));
    const verdict = parseJudgeAnswer(summary.result?.text ?? null, alms, validate);
    const run: JudgeRun = { summary, stopped: 'finished', exitCode: 0, problems: [], verdict };
    const record = judgeRecord(run, (s) => s);
    assert.equal(record.state, 'answered');
    assert.deepEqual(
        record.answers,
        alms.judged.map((q) => ({ dimension: q.dimension, answer: 'yes' })),
    );
    assert.ok(!JSON.stringify(record).includes('It does.'));
    assert.deepEqual(
        judgeRecord({ ...run, problems: ['broke'], verdict: null }, (s) => s),
        {
            state: 'not-judged',
            why: "the judge's session had a harness problem",
            stopped: 'finished',
            harness_problems: ['broke'],
            answers: [],
            turns: 4,
            duration_ms: 2345,
            exit_code: 0,
        },
    );
    assert.equal(
        judgeRecord({ ...run, verdict: { state: 'malformed', why: 'no' } }, (s) => s).why,
        'no',
    );
    assert.deepEqual(notJudged('why').answers, []);
});
