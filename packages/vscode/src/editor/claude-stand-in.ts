/**
 * A stand-in for Claude Code's `claude` command, for the editor tests where no Claude Code is
 * given (public CI): it starts no model, reaches no network, and does only what the set-up
 * runs, `claude mcp remove` and `claude mcp add`, writing the entry where and as Claude Code
 * 2.1.220 does: `$CLAUDE_CONFIG_DIR/.claude.json`, under `projects.<folder>.mcpServers.<name>`,
 * `{type, command, args, env}`. It reads its arguments as Claude Code's own parser does:
 * options first, `--env` taking every value up to the next option, everything after `--` the
 * server's command line. Run on Windows through a `claude.cmd` that hands it `%*`, as an npm
 * install's does, so that the set-up's quoting for `cmd.exe` is exercised for real. Test code.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface Config {
    projects?: Record<string, { mcpServers?: Record<string, unknown> }>;
}

function fail(message: string): never {
    process.stderr.write(`${message}\n`);
    process.exit(1);
}

const args = process.argv.slice(2);
const dir = process.env['CLAUDE_CONFIG_DIR'];
if (dir === undefined || dir === '') {
    fail('the stand-in needs CLAUDE_CONFIG_DIR');
}
mkdirSync(dir, { recursive: true });
appendFileSync(
    path.join(dir, 'stand-in-calls.jsonl'),
    `${JSON.stringify({ argv: args, cwd: process.cwd() })}\n`,
);
const file = path.join(dir, '.claude.json');
const config = (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}) as Config;
const project = process.cwd();
const servers = (((config.projects ??= {})[project] ??= {}).mcpServers ??= {});

const [group, verb, ...rest] = args;
if (group !== 'mcp' || (verb !== 'add' && verb !== 'remove')) {
    fail(`the stand-in does only "mcp add" and "mcp remove", not: ${args.join(' ')}`);
}
let scope = 'local';
let transport = 'stdio';
const env: Record<string, string> = {};
const positional: string[] = [];
let i = 0;
for (; i < rest.length; i++) {
    const arg = rest[i] ?? '';
    if (arg === '--') {
        i++;
        break;
    }
    if (arg === '--scope' || arg === '-s') {
        scope = rest[++i] ?? fail(`${arg} needs a value`);
    } else if (arg === '--transport' || arg === '-t') {
        transport = rest[++i] ?? fail(`${arg} needs a value`);
    } else if (arg === '--env' || arg === '-e') {
        while (i + 1 < rest.length && !(rest[i + 1] ?? '').startsWith('-')) {
            const pair = rest[++i] ?? '';
            const eq = pair.indexOf('=');
            if (eq <= 0) {
                fail(`Invalid environment variable format: ${pair}`);
            }
            env[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
    } else if (arg.startsWith('-')) {
        fail(`error: unknown option '${arg}'`);
    } else {
        positional.push(arg);
    }
}
if (scope !== 'local' || transport !== 'stdio') {
    fail(`the stand-in writes local stdio entries only, not ${scope} ${transport}`);
}
const [name] = positional;
if (name === undefined) {
    fail("error: missing required argument 'name'");
}
if (verb === 'remove') {
    if (!(name in servers)) {
        fail(`No MCP server found with name: "${name}" in local config`);
    }
    Reflect.deleteProperty(servers, name);
} else {
    const [command, ...serverArgs] = [...positional.slice(1), ...rest.slice(i)];
    if (command === undefined) {
        fail("error: missing required argument 'commandOrUrl'");
    }
    if (name in servers) {
        fail(`MCP server ${name} already exists in local config`);
    }
    servers[name] = { type: 'stdio', command, args: serverArgs, env };
    process.stdout.write(
        `Added stdio MCP server ${name} with command: ${command} to local config\n`,
    );
}
writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
