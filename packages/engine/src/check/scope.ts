/**
 * Scope checks: structure, and per-keyword scope validity from the game's own `script_docs`
 * documentation (spec package format 3, `scope_validity`), on the scope types the resolver
 * (scope-types.ts) infers.
 *
 *   wrong_scope_for_trigger_X_expected_X   (error) a trigger used where the current scope
 *   wrong_scope_for_effect_X_expected_X    type is not among its supported scopes; the
 *                              game prints the same text ("Wrong scope for trigger:
 *                              landed_title, expected character").
 *   trying_to_use_X_link_on_an_invalid_scope_X   (error) a link (`liege = { }`, a chain step)
 *                              whose input scopes do not include the current scope type.
 *
 *   Never reported when any input is unknown: the current type is unknown (scripted
 *   triggers and effects, parameter blocks, untyped saved scopes …), the keyword's
 *   supported scopes are `none` (it declares no requirement) or empty, or the game does not
 *   document the keyword.
 *
 *   undefined_event_target_X   (information) `scope:name` with no save_scope_as /
 *                              save_temporary_scope_as / save_scope_value_as for that name
 *                              in the file, the workspace index or the vanilla base game.
 *                              Reported only when a vanilla base game is loaded: without it,
 *                              names vanilla saves (scope:recipient, scope:owner …) are unknown.
 *                              Names the engine itself provides (scope:duel_value, interaction
 *                              send-option flags) are still reported: vanilla 1.20 has 10,522
 *                              such uses, hence the information severity.
 *   failed_to_parse_data_for_event_target_link_link_X_location_X   (error) a chain
 *                              segment that is not a scope link (`root.not_a_link.holder`)
 *
 * `?=` needs no check here: the parser rejects it after a number, date or string, and vanilla
 * 1.20 uses it after keywords as well as chains (`remove_variable ?= x`, `any_held_county ?=`).
 */

import { Spec } from '../spec/spec';
import { ScopeRecord } from '../spec/types';
import { ASTNode, NodeType, ScopeChain } from '../syntax/ast';
import { SymbolType } from '../index/symbols';
import { messageText } from '../messages';
import { CONTAINERS } from './contexts';
import { BlockContext, fieldFor } from './registry';
import { ChainResolution, ScopeResolution, resolveScopes } from './scope-types';
import { ITERATOR_PARAMS } from './structural';
import { CheckInput, Diagnostic, Severity } from './types';

/** Scope references that are not links: the top scope and the current one. */
const SCOPE_HEADS: ReadonlySet<string> = new Set(['root', 'this', 'prev']);

/** Supported scopes of a trigger or effect, as the game documents them (or undefined). */
export function scopeValidity(
    spec: Spec,
    name: string,
    bucket: 'triggers' | 'effects' | 'lists' | 'on_actions'
): ScopeRecord | undefined {
    return spec.scopeValidity(name, bucket) ?? spec.scopeValidity(name.toLowerCase(), bucket);
}

function savedScopeNames(ast: ASTNode): Set<string> {
    const names = new Set<string>();
    const visit = (node: ASTNode): void => {
        if (
            (node.key === 'save_scope_as' || node.key === 'save_temporary_scope_as') &&
            typeof node.value === 'string'
        ) {
            names.add(node.value);
        }
        if (
            (node.key === 'save_scope_value_as' || node.key === 'save_temporary_scope_value_as') &&
            node.children
        ) {
            const name = node.children.find((c) => c.key === 'name');
            if (name && typeof name.value === 'string') {
                names.add(name.value);
            }
        }
        for (const child of node.children ?? []) {
            visit(child);
        }
    };
    visit(ast);
    return names;
}

class ScopeChecker {
    public readonly diagnostics: Diagnostic[] = [];
    private readonly saved: Set<string>;

    constructor(
        private readonly input: CheckInput,
        private readonly contexts?: Map<ASTNode[], BlockContext>
    ) {
        this.saved = savedScopeNames(input.ast);
    }

    private report(
        range: ASTNode['range'],
        severity: Severity,
        id: string,
        args: Array<string | number>
    ): void {
        this.diagnostics.push({
            file: this.input.file,
            range,
            severity,
            code: id,
            message: messageText(this.input.spec, id, ...args),
            source: 'engine',
        });
    }

    public run(): void {
        this.visit(this.input.ast);
        this.checkTypes(resolveScopes(this.input, this.contexts));
    }

    // ── per-keyword scope validity and link inputs ──────────────────────

    private checkTypes(res: ScopeResolution): void {
        const inContext = new Set<ASTNode>();
        for (const [nodes, ctx] of res.contexts) {
            if (ctx.kind !== 'trigger' && ctx.kind !== 'effect') {
                continue;
            }
            const owner = res.owners.get(nodes);
            for (const node of nodes) {
                inContext.add(node);
                this.checkKeyword(node, ctx.kind, ctx.fields, owner, res);
            }
        }
        // Only chains read as triggers/effects/links are judged: a chain that is the value of
        // an iterator parameter or of a scripted effect's argument is evaluated elsewhere.
        for (const [node, chain] of res.keyChains) {
            if (inContext.has(node)) {
                this.reportMismatches(chain, node.keyRange ?? node.range);
            }
        }
        for (const [node, chain] of res.valueChains) {
            if (inContext.has(node) && !(node.key && ITERATOR_PARAMS.has(node.key))) {
                this.reportMismatches(chain, node.valueRange ?? node.range);
            }
        }
    }

