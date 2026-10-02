/**
 * Registry checks: every key in a trigger or effect block is judged by (name, context)
 * against the spec package's engine-derived buckets, the workspace index (scripted
 * effects, triggers, lists and values) and, with --vanilla, the base game's definitions.
 *
 * Reported with the engine's own catalogue messages:
 *   unknown_trigger_X   a key in trigger context that is not a trigger here (unknown names,
 *                       effects used as triggers, every_/random_/ordered_ iterators,
 *                       iterators over an unknown list)
 *   unknown_effect_X    the same for effect context (triggers used as effects, any_
 *                       iterators, …)
 *   unknown_modifier_type_X_at_X   a key in a modifier block that is neither in the
 *                       modifier table nor fills a modifier template
 * and, where the catalogue has no text, PYCH-R001/PYCH-R002 for keywords retired in the
 * package's version (the message names the replacement).
 *
 * Names in both the triggers and effects buckets are accepted in either context. The
 * block body of an unknown keyword is not read further, as the engine skips it too.
 */

import { Bucket, FieldSpec, SchemaEntry } from '../spec/types';
import { ASTNode, NodeType } from '../syntax/ast';
import { SymbolType } from '../index/symbols';
import { messageText } from '../messages';
import {
    BLOCK_PARAMS,
    CONTAINERS,
    ContainerRule,
    OPENS_CONTEXT,
    VALUE_BLOCK_KEYS,
    VALUE_FIELDS,
} from './contexts';
import { ChildContext, ITERATOR_PARAMS, MODIFIER_BLOCK_PARAMS, STRUCTURAL } from './structural';
import { CheckInput, Diagnostic, Severity } from './types';

export type Context = 'trigger' | 'effect';

/**
 * How the registry read one block body: the context its keys were judged in and the
 * schema fields it admits. Recorded per children array when tracing (see contextAt).
 */
export interface BlockContext {
    /** trigger/effect block, modifier block, script-value block or none of them. */
    kind: 'trigger' | 'effect' | 'modifier' | 'value' | 'none';
    /** Fields the schema records at this position (record bodies, nested fields). */
    fields?: Record<string, FieldSpec>;
}

/** Extra keys a block body accepts beyond triggers/effects. */
interface BlockExtras {
    params?: ReadonlyMap<string, ChildContext>;
    scriptedModifiers?: boolean;
}

const iteratorParamCache = new Map<string, ReadonlyMap<string, ChildContext>>();

/** Parameters an iterator over `base` accepts (see ITERATOR_PARAMS). */
function iteratorParams(base: string): ReadonlyMap<string, ChildContext> {
    let map = iteratorParamCache.get(base);
    if (!map) {
        const built = new Map<string, ChildContext>();
        for (const [name, entry] of ITERATOR_PARAMS) {
            if (entry.lists === '*' || entry.lists.includes(base)) {
                built.set(name, name === 'continue' || name === 'filter' ? 'trigger' : 'none');
            }
        }
        map = built;
        iteratorParamCache.set(base, map);
    }
    return map;
}

/** A block whose direct children are script-value math is a value block. */
function isValueBlock(nodes: ASTNode[]): boolean {
    return nodes.some((n) => n.key !== undefined && VALUE_BLOCK_KEYS.has(n.key));
}

/** Schema placeholder keys (dated history entries and the like). */
function isPlaceholderField(fields: Record<string, FieldSpec> | undefined, key: string): boolean {
    return (
        fields !== undefined &&
        !Object.prototype.hasOwnProperty.call(fields, key) &&
        (DATE_KEY.test(key) || NUMBER_KEY.test(key))
    );
}

const DATE_KEY = /^-?\d+\.\d+\.\d+$/;
const NUMBER_KEY = /^-?\d+(\.\d+)?$/;
const TITLE_KEY = /^[hekdcb]_/;

