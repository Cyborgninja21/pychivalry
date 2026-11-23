/**
 * The same-answers test's comparison (docs/PLAN.md, item 7.9; docs/MVP.md, definition of done
 * 4), with no VS Code import: a finding as each surface states it, brought to one form, and the
 * differences between two lists. Test code only.
 *
 * - The editor (the language server's `pychivalry/findings`) and the command line (`check
 *   --json`) give the core's own finding: a range counted from 0, the severity, the code, the
 *   message, the evidence and the data.
 * - The agent server's `check` gives lines and columns counted from 1, the severity, the code,
 *   the message and the data; no evidence (its tools leave it to `explain_code`).
 * - VS Code's diagnostics give the range, the severity, the code and the message.
 *
 * Every list is compared on the file, the range, the severity, the code, the message and the
 * data; the editor's and the command line's on the evidence too.
 */

/** The severities, most severe first. */
export const SEVERITIES = ['error', 'warning', 'information', 'hint'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** One finding in the form every surface can state. */
export interface Answer {
    readonly file: string;
    readonly line: number;
    readonly character: number;
    readonly endLine: number;
    readonly endCharacter: number;
    readonly severity: string;
    readonly code: string;
    readonly message: string;
    /** The data as JSON with its keys sorted, or null where the surface does not give it. */
    readonly data: string | null;
    /** The evidence as JSON with its keys sorted, or null where the surface does not give it. */
    readonly evidence: string | null;
}

/** JSON with every object's keys sorted, so two equal values give the same text. */
export function canonical(value: unknown): string {
    return JSON.stringify(value, (_key, v: unknown) =>
        typeof v === 'object' && v !== null && !Array.isArray(v)
            ? Object.fromEntries(
                  Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
                      a < b ? -1 : a > b ? 1 : 0,
                  ),
              )
            : v,
    );
}

function record(value: unknown, what: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${what} is not an object: ${JSON.stringify(value)}`);
    }
    return value as Record<string, unknown>;
}

function num(value: unknown, what: string): number {
    if (typeof value !== 'number') {
        throw new Error(`${what} is not a number: ${JSON.stringify(value)}`);
    }
    return value;
}

function str(value: unknown, what: string): string {
    if (typeof value !== 'string') {
        throw new Error(`${what} is not a string: ${JSON.stringify(value)}`);
    }
    return value;
}

/** A finding in the core's shape: the editor's and the command line's. */
export function fromCore(value: unknown): Answer {
    const f = record(value, 'a finding');
    const range = record(f['range'], 'its range');
    const start = record(range['start'], 'its start');
    const end = record(range['end'], 'its end');
    return {
        file: str(f['file'], 'its file'),
        line: num(start['line'], 'its line'),
        character: num(start['character'], 'its character'),
        endLine: num(end['line'], 'its end line'),
        endCharacter: num(end['character'], 'its end character'),
        severity: str(f['severity'], 'its severity'),
        code: str(f['code'], 'its code'),
        message: str(f['message'], 'its message'),
        data: canonical(f['data'] ?? null),
        evidence: canonical(f['evidence'] ?? null),
    };
}

/** A finding as the agent server's `check` gives it: lines and columns from 1, no evidence. */
export function fromAgent(value: unknown): Answer {
    const f = record(value, 'a finding');
    return {
        file: str(f['file'], 'its file'),
        line: num(f['line'], 'its line') - 1,
        character: num(f['column'], 'its column') - 1,
        endLine: num(f['end_line'], 'its end line') - 1,
        endCharacter: num(f['end_column'], 'its end column') - 1,
        severity: str(f['severity'], 'its severity'),
        code: str(f['code'], 'its code'),
        message: str(f['message'], 'its message'),
        data: canonical(f['data'] ?? null),
        evidence: null,
    };
}

/** The command line's `check --json` output: its findings and its summary. */
export function parseCliJson(stdout: string): {
    readonly findings: readonly Answer[];
    readonly summary: Record<string, unknown>;
} {
    const lines = stdout
        .split(/\r?\n/)
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    const last = lines.pop();
    if (last === undefined || !('summary' in last)) {
        throw new Error(
            `the command line's JSON output has no summary last:\n${stdout.slice(-2000)}`,
        );
    }
    return {
        findings: lines.map(fromCore),
        summary: record(last['summary'], 'the summary'),
    };
}

/** The answers in one order: by file, then place, then code and message. */
export function sorted(answers: readonly Answer[]): Answer[] {
    const key = (a: Answer): string => canonical(a);
    return [...answers].sort((a, b) => {
        const by =
            (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
            a.line - b.line ||
            a.character - b.character ||
            a.endLine - b.endLine ||
            a.endCharacter - b.endCharacter;
        if (by !== 0) {
            return by;
        }
        const [x, y] = [key(a), key(b)];
        return x < y ? -1 : x > y ? 1 : 0;
    });
}

/** `answers` with the fields `keep` does not name set to null: what two surfaces share. */
export function only(
    answers: readonly Answer[],
    keep: { readonly data: boolean; readonly evidence: boolean },
): Answer[] {
    return answers.map((a) => ({
        ...a,
        data: keep.data ? a.data : null,
        evidence: keep.evidence ? a.evidence : null,
    }));
}

function line(a: Answer): string {
    return `${a.file}:${String(a.line + 1)}:${String(a.character + 1)}-${String(a.endLine + 1)}:${String(a.endCharacter + 1)} ${a.severity} ${a.code} ${JSON.stringify(a.message)}${a.data === null ? '' : ` data ${a.data}`}${a.evidence === null ? '' : ` evidence ${a.evidence}`}`;
}

/**
 * The findings one list has and the other does not, each as a line, at most `limit` of each;
 * empty when the two lists are the same findings, each as many times.
 */
export function differences(
    left: readonly Answer[],
    right: readonly Answer[],
    names: readonly [string, string],
    limit = 10,
): string[] {
    const count = (list: readonly Answer[]): Map<string, number> => {
        const out = new Map<string, number>();
        for (const a of list) {
            const k = line(a);
            out.set(k, (out.get(k) ?? 0) + 1);
        }
        return out;
    };
    const [l, r] = [count(left), count(right)];
    const out: string[] = [];
    for (const [a, b, name, other] of [
        [l, r, names[0], names[1]],
        [r, l, names[1], names[0]],
    ] as const) {
        const extra = [...a].filter(([k, n]) => n > (b.get(k) ?? 0)).map(([k]) => k);
        out.push(
            ...extra.slice(0, limit).map((k) => `only ${name}, not ${other}: ${k}`),
            ...(extra.length > limit
                ? [`... and ${String(extra.length - limit)} more only ${name}`]
                : []),
        );
    }
    return out;
}

/** The counts by severity, every severity named. */
export function bySeverity(answers: readonly Answer[]): Record<Severity, number> {
    const out: Record<Severity, number> = { error: 0, warning: 0, information: 0, hint: 0 };
    for (const a of answers) {
        if ((SEVERITIES as readonly string[]).includes(a.severity)) {
            out[a.severity as Severity]++;
        }
    }
    return out;
}