    private reportMismatches(chain: ChainResolution, range: ASTNode['range']): void {
        for (const step of chain.steps) {
            if (step.mismatch) {
                this.report(range, 'error', 'trying_to_use_X_link_on_an_invalid_scope_X', [
                    step.mismatch.link,
                    step.mismatch.on,
                ]);
            }
        }
    }

    private checkKeyword(
        node: ASTNode,
        ctx: 'trigger' | 'effect',
        fields: Parameters<typeof fieldFor>[0],
        owner: ASTNode | undefined,
        res: ScopeResolution
    ): void {
        const key = node.key;
        if (
            !key ||
            node.type === NodeType.COMMENT ||
            node.type === NodeType.VALUE ||
            node.keyChain ||
            (node.keyKind !== undefined && node.keyKind !== 'identifier') ||
            key.includes('$')
        ) {
            return;
        }
        const current = res.nodeFrames.get(node)?.this;
        if (current === undefined) {
            return;
        }
        const { spec } = this.input;
        const name = key.toLowerCase();
        // Parameters and fields of the enclosing block are not keywords here.
        if (ITERATOR_PARAMS.has(key) || fieldFor(fields, key)) {
            return;
        }
        if (owner?.key && CONTAINERS.get(owner.key)?.params?.has(key)) {
            return;
        }
        // A link used as a block switches scope (checked as a link, not as a keyword).
        if (
            node.children &&
            (spec.has(key, 'links') || spec.has(name, 'links')) &&
            !CONTAINERS.has(key)
        ) {
            return;
        }
        const bucket = ctx === 'trigger' ? 'triggers' : 'effects';
        const doc = scopeValidity(spec, key, bucket);
        if (!doc) {
            return;
        }
        const scopes = doc.supported_scopes;
        if (scopes.length === 0 || scopes.includes('none') || scopes.includes(current)) {
            return;
        }
        this.report(
            node.keyRange ?? node.range,
            'error',
            ctx === 'trigger'
                ? 'wrong_scope_for_trigger_X_expected_X'
                : 'wrong_scope_for_effect_X_expected_X',
            [current, scopes.join(', ')]
        );
    }

    private visit(node: ASTNode): void {
        if (node.type !== NodeType.COMMENT) {
            if (node.keyChain) {
                this.checkChain(node.keyChain, node.keyRange ?? node.range);
            }
            if (node.valueChain) {
                this.checkChain(node.valueChain, node.valueRange ?? node.range);
            }
        }
        for (const child of node.children ?? []) {
            this.visit(child);
        }
    }

    private isLink(name: string): boolean {
        const { spec, workspace } = this.input;
        const lower = name.toLowerCase();
        return (
            spec.has(name, 'links') ||
            workspace.keywordTemplateFor(name, 'links') !== undefined ||
            SCOPE_HEADS.has(lower) ||
            spec.has(lower, 'links')
        );
    }

    /** A segment that may end a chain: a value such as `scope:x.gold` or `root.age`. */
    private isValueSegment(name: string): boolean {
        const { spec, workspace } = this.input;
        return (
            spec.has(name, 'triggers') ||
            workspace.keywordTemplateFor(name, 'triggers') !== undefined ||
            workspace.isDefined(name, SymbolType.SCRIPT_VALUE)
        );
    }

    private isSaved(name: string): boolean {
        return this.saved.has(name) || this.input.workspace.isDefined(name, SymbolType.SCOPE);
    }

    /**
     * Only chains that start at a definite scope reference (root/this/prev, `scope:x`) are
     * walked link by link: other dotted values are often localization keys or database
     * paths, and database-reference prefixes (`trait:`, `culture_pillar:` …) are not in
     * the package's links bucket.
     */
    private checkChain(chain: ScopeChain, range: ASTNode['range']): void {
        const text = chain.segments.join('.');
        if (text.includes('$')) {
            return;
        }
        if (
            this.input.workspace.vanillaRoot !== undefined &&
            chain.kind === 'scope' &&
            chain.name !== undefined &&
            !this.isSaved(chain.name)
        ) {
            this.report(range, 'information', 'undefined_event_target_X', [`scope:${chain.name}`]);
        }
        const head = chain.segments[0];
        const scopeHead = chain.kind === 'scope' || SCOPE_HEADS.has(head.toLowerCase());
        if (!scopeHead) {
            return;
        }
        const rest = chain.segments.slice(1);
        const bad = rest.find((segment, i) => {
            const colon = segment.indexOf(':');
            if (colon > 0) {
                return false; // `root.var:x`, `scope:a.title:k_x` — typed references
            }
            const last = i === rest.length - 1;
            return !this.isLink(segment) && !(last && this.isValueSegment(segment));
        });
        if (bad !== undefined) {
            const location = `${this.input.file}:${range.start.line + 1}`;
            this.report(
                range,
                'error',
                'failed_to_parse_data_for_event_target_link_link_X_location_X',
                [text, location]
            );
        }
    }
}

/** Run the scope structure checks on one parsed file. */
export function checkScope(
    input: CheckInput,
    contexts?: Map<ASTNode[], BlockContext>
): Diagnostic[] {
    const checker = new ScopeChecker(input, contexts);
    checker.run();
    return checker.diagnostics;
}