/** Field spec for a key, including the schema's placeholder keys (<title>, <date>, <number>). */
export function fieldFor(
    fields: Record<string, FieldSpec> | undefined,
    key: string
): FieldSpec | undefined {
    if (!fields) {
        return undefined;
    }
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
        return fields[key];
    }
    if (DATE_KEY.test(key) && fields['<date>']) {
        return fields['<date>'];
    }
    if (NUMBER_KEY.test(key) && fields['<number>']) {
        return fields['<number>'];
    }
    if (TITLE_KEY.test(key) && fields['<title>']) {
        return fields['<title>'];
    }
    return undefined;
}

/** Keys that are not judged as keywords: parameters, numbers, strings, constants. */
function isOpaqueKey(node: ASTNode): boolean {
    const key = node.key ?? '';
    if (key.includes('$')) {
        return true;
    }
    return (
        node.keyKind === 'number' ||
        node.keyKind === 'date' ||
        node.keyKind === 'string' ||
        node.keyKind === 'constant' ||
        node.keyKind === 'expression'
    );
}

class RegistryWalker {
    public readonly diagnostics: Diagnostic[] = [];
    private readonly localTriggers = new Set<string>();
    private readonly localEffects = new Set<string>();

    constructor(
        private readonly input: CheckInput,
        private readonly trace?: Map<ASTNode[], BlockContext>
    ) {
        for (const node of input.ast.children ?? []) {
            if (node.keyPrefix === 'scripted_trigger' && node.key) {
                this.localTriggers.add(node.key);
            } else if (node.keyPrefix === 'scripted_effect' && node.key) {
                this.localEffects.add(node.key);
            }
        }
    }

    private report(
        node: ASTNode,
        severity: Severity,
        id: string,
        args: Array<string | number>
    ): void {
        this.diagnostics.push({
            file: this.input.file,
            range: node.keyRange ?? node.range,
            severity,
            code: id,
            message: messageText(this.input.spec, id, ...args),
            source: 'engine',
        });
    }

    // ── entry ────────────────────────────────────────────────────────────

    public run(): void {
        const { spec, file, ast } = this.input;
        const dir = spec.directoryOf(file);
        const schema = dir ? spec.schemaOf(dir) : undefined;
        for (const record of ast.children ?? []) {
            if (!record.children || record.type === NodeType.COMMENT) {
                continue;
            }
            if (record.keyPrefix === 'scripted_trigger') {
                this.walkContext(record.children, 'trigger');
            } else if (record.keyPrefix === 'scripted_effect') {
                this.walkContext(record.children, 'effect');
            } else if (schema) {
                this.walkRecord(record, schema);
            } else {
                this.walkNone(record.children, undefined);
            }
        }
    }

    /** Record how a block body was read (first reading wins). */
    private mark(nodes: ASTNode[], context: BlockContext): void {
        if (this.trace && !this.trace.has(nodes)) {
            this.trace.set(nodes, context);
        }
    }

    private walkRecord(record: ASTNode, schema: SchemaEntry): void {
        const children = record.children ?? [];
        switch (schema.record_body) {
            case 'trigger_block':
                this.walkContext(children, 'trigger');
                return;
            case 'effect_block':
                this.walkContext(children, 'effect');
                return;
            case 'modifier_block':
                this.checkModifiers(children, schema.fields, schema.unconfirmed);
                return;
            default:
                this.walkNone(children, schema.fields, schema.content_type === 'script_value');
        }
    }

    // ── outside trigger/effect blocks ────────────────────────────────────

