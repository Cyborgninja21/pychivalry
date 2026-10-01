/**
 * Scope structure checks. Per-keyword scope validity is not checked: the spec package's
 * scope_validity is empty until an oracle run fills it (review issue S1); `scopeValidity`
 * exposes that slot so the check can be added without a redesign.
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
import { ASTNode, NodeType, ScopeChain } from '../syntax/ast';
import { SymbolType } from '../index/symbols';
import { messageText } from '../messages';
import { CheckInput, Diagnostic, Severity } from './types';

/** Scope references that are not links: the top scope and the current one. */
const SCOPE_HEADS: ReadonlySet<string> = new Set(['root', 'this', 'prev']);

/** Supported scopes of a keyword from the package (always undefined in 1.20.0.2). */
export function scopeValidity(spec: Spec, name: string): unknown {
    return spec.scopeValidity(name);
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

    constructor(private readonly input: CheckInput) {
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
export function checkScope(input: CheckInput): Diagnostic[] {
    const checker = new ScopeChecker(input);
    checker.run();
    return checker.diagnostics;
}
