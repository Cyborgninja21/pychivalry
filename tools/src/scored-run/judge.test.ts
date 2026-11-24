/**
 * The judge of the scored authoring test (`judge.ts`): its fixed prompt, its fixed answer
 * schema and its fixed parsing, the arguments and the confinement of its session, and what it
 * is shown of a result. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { tempDir, writeTree } from '../testing.js';
import { exampleResult, judgeStream, root } from './authoring-testing.js';
import { sessionProblems } from './confinement.js';
import {
    compileJudgeSchema,
    fillTemplate,
    JUDGE_ANSWERS,
    JUDGE_CONFINEMENT,
    JUDGE_PROMPT_FILE,
    JUDGE_SCHEMA_FILE,
    JUDGE_SLOTS,
    judgeArgs,
    judgePrompt,
    judgeRecord,
    notJudged,
    parseJudgeAnswer,
    resultFiles,
    resultText,
    type JudgeRun,
} from './judge.js';
import { baseDir, committedRequests, type ContentRequest } from './requests.js';
import { SESSION_LIMIT_OPTION } from './run.js';
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

test('the prompt has each of its four slots once, and the answer schema its closed set of answers', () => {
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
    const r = request('decision-hold-feast');
    const mod = exampleResult(t, r);
    // The harness's own folder is not part of the result.
    writeTree(mod, { '.claude/skills/x/SKILL.md': 'not shown' });
    const files = resultFiles(mod, baseDir(root, r.base));
    assert.deepEqual(
        files.map((f) => `${f.path} ${f.state}`),
        [
            'common/decisions/authoring_feast_decisions.txt written',
            'common/scripted_effects/feast_effects.txt as given',
            'common/scripted_triggers/feast_triggers.txt as given',
            'descriptor.mod as given',
            'events/feast_events.txt as given',
            'localization/english/authoring_feast_l_english.yml written',
            'localization/english/feast_l_english.yml as given',
        ],
    );
    const prompt = judgePrompt(template, r, files);
    assert.ok(prompt.includes(`<request id="${r.id}">\n${r.request}\n</request>`));
    for (const q of r.judged) {
        assert.ok(prompt.includes(`- ${q.dimension}: ${q.question}`), q.dimension);
    }
    assert.ok(
        prompt.includes(
            '--- file common/decisions/authoring_feast_decisions.txt (written while the request was worked on) ---\n# Hold a feast for the court.\nauthoring_hold_feast_decision = {',
        ),
    );
    assert.ok(prompt.includes('--- end of common/decisions/authoring_feast_decisions.txt ---'));
    assert.ok(!prompt.includes('\r'), 'line breaks as \\n');
    assert.ok(!prompt.includes('\uFEFF'), 'no byte-order mark');
    assert.ok(!prompt.includes('not shown'));
    assert.ok(!/\{\{[a-z_]+\}\}/.test(prompt), 'every slot filled');

    // A changed and a removed file are marked so.
    const changed = exampleResult(t, request('trigger-feast-guest'));
    writeFileSync(path.join(changed, 'descriptor.mod'), 'changed');
    const marks = resultFiles(changed, baseDir(root, 'feast')).map((f) => `${f.path} ${f.state}`);
    assert.ok(marks.includes('events/feast_events.txt changed'));
    assert.ok(marks.includes('descriptor.mod changed'));
    const empty = path.join(tempDir(t), 'empty');
    mkdirSync(empty);
    const gone = resultFiles(empty, baseDir(root, 'feast'));
    assert.ok(gone.every((f) => f.state === 'removed' && f.text === null));
    assert.ok(
        resultText(gone).includes(
            '--- file events/feast_events.txt (removed while the request was worked on) ---',
        ),
    );
    assert.equal(resultText([]), '(the mod holds no file)');
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
