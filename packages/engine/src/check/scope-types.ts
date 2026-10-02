/**
 * Scope-type inference: which scope type `this`, `root` and `prev` are at every block of a
 * file, and which type each step of a scope chain produces. Every type comes from the spec
 * package (format 3), which carries the game's own `script_docs` documentation:
 *
 *   root         the directory schema's `root_scope` (or the directory's `default_scope`);
 *                for events the event's own `scope = <type>` field when it has one; for
 *                on_actions the expected scope the game documents for that on_action.
 *                Scripted triggers and effects, script values and every other directory:
 *                unknown (they run in whatever scope calls them).
 *   this         root at the record; then, inside trigger and effect blocks:
 *                  an iterator (any_/every_/random_/ordered_ + list)  the list's element type
 *                  a link (`liege = { }`) or a chain (`root.primary_title = { }`)
 *                                                         the link's output type
 *                  `root`, `prev`, `this` blocks         that frame's type
 *                  control flow (limit, AND, if, random_list cases, ...)  unchanged
 *                  anything else (a keyword's parameter block, a scripted effect's
 *                  arguments, nested record fields)          unknown
 *   prev         the scope before the last scope change (unknown after an unknown change)
 *   scope:x      the type at its save site (`save_scope_as = x`), when the workspace index and
 *                the base game together hold exactly one save of `x` and it is in the same
 *                record of this file; otherwise unknown
 *
 * A link step whose input scopes (the game's Input Scopes) do not include the current type
 * is a mismatch; its output is then unknown, so one mistake is reported once. Unknown always
 * stays unknown: nothing here guesses.
 */

import { Spec } from '../spec/spec';
import { ASTNode, NodeType, ScopeChain } from '../syntax/ast';
import { SymbolType } from '../index/symbols';
import { BlockContext, blockContexts } from './registry';
import { CONTAINERS } from './contexts';
import { STRUCTURAL } from './structural';
import { CheckInput } from './types';

/** The scope types of one block body; undefined = unknown. */
export interface ScopeFrame {
    this?: string;
    root?: string;
    prev?: string;
}

/** One link step that cannot be taken from the current scope type. */
export interface LinkMismatch {
    link: string;
    /** The current scope type. */
    on: string;
    /** The link's input scopes. */
    expected: string[];
}

/** One segment of a chain and the scope type it leaves (undefined = unknown or a value). */
export interface ChainStep {
    segment: string;
    type?: string;
    mismatch?: LinkMismatch;
}

export interface ChainResolution {
    steps: ChainStep[];
    /** The type of the whole chain. */
    result?: string;
}

/** What the resolver found for one file. */
export interface ScopeResolution {
    /** The frame of each block body (children array), for every block the walk reached. */
    frames: Map<ASTNode[], ScopeFrame>;
    /** The frame each node is evaluated in (the frame of the block holding it). */
    nodeFrames: Map<ASTNode, ScopeFrame>;
    /** Key chains (`root.liege = { }`, `scope:x = { }`) and single-link block keys. */
    keyChains: Map<ASTNode, ChainResolution>;
    /** Value chains (`target = root.primary_title.holder`). */
    valueChains: Map<ASTNode, ChainResolution>;
    /** Iterator nodes and their element type (undefined when the list's type is unknown). */
    iterators: Map<ASTNode, string | undefined>;
    /** The registry's reading of every block (trigger/effect/modifier/value/none). */
    contexts: Map<ASTNode[], BlockContext>;
    /** Saved scopes resolved to one type (`scope:x` → type), per record node. */
    saved: Map<ASTNode, Map<string, string>>;
    /** The node whose block body each children array is (absent for the file root). */
    owners: Map<ASTNode[], ASTNode>;
}

const UNKNOWN: ScopeFrame = {};

/**
 * Directories whose package root scope (`root_scope` / `default_scope`, a seed from the wiki
 * era, not engine-derived) vanilla 1.20.0.2 contradicts: their records hold fields the game
 * evaluates in other scopes. Their root is unknown. Calibrated on vanilla like the tables in
 * structural.ts; each entry is the evidence.
 */