    /**
     * Blocks outside trigger/effect context. In value mode (script values and other value
     * blocks) only filters open a trigger context; schema field kinds are not trusted there.
     */
    private walkNone(
        nodes: ASTNode[],
        fields: Record<string, FieldSpec> | undefined,
        valueMode = false
    ): void {
        this.mark(nodes, { kind: valueMode ? 'value' : 'none', fields });
        for (const node of nodes) {
            if (!node.children) {
                continue;
            }
            if (!node.key) {
                this.walkNone(node.children, undefined, valueMode);
                continue;
            }
            const field = fieldFor(fields, node.key);
            const opens = OPENS_CONTEXT.get(node.key);
            if (valueMode) {
                if (opens === 'trigger') {
                    this.walkContext(node.children, 'trigger');
                } else {
                    this.walkNone(node.children, undefined, true);
                }
                continue;
            }
            if (field?.holds === 'modifiers') {
                this.checkModifiers(node.children, undefined);
                continue;
            }
            if (isPlaceholderField(fields, node.key)) {
                // A dated (or numbered) history entry: history fields plus `effect = { }`.
                this.walkNone(node.children, field?.fields);
                continue;
            }
            if (VALUE_FIELDS.has(node.key) || isValueBlock(node.children)) {
                this.walkNone(node.children, undefined, true);
                continue;
            }
            const extras = { params: BLOCK_PARAMS.get(node.key) };
            if (field?.kind === 'trigger_block') {
                this.walkContext(node.children, 'trigger', field.fields, extras);
                continue;
            }
            if (field?.kind === 'effect_block') {
                this.walkContext(node.children, 'effect', field.fields, extras);
                continue;
            }
            if (opens) {
                const allowed = field?.fields ?? this.borrowedFields(node.key);
                this.walkContext(node.children, opens, allowed, extras);
                continue;
            }
            this.walkNone(node.children, field?.fields);
        }
    }

    // ── trigger and effect blocks ────────────────────────────────────────

    private walkContext(
        nodes: ASTNode[],
        ctx: Context,
        allowed?: Record<string, FieldSpec>,
        extras?: BlockExtras
    ): void {
        this.mark(nodes, { kind: ctx, fields: allowed });
        for (const node of nodes) {
            if (node.type === NodeType.COMMENT || node.type === NodeType.VALUE) {
                continue;
            }
            if (!node.key) {
                if (node.children) {
                    this.walkContext(node.children, ctx, allowed);
                }
                continue;
            }
            this.checkKey(node, ctx, allowed, extras);
        }
    }

    private descend(node: ASTNode, child: ChildContext, ctx: Context): void {
        if (!node.children) {
            return;
        }
        if (child === 'none' || isValueBlock(node.children)) {
            this.walkNone(node.children, undefined, child !== 'none');
        } else {
            this.walkContext(node.children, child === 'same' ? ctx : child);
        }
    }

