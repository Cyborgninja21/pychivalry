/**
 * A stand-in for Claude Code in the scored run's tests: it starts no model and reaches no
 * network. `--version` answers as Claude Code 2.1.220 does. Otherwise, as a trial runs it, it
 * does what its environment says, in this order:
 *
 * - `FAKE_CLAUDE_ARGV`: appends one JSON line to that file: its arguments, its folder, the
 *   names of the variables it was given that may hold a key, a token or another credential
 *   (none, when the run is right), which of the other variables a trial sets or removes it was
 *   given, whether its folder holds git history, and the agent-server configuration it was
 *   given;
 * - `FAKE_CLAUDE_APPLY`: copies that folder's files over its own folder, as an agent's edits;
 * - `FAKE_CLAUDE_STREAM`: writes that file to its output, as a recorded session's stream;
 * - `FAKE_CLAUDE_SLEEP_MS`: waits that long;
 * - `FAKE_CLAUDE_EXIT`: exits with that code (0 by default).
 */

import { appendFileSync, cpSync, existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (args[0] === '--version') {
    process.stdout.write('2.1.220 (Claude Code)\n');
    process.exit(0);
}
const env = process.env;
const argvFile = env['FAKE_CLAUDE_ARGV'];
const configAt = args.indexOf('--mcp-config');
const config = configAt < 0 ? undefined : args[configAt + 1];
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
            session_variables: Object.keys(env).filter(
                (k) =>
                    k === 'CLAUDECODE' ||
                    k === 'CLAUDE_EFFORT' ||
                    (k.startsWith('CLAUDE_CODE_') && k !== 'CLAUDE_CODE_DISABLE_AUTO_MEMORY'),
            ),
            git: existsSync('.git'),
            mcp_config:
                config === undefined ? null : (JSON.parse(readFileSync(config, 'utf8')) as unknown),
        })}\n`,
    );
}
const apply = env['FAKE_CLAUDE_APPLY'];
if (apply !== undefined) {
    cpSync(apply, process.cwd(), { recursive: true });
}
const stream = env['FAKE_CLAUDE_STREAM'];
if (stream !== undefined) {
    process.stdout.write(readFileSync(stream, 'utf8'));
}
const sleep = Number(env['FAKE_CLAUDE_SLEEP_MS'] ?? '0');
if (sleep > 0) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, sleep);
}
process.exitCode = Number(env['FAKE_CLAUDE_EXIT'] ?? '0');