export const ROOT_SCOPE_CONTRADICTED: ReadonlyMap<string, string> = new Map([
    [
        'common/story_cycles',
        'the seed says character, but vanilla applies `story_owner` (input: story) at the record root 160 times and story effects (supported: story) 56 times: the root is the story',
    ],
    [
        'common/factions',
        'the seed says faction, but fields such as can_character_join / can_character_create_ui run character triggers and links (liege, holder, faith …) 42 + 76 times',
    ],
    [
        'common/casus_belli_types',
        'the seed says character, but on_victory/on_defeat … run casus_belli effects and the `war` link (input: casus_belli) 49 times',
    ],
    [
        'common/buildings',
        'the seed says province, but the cost blocks (rebuild_cost, cost) are evaluated on the builder: vanilla compares the character trigger `gold` there 10 times',
    ],
]);

/**
 * Record fields evaluated in another scope than the record's root (vanilla 1.20.0.2):
 * interaction pickers run on the candidate title / artifact / character.
 */
export const FIELDS_OUTSIDE_ROOT: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    [
        'common/character_interactions',
        new Set(['can_be_picked', 'can_be_picked_title', 'can_be_picked_artifact']),
    ],
]);

/** Logical operators and filters: their bodies keep the scope. */
const SAME_SCOPE_STRUCTURAL: ReadonlySet<string> = new Set(
    Array.from(STRUCTURAL.keys()).filter((k) => k !== 'root')
);

const SAVE_KEYS: ReadonlySet<string> = new Set(['save_scope_as', 'save_temporary_scope_as']);

function lower(s: string): string {
    return s.toLowerCase();
}

/** The link forms that apply to a segment: data forms for `name:data`, others otherwise. */
function formsFor(spec: Spec, name: string, withData: boolean) {
    const forms = spec.linkForms(name) ?? spec.linkForms(lower(name));
    return forms ? forms.filter((f) => f.requires_data === withData) : [];
}

function single(types: Iterable<string>): string | undefined {
    const set = new Set(types);
    return set.size === 1 ? set.values().next().value : undefined;
}

/**
 * Take one link step from `current`: the output type and, when the link's input scopes are
 * documented and the current type is known and not among them, the mismatch.
 */
export function linkStep(
    spec: Spec,
    name: string,
    current: string | undefined,
    withData = false
): { type?: string; mismatch?: LinkMismatch; known: boolean } {
    const forms = formsFor(spec, name, withData);
    if (forms.length === 0) {
        return { known: false };
    }
    const scoped = forms.filter((f) => !f.global_link && f.supported_scopes.length > 0);
    const inputs = Array.from(new Set(scoped.flatMap((f) => f.supported_scopes)));
    const outputs = forms.flatMap((f) => f.supported_targets);
    if (scoped.length === forms.length && current !== undefined && inputs.length > 0) {
        if (!inputs.includes(current)) {
            return { mismatch: { link: name, on: current, expected: inputs }, known: true };
        }
    }
    if (current === undefined && scoped.length > 0) {
        return { known: true }; // unknown stays unknown: no output from an unknown input
    }
    const out = single(outputs);
    return { type: out !== undefined && spec.isScopeType(out) ? out : undefined, known: true };
}

class Resolver {
    private readonly spec: Spec;
    private readonly result: ScopeResolution;
    private record: ASTNode | undefined;
    private outsideRoot: ReadonlySet<string> | undefined;
    /** Save sites seen in this walk: record → name → types at the sites. */
    public readonly saveSites = new Map<ASTNode, Map<string, Array<string | undefined>>>();

    constructor(
        private readonly input: CheckInput,
        contexts: Map<ASTNode[], BlockContext>,
        saved: Map<ASTNode, Map<string, string>>
    ) {
        this.spec = input.spec;
        this.result = {
            frames: new Map(),
            nodeFrames: new Map(),
            keyChains: new Map(),
            valueChains: new Map(),
            iterators: new Map(),
            contexts,
            saved,
            owners: new Map(),
        };
    }

    public run(): ScopeResolution {
        const { ast } = this.input;
        const directory = this.spec.directoryOf(this.input.file);
        const schema = directory ? this.spec.schemaOf(directory) : undefined;
        for (const record of ast.children ?? []) {
            if (record.type === NodeType.COMMENT) {
                continue;
            }
            this.record = record;
            this.outsideRoot = directory ? FIELDS_OUTSIDE_ROOT.get(directory.path) : undefined;
            const root = this.rootOf(
                record,
                directory?.path,
                directory && ROOT_SCOPE_CONTRADICTED.has(directory.path)
                    ? undefined
                    : (schema?.root_scope ?? directory?.default_scope)
            );
            const frame: ScopeFrame = root === undefined ? UNKNOWN : { this: root, root };
            this.result.nodeFrames.set(record, UNKNOWN);
            if (record.children) {
                this.walk(record.children, frame, true);
            }
        }
        return this.result;
    }