    private checkKey(
        node: ASTNode,
        ctx: Context,
        allowed: Record<string, FieldSpec> | undefined,
        extras: BlockExtras | undefined
    ): void {
        const key = node.key ?? '';
        const params = extras?.params;
        const { spec, workspace } = this.input;

        if (isOpaqueKey(node)) {
            // A `$PARAM$` key is resolved only when the scripted effect is expanded.
            this.descend(node, key.includes('$') ? 'none' : 'same', ctx);
            return;
        }
        if (node.keyChain) {
            // A scope chain switches scope and keeps the context (resolved by the scope check).
            this.descend(node, 'same', ctx);
            return;
        }
        const param = params?.get(key);
        if (param) {
            this.descend(node, param, ctx);
            return;
        }
        const structural = STRUCTURAL.get(key);
        if (structural) {
            this.descend(node, structural.child, ctx);
            return;
        }

        const bucket: Bucket = ctx === 'trigger' ? 'triggers' : 'effects';
        if (key !== key.toLowerCase()) {
            // The readers accept upper-case spellings (ROOT, THIS, ALL_FALSE in vanilla).
            const lower = key.toLowerCase();
            const lowerStructural = STRUCTURAL.get(lower);
            const lowerPrefix = spec.iteratorPrefix(lower);
            const lowerIterator =
                lowerPrefix !== undefined && this.isList(lower.slice(lowerPrefix.length));
            if (
                lowerStructural ||
                lowerIterator ||
                spec.has(lower, bucket) ||
                spec.has(lower, 'links')
            ) {
                this.descend(node, lowerStructural ? lowerStructural.child : 'same', ctx);
                return;
            }
        }
        if (spec.has(key, bucket)) {
            const container = CONTAINERS.get(key);
            if (container) {
                this.descendContainer(node, container, ctx);
            } else if (spec.has(key, 'links')) {
                this.descend(node, 'same', ctx);
            } else {
                this.descend(node, 'none', ctx);
            }
            return;
        }
        if (spec.has(key, 'links') || workspace.keywordTemplateFor(key, 'links')) {
            this.descend(node, 'same', ctx);
            return;
        }
        if (workspace.keywordTemplateFor(key, bucket)) {
            // A per-database keyword (`has_relation_friend`, `add_diplomacy_lifestyle_xp`).
            this.descend(node, 'none', ctx);
            return;
        }

        const prefix = spec.iteratorPrefix(key);
        if (prefix) {
            const base = key.slice(prefix.length);
            const known = this.isList(base);
            const fits = ctx === 'trigger' ? prefix === 'any_' : prefix !== 'any_';
            if (known && fits) {
                if (node.children) {
                    this.walkContext(node.children, ctx, undefined, {
                        params: iteratorParams(base),
                    });
                }
                return;
            }
        }

        if (this.isScripted(key, ctx)) {
            this.descend(node, 'none', ctx);
            return;
        }
        if (extras?.scriptedModifiers && workspace.isDefined(key, SymbolType.SCRIPTED_MODIFIER)) {
            this.descend(node, 'none', ctx);
            return;
        }

        const field = fieldFor(allowed, key);
        if (field) {
            // The schema records this key at this position in vanilla.
            const open = OPENS_CONTEXT.get(key);
            if (field.kind === 'trigger_block' || field.kind === 'effect_block') {
                this.descend(node, field.kind === 'trigger_block' ? 'trigger' : 'effect', ctx);
            } else if (open) {
                this.descend(node, open, ctx);
            } else {
                this.descend(node, 'none', ctx);
            }
            return;
        }

        const retired = spec.retired(key);
        if (retired) {
            const replacement = retired.replacement;
            if (replacement !== null && replacement.length > 0) {
                const list = Array.isArray(replacement) ? replacement.join(' or ') : replacement;
                this.report(node, 'error', 'PYCH-R001', [key, retired.removed_in, list]);
            } else {
                const note = retired.note ? ` (${retired.note})` : '';
                this.report(node, 'error', 'PYCH-R002', [key, retired.removed_in, note]);
            }
            return;
        }

        this.report(node, 'error', ctx === 'trigger' ? 'unknown_trigger_X' : 'unknown_effect_X', [
            key,
        ]);
    }

    private descendContainer(node: ASTNode, rule: ContainerRule, ctx: Context): void {
        if (!node.children) {
            return;
        }
        const inner: Context = rule.child === 'same' || rule.child === 'none' ? ctx : rule.child;
        if (rule.child === 'none') {
            this.walkNone(node.children, undefined);
            return;
        }
        if (isValueBlock(node.children)) {
            this.walkNone(node.children, undefined);
            return;
        }
        if (!rule.cases) {
            this.walkContext(node.children, inner, undefined, {
                params: rule.params,
                scriptedModifiers: rule.scriptedModifiers,
            });
            return;
        }
        for (const child of node.children) {
            if (child.type === NodeType.COMMENT || child.type === NodeType.VALUE || !child.key) {
                continue;
            }
            const param = rule.params?.get(child.key);
            if (param) {
                this.descend(child, param, ctx);
            } else if (child.children) {
                this.walkContext(child.children, inner, undefined, {
                    params: rule.caseParams,
                    scriptedModifiers: rule.caseScriptedModifiers,
                });
            }
        }
    }

