/**
 * A stand-in for Claude Code in the scored runs' tests: it starts no model and reaches no
 * network. `--version` answers as Claude Code 2.1.330 does. Otherwise, as a trial or a judge's
 * session runs it, it does what its environment says, in this order. A session started with an
 * agent-server configuration (`--mcp-config`) is a trial; one without is a judge's session.
 *
 * - `FAKE_CLAUDE_ARGV`: appends one JSON line to that file: its arguments, its folder, the
 *   names of the variables it was given that may hold a key, a token or another credential
 *   (none, when the run is right), which of the other variables a trial sets or removes it was
 *   given, whether its folder holds git history, the agent-server configuration it was given,
 *   what it read on its standard input (a judge's prompt), and the skills it would find: in
 *   `.claude/skills/` of its folder, and in `skills/` of the configuration folder
 *   `CLAUDE_CONFIG_DIR` names, if any;
 * - `FAKE_CLAUDE_APPLY` (a trial only): copies that folder's files over its own folder, as an
 *   agent's edits;
 * - `FAKE_CLAUDE_STREAM` (a trial) or `FAKE_CLAUDE_JUDGE_STREAM` (a judge's session): writes
 *   that file to its output, as a recorded session's stream; in a judge's stream, `{{request}}`
 *   is replaced by the id of the request its prompt names;
 * - `FAKE_CLAUDE_STREAMS` (a trial): a JSON file naming, for some trials, the stream to write
 *   instead of `FAKE_CLAUDE_STREAM`, keyed by the trial's folder (`<request>-<n>`, the parent of
 *   the folder the session starts in), so that one trial of a run can do what the others do not;
 * - `FAKE_CLAUDE_SLEEP_MS`: waits that long;
 * - `FAKE_CLAUDE_EXIT`: exits with that code (0 by default).
 */

import { appendFileSync, cpSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args[0] === '--version') {
    process.stdout.write('2.1.330 (Claude Code)\n');
    process.exit(0);
}
const env = process.env;
const argvFile = env['FAKE_CLAUDE_ARGV'];
const configAt = args.indexOf('--mcp-config');
const config = configAt < 0 ? undefined : args[configAt + 1];
const judge = config === undefined;
// A judge's prompt comes on standard input; a trial's standard input is closed.
let stdin = '';
if (judge) {
    try {
        stdin = readFileSync(0, 'utf8');
    } catch {
        stdin = '';
    }
}
/** The folders of `dir` that hold a `SKILL.md`, as Claude Code would find skills there. */
function skillsAt(dir: string): string[] {
    return existsSync(dir)
        ? readdirSync(dir)
              .filter((name) => existsSync(path.join(dir, name, 'SKILL.md')))
              .sort()
        : [];
}
const configDir = env['CLAUDE_CONFIG_DIR'];
if (argvFile !== undefined) {
    appendFileSync(
        argvFile,
        `${JSON.stringify({
            argv: args,
            cwd: process.cwd(),
            credential_variables: Object.keys(env).filter((k) =>
                /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH/i.test(k),
            ),
            claude_ai_servers: env['ENABLE_CLAUDEAI_MCP_SERVERS'] ?? null,
            auto_memory_off: env['CLAUDE_CODE_DISABLE_AUTO_MEMORY'] ?? null,
            mcp_nonblocking: env['MCP_CONNECTION_NONBLOCKING'] ?? null,
            session_variables: Object.keys(env).filter(
                (k) =>
                    k === 'CLAUDECODE' ||
                    k === 'CLAUDE_EFFORT' ||
                    k === 'AI_AGENT' ||
                    (k.startsWith('MCP_') && k !== 'MCP_CONNECTION_NONBLOCKING') ||
                    (k.startsWith('CLAUDE_CODE_') && k !== 'CLAUDE_CODE_DISABLE_AUTO_MEMORY'),
            ),
            git: existsSync('.git'),
            mcp_config:
                config === undefined ? null : (JSON.parse(readFileSync(config, 'utf8')) as unknown),
            stdin,
            claude_config_dir: configDir ?? null,
            skills: {
                project: skillsAt(path.join('.claude', 'skills')),
                config: configDir === undefined ? [] : skillsAt(path.join(configDir, 'skills')),
            },
        })}\n`,
    );
}
const apply = env['FAKE_CLAUDE_APPLY'];
if (apply !== undefined && !judge) {
    cpSync(apply, process.cwd(), { recursive: true });
}
const streams = env['FAKE_CLAUDE_STREAMS'];
const ownStream =
    judge || streams === undefined
        ? undefined
        : (JSON.parse(readFileSync(streams, 'utf8')) as Record<string, string>)[
              path.basename(path.dirname(process.cwd()))
          ];
const stream = judge ? env['FAKE_CLAUDE_JUDGE_STREAM'] : (ownStream ?? env['FAKE_CLAUDE_STREAM']);
if (stream !== undefined) {
    const request = /<request id="([^"]*)">/.exec(stdin)?.[1] ?? '';
    process.stdout.write(readFileSync(stream, 'utf8').replaceAll('{{request}}', request));
}
const sleep = Number(env['FAKE_CLAUDE_SLEEP_MS'] ?? '0');
if (sleep > 0) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, sleep);
}
process.exitCode = Number(env['FAKE_CLAUDE_EXIT'] ?? '0');