    /** The root scope type of one top-level record (undefined = unknown). */
    private rootOf(
        record: ASTNode,
        directory: string | undefined,
        dirScope: string | undefined
    ): string | undefined {
        const known = (t: string | undefined): string | undefined =>
            t !== undefined && this.spec.isScopeType(t) ? t : undefined;
        if (!record.children || record.keyPrefix !== undefined) {
            return undefined; // scripted triggers / effects: whatever calls them
        }
        if (directory === 'events') {
            const scope = record.children.find((c) => c.key === 'scope');
            if (scope) {
                return typeof scope.value === 'string' ? known(scope.value) : undefined;
            }
            return known(dirScope);
        }
        if (directory === 'common/on_action') {
            const doc = record.key ? this.spec.scopeValidity(record.key, 'on_actions') : undefined;
            return doc ? known(single(doc.supported_scopes)) : undefined;
        }
        return known(dirScope);
    }

    private walk(nodes: ASTNode[], frame: ScopeFrame, recordBody: boolean): void {
        this.result.frames.set(nodes, frame);
        const ctx = this.result.contexts.get(nodes);
        const inContext = ctx !== undefined && (ctx.kind === 'trigger' || ctx.kind === 'effect');
        for (const node of nodes) {
            if (node.type === NodeType.COMMENT) {
                continue;
            }
            this.result.nodeFrames.set(node, frame);
            if (node.keyChain) {
                this.result.keyChains.set(node, this.resolveChain(node.keyChain, frame));
            }
            if (node.valueChain) {
                this.result.valueChains.set(node, this.resolveChain(node.valueChain, frame));
            }
            if (node.key && SAVE_KEYS.has(node.key) && typeof node.value === 'string') {
                this.noteSave(node.value, frame.this);
            }
            if (!node.children) {
                continue;
            }
            this.result.owners.set(node.children, node);
            const outside = recordBody && node.key !== undefined && this.outsideRoot?.has(node.key);
            const child = outside
                ? {}
                : inContext
                  ? this.childInContext(node, frame)
                  : recordBody || !node.key
                    ? frame
                    : { root: frame.root };
            this.walk(node.children, child, false);
        }
    }

    private noteSave(name: string, type: string | undefined): void {
        if (!this.record) {
            return;
        }
        let byName = this.saveSites.get(this.record);
        if (!byName) {
            byName = new Map();
            this.saveSites.set(this.record, byName);
        }
        const list = byName.get(name) ?? [];
        list.push(type);
        byName.set(name, list);
    }

    /** The frame of the body of `node`, a block inside a trigger or effect block. */
    private childInContext(node: ASTNode, frame: ScopeFrame): ScopeFrame {
        const unknown: ScopeFrame = { root: frame.root };
        const key = node.key;
        if (!key) {
            return frame;
        }
        if (
            key.includes('$') ||
            (node.keyKind !== undefined &&
                node.keyKind !== 'identifier' &&
                node.keyKind !== 'chain')
        ) {
            return unknown;
        }
        if (node.keyChain) {
            const res = this.result.keyChains.get(node);
            return { this: res?.result, root: frame.root, prev: frame.this };
        }
        const name = lower(key);
        if (name === 'root') {
            return { this: frame.root, root: frame.root, prev: frame.this };
        }
        if (name === 'this') {
            return frame;
        }
        if (name === 'prev') {
            return { this: frame.prev, root: frame.root, prev: frame.this };
        }
        if (SAME_SCOPE_STRUCTURAL.has(key) || SAME_SCOPE_STRUCTURAL.has(key.toUpperCase())) {
            return frame;
        }
        const container = CONTAINERS.get(key);
        if (container) {
            return frame; // control flow; its parameter blocks are handled one level down
        }
        const iterator = this.spec.isIterator(key) ?? this.spec.isIterator(name);
        if (iterator) {
            const element =
                frame.this === undefined ? undefined : this.spec.listElementType(iterator.base);
            this.result.iterators.set(node, element);
            return { this: element, root: frame.root, prev: frame.this };
        }
        if (this.spec.has(key, 'links') || this.spec.has(name, 'links')) {
            const step = linkStep(this.spec, key, frame.this);
            this.result.keyChains.set(node, {
                steps: [{ segment: key, type: step.type, mismatch: step.mismatch }],
                result: step.type,
            });
            return { this: step.type, root: frame.root, prev: frame.this };
        }
        return unknown;
    }

