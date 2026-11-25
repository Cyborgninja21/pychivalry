/**
 * Which record a continued authoring run may add its trials to (`SCORED_CONTINUE=true`;
 * tools/scored-run/README.md, "Continuing a run"). One record never mixes trials made two ways:
 * the record must state the spec, the game, and everything its results say a trial was made
 * with (the request list, the prompts, the judge's schema, the base mods and the skills, each by
 * its hash; the Claude Code version, the models, the limits, the arguments and the agent server)
 * exactly as this run would, as before.
 *
 * Its commit may be this checkout's, as before, or an earlier one, when nothing a trial is made
 * or graded with changed between them: git must show the record's commit to be an ancestor of
 * this checkout's, neither with an uncommitted change, and every file changed between the two
 * must be one that `mayChangeBetween` allows: documents, records, the CI workflows, tests, and
 * the run's own loop, record and reading of the targets. Anything else (the agent server and the
 * checker in `packages/`, the spec, the skills, the requests and their bases, the harness's other
 * files, the dependencies, the task file's own commands) refuses the continuation, naming the
 * files. It exists so that a fix of how the run goes on (when it stops, how it reads its
 * targets) does not make the trials before it worthless; a fix of what a session is given, or of
 * how a result is graded, starts a new record.
 *
 * `authoring.ts` is allowed although it holds a trial's steps beside the run's loop, because at
 * the commit of the record this rule was made for (`4860cf0`, the expert requests' development
 * run) the two are one file: moving them apart would itself be a change this rule must refuse.
 * The record's note names every file of code that changed, so that it is never silent.
 */

import { isDeepStrictEqual } from 'node:util';
import { git, type ToolInfo } from '../record.js';
import { CommandError, EXIT, isObject } from '../util.js';

/** Folders whose files may change between a record's commit and the run continuing it. */
const FOLDERS: readonly string[] = ['docs/', 'records/', '.github/'];

/** Endings of files that may change: documents and tests, which no trial runs or reads. */
const ENDINGS: readonly string[] = ['.md', '.test.ts'];

/**
 * The files of code that may change: the run's loop and the stop rule, the record's measures
 * (computed again over every trial each time the record is written), the reading of the
 * targets, this rule, the stand-in and the tests' helpers, the command line that starts them,
 * and the task file (its descriptions; its commands are the same).
 */
export const RUN_FILES: readonly string[] = [
    'Taskfile.yml',
    'tools/src/cli.ts',
    'tools/src/scored-run/authoring.ts',
    'tools/src/scored-run/authoring-record.ts',
    'tools/src/scored-run/authoring-targets.ts',
    'tools/src/scored-run/authoring-testing.ts',
    'tools/src/scored-run/continuation.ts',
    'tools/src/scored-run/fake-claude.ts',
    'tools/src/scored-run/stop-rule.ts',
];

/**
 * Whether a file of the repository (from its root, with `/`) may change between a record's
 * commit and a run continuing it. The prompts and the skills end in `.md` too: they are compared
 * by their hashes, which the record states.
 */
export function mayChangeBetween(file: string): boolean {
    return (
        FOLDERS.some((f) => file.startsWith(f)) ||
        ENDINGS.some((e) => file.endsWith(e)) ||
        RUN_FILES.includes(file)
    );
}

/** What the rule asks of git. */
export interface GitView {
    /** Whether commit `older` is `newer` or an ancestor of it (false when either is unknown). */
    isAncestor(older: string, newer: string): boolean;
    /** The files that differ between two commits, from the repository root, with `/`. */
    changed(older: string, newer: string): string[];
}

/** The repository's own git. */
export function repositoryGit(root: string): GitView {
    return {
        isAncestor(older: string, newer: string): boolean {
            try {
                git(root, ['merge-base', '--is-ancestor', older, newer]);
                return true;
            } catch {
                return false;
            }
        },
        changed(older: string, newer: string): string[] {
            const out = git(root, [
                '-c',
                'core.quotePath=false',
                'diff',
                '--name-only',
                '--no-renames',
                older,
                newer,
            ]);
            return out === '' ? [] : out.split('\n').map((l) => l.trim());
        },
    };
}

/** How a record's commit and this checkout's relate, when the record may be continued. */
export interface Across {
    /** The record's commit, when it is not this checkout's; null when it is. */
    readonly from: string | null;
    /** The files that changed between the two, none of which a trial is made or graded with. */
    readonly changed: readonly string[];
}

/**
 * Whether a record made by `recorded` (its `tool`) may be continued by this checkout's build,
 * `current`: the same build, or an earlier commit with only `mayChangeBetween` files changed
 * since. Otherwise a usage error naming why, before any test session.
 */
export function continuedAcross(recorded: unknown, current: ToolInfo, view: GitView): Across {
    if (isDeepStrictEqual(recorded, JSON.parse(JSON.stringify(current)))) {
        return { from: null, changed: [] };
    }
    const tool = isObject(recorded) ? recorded : {};
    const commit = tool['commit'];
    if (
        tool['name'] !== current.name ||
        tool['version'] !== current.version ||
        typeof commit !== 'string'
    ) {
        throw new CommandError(
            `SCORED_CONTINUE=true: the record already written was made by another build of pychivalry (tool); its trials and this run's cannot share one record`,
            EXIT.usage,
        );
    }
    if (tool['dirty'] !== false || current.dirty) {
        throw new CommandError(
            `SCORED_CONTINUE=true: the record was made at commit ${commit} and this checkout is at ${current.commit}; a record is continued at another commit only when neither had an uncommitted change, and ${current.dirty ? 'this checkout has one' : 'the record says its checkout had one'}`,
            EXIT.usage,
        );
    }
    if (!view.isAncestor(commit, current.commit)) {
        throw new CommandError(
            `SCORED_CONTINUE=true: the record was made at commit ${commit}, which is not an ancestor of this checkout's ${current.commit} (or is not in this clone); its trials and this run's cannot share one record`,
            EXIT.usage,
        );
    }
    const changed = view.changed(commit, current.commit);
    const refused = changed.filter((f) => !mayChangeBetween(f));
    if (refused.length > 0) {
        throw new CommandError(
            `SCORED_CONTINUE=true: the record was made at commit ${commit}, and since then files changed that a trial is made or graded with: ${refused.join(', ')}. Its trials and this run's cannot share one record; start a new one (tools/scored-run/README.md, "Continuing a run")`,
            EXIT.usage,
        );
    }
    return { from: commit, changed };
}

/** The files of code among `changed`: what a continued record's note names. */
export function codeChanged(changed: readonly string[]): string[] {
    return changed.filter(
        (f) => !FOLDERS.some((d) => f.startsWith(d)) && !ENDINGS.some((e) => f.endsWith(e)),
    );
}