    /**
     * Outside a known directory, an `option` block still reads as an event option: borrow
     * the field list the events schema records for it (name, trigger, ai_chance …).
     */
    private borrowedFields(key: string): Record<string, FieldSpec> | undefined {
        if (key !== 'option') {
            return undefined;
        }
        return this.input.spec.schemaOf('events')?.fields.option?.fields;
    }

    /** An iterator base: a registered list, a templated list or a scripted list. */
    private isList(base: string): boolean {
        return (
            this.input.spec.has(base, 'lists') ||
            this.input.workspace.keywordTemplateFor(base, 'lists') !== undefined ||
            this.input.workspace.isDefined(base, SymbolType.SCRIPTED_LIST)
        );
    }

    /** A scripted trigger/effect/value of the workspace, the base game or this file. */
    private isScripted(key: string, ctx: Context): boolean {
        const { workspace } = this.input;
        if (ctx === 'trigger') {
            return (
                this.localTriggers.has(key) ||
                workspace.isDefined(key, SymbolType.SCRIPTED_TRIGGER, SymbolType.SCRIPT_VALUE)
            );
        }
        return this.localEffects.has(key) || workspace.isDefined(key, SymbolType.SCRIPTED_EFFECT);
    }

    // ── modifier blocks ──────────────────────────────────────────────────

    /**
     * Modifier blocks. Record fields of the directory (and its unconfirmed wiki-era fields,
     * which are allowed though not evidence) are not modifier types.
     */
    private checkModifiers(
        nodes: ASTNode[],
        fields: Record<string, FieldSpec> | undefined,
        unconfirmed?: Record<string, unknown>
    ): void {
        this.mark(nodes, { kind: 'modifier', fields });
        const { spec, workspace } = this.input;
        for (const node of nodes) {
            if (node.type === NodeType.COMMENT || node.type === NodeType.VALUE || !node.key) {
                continue;
            }
            const key = node.key;
            if (
                isOpaqueKey(node) ||
                fieldFor(fields, key) ||
                (unconfirmed !== undefined &&
                    Object.prototype.hasOwnProperty.call(unconfirmed, key)) ||
                MODIFIER_BLOCK_PARAMS.has(key)
            ) {
                continue;
            }
            if (spec.isModifier(key)) {
                continue;
            }
            if (workspace.isDefined(key, SymbolType.MODIFIER_FORMAT)) {
                continue;
            }
            const retired = spec.retired(key);
            if (retired && retired.bucket === 'modifiers') {
                const replacement = retired.replacement;
                const list = Array.isArray(replacement)
                    ? replacement.join(' or ')
                    : (replacement ?? '');
                this.report(node, 'error', list ? 'PYCH-R001' : 'PYCH-R002', [
                    key,
                    retired.removed_in,
                    list,
                ]);
                continue;
            }
            const line = (node.keyRange ?? node.range).start.line + 1;
            this.report(node, 'error', 'unknown_modifier_type_X_at_X', [
                key,
                `${this.input.file}:${line}`,
            ]);
        }
    }
}

/**
 * Run the registry checks on one parsed file. When `trace` is given it is filled with the
 * reading of every block (as blockContexts returns it), so the scope check can reuse it.
 */
export function checkRegistry(
    input: CheckInput,
    trace?: Map<ASTNode[], BlockContext>
): Diagnostic[] {
    const walker = new RegistryWalker(input, trace);
    walker.run();
    return walker.diagnostics;
}

/**
 * The registry's reading of every block body of one file: for each children array, the
 * context its keys are judged in. The body of an unknown keyword is not read and so has
 * no entry. The top level of the file is recorded as 'none' with the directory's record
 * fields absent (the keys there are record names).
 */
export function blockContexts(input: CheckInput): Map<ASTNode[], BlockContext> {
    const trace = new Map<ASTNode[], BlockContext>();
    if (input.ast.children) {
        trace.set(input.ast.children, { kind: 'none' });
    }
    new RegistryWalker(input, trace).run();
    return trace;
}