    /** Resolve a chain from `frame`; a step that is not a scope link ends the typed part. */
    public resolveChain(chain: ScopeChain, frame: ScopeFrame): ChainResolution {
        const steps: ChainStep[] = [];
        const text = chain.segments.join('.');
        if (text.includes('$')) {
            return { steps: chain.segments.map((segment) => ({ segment })) };
        }
        let current: string | undefined;
        let typed = true;
        const head = chain.segments[0];
        const headLower = lower(head);
        if (chain.kind === 'scope') {
            current = chain.name !== undefined ? this.savedType(chain.name) : undefined;
            steps.push({ segment: head, type: current });
        } else if (chain.kind === 'link' && chain.prefix !== undefined) {
            const step = linkStep(this.spec, chain.prefix, frame.this, true);
            current = step.type;
            typed = step.known;
            steps.push({ segment: head, type: current, mismatch: step.mismatch });
        } else if (chain.kind === 'plain') {
            if (headLower === 'root') {
                current = frame.root;
            } else if (headLower === 'this') {
                current = frame.this;
            } else if (headLower === 'prev') {
                current = frame.prev;
            } else {
                const step = linkStep(this.spec, head, frame.this);
                current = step.type;
                typed = step.known;
                steps.push({ segment: head, type: current, mismatch: step.mismatch });
            }
            if (steps.length === 0) {
                steps.push({ segment: head, type: current });
            }
        } else {
            // var:/local_var:/global_var:/flag:/value: heads hold values or untyped scopes
            return { steps: chain.segments.map((segment) => ({ segment })) };
        }
        for (const segment of chain.segments.slice(1)) {
            if (!typed) {
                steps.push({ segment });
                continue;
            }
            const colon = segment.indexOf(':');
            const name = colon > 0 ? segment.slice(0, colon) : segment;
            const segLower = lower(name);
            if (colon < 0 && segLower === 'root') {
                current = frame.root;
                steps.push({ segment, type: current });
                continue;
            }
            if (colon < 0 && segLower === 'this') {
                steps.push({ segment, type: current });
                continue;
            }
            if (colon < 0 && segLower === 'prev') {
                current = undefined;
                steps.push({ segment });
                continue;
            }
            const step = linkStep(this.spec, name, current, colon > 0);
            if (!step.known) {
                typed = false; // a trigger or script value ending the chain, or an unknown link
                current = undefined;
                steps.push({ segment });
                continue;
            }
            current = step.type;
            steps.push({ segment, type: current, mismatch: step.mismatch });
        }
        return { steps, result: typed ? current : undefined };
    }

    private savedType(name: string): string | undefined {
        if (!this.record) {
            return undefined;
        }
        return this.result.saved.get(this.record)?.get(name);
    }
}

/** How many saves of `name` the workspace index and the base game hold. */
function saveCount(input: CheckInput, name: string): number {
    const { workspace } = input;
    const count = (symbols: Array<{ type: SymbolType }>): number =>
        symbols.filter((s) => s.type === SymbolType.SCOPE).length;
    return (
        count(workspace.index.findSymbolsByName(name)) +
        count(workspace.vanillaIndex.findSymbolsByName(name))
    );
}

/**
 * Resolve the scope types of one parsed file. `contexts` is the registry's reading of its
 * blocks (blockContexts), computed when not given.
 */
export function resolveScopes(
    input: CheckInput,
    contexts?: Map<ASTNode[], BlockContext>
): ScopeResolution {
    const trace = contexts ?? blockContexts(input);
    const first = new Resolver(input, trace, new Map());
    const pass1 = first.run();
    // scope:x has a type only when x is saved exactly once (index + base game), in the record
    // using it, at a point whose type is known.
    const saved = new Map<ASTNode, Map<string, string>>();
    for (const [record, byName] of first.saveSites) {
        for (const [name, types] of byName) {
            const type = types.length === 1 ? types[0] : undefined;
            if (type !== undefined && saveCount(input, name) === 1) {
                let map = saved.get(record);
                if (!map) {
                    map = new Map();
                    saved.set(record, map);
                }
                map.set(name, type);
            }
        }
    }
    if (saved.size === 0) {
        return pass1;
    }
    return new Resolver(input, trace, saved).run();
}
