/**
 * Completion Provider — every name it offers comes from the engine (pychivalry-engine):
 * the spec package's buckets and per-directory schema, the engine's context tracker
 * (contextAt) and the workspace index.
 *
 * - In a trigger block: the triggers bucket, `any_` iterators over the lists bucket and the
 *   workspace's scripted lists, the workspace's scripted triggers and script values, the
 *   structural keywords and the fields the schema records at that position.
 * - In an effect block: the effects bucket, `every_`/`random_`/`ordered_` iterators, the
 *   workspace's scripted effects, the structural keywords and the schema's fields.
 * - In a modifier block: the modifiers bucket.
 * - Inside a record of a known directory: the schema's fields for that record.
 * - At the top level: record templates (snippets.ts) and, in common/on_action, the
 *   on_actions bucket.
 * - After `scope:`: saved scopes from the index; after `x.`: the links bucket; after
 *   `key =`: yes/no, event ids, traits, scripted names and on_actions by key.
 *
 * Per-keyword scope validity is not in the spec package (empty `scope_validity`), so
 * nothing is filtered by scope type.
 */

import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    MarkupKind,
    Position,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    Bucket,
    CK3Parser,
    contextAt,
    FieldSpec,
    PositionContext,
    Spec,
    STRUCTURAL,
    SymbolType,
    uriToPath,
    Workspace,
} from 'pychivalry-engine';
import { blockSnippet, KEYWORD_SNIPPETS, RECORD_TEMPLATES } from './snippets';
import { bucketLabel, iteratorMarkdown, keywordMarkdown } from './keyword-docs';

/** Data carried by a completion item for lazy documentation (resolveCompletion). */
interface ItemData {
    name: string;
    bucket?: Bucket;
    iterator?: boolean;
    field?: { directory: string; description?: string; kind: string; usage: number };
}

const TRIGGER_PREFIXES = ['any_'];
const EFFECT_PREFIXES = ['every_', 'random_', 'ordered_'];

/** Keys whose value is a trait / an event id / an on_action. */
const TRAIT_KEYS = new Set(['has_trait', 'add_trait', 'remove_trait', 'trait']);
const EVENT_KEYS = new Set(['id', 'trigger_event']);
const ON_ACTION_KEYS = new Set(['on_action']);

function item(
    label: string,
    kind: CompletionItemKind,
    detail: string,
    rank: string,
    data?: ItemData
): CompletionItem {
    return { label, kind, detail, sortText: `${rank}_${label}`, data };
}

function fieldKindLabel(field: FieldSpec): string {
    return field.holds === 'modifiers' ? 'modifier block' : field.kind.replace('_', ' ');
}

export class CompletionProvider {
    constructor(
        private parser: CK3Parser,
        private workspace: Workspace
    ) {}

    private get spec(): Spec {
        return this.workspace.spec;
    }

    public async provideCompletions(
        document: TextDocument,
        position: Position
    ): Promise<CompletionItem[]> {
        const text = document.getText();
        const lineText = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line + 1, character: 0 },
        });
        const before = lineText.substring(0, position.character);

        if (/(^|[\s={.])scope:[\w]*$/.test(before)) {
            return this.savedScopes();
        }
        if (/[\w:]+\.[\w]*$/.test(before) && !/^\s*[\w]+\.\d*$/.test(before)) {
            return this.links();
        }
        const assignment = before.match(/([\w:.$]+)\s*(=|\?=)\s*[\w]*$/);
        if (assignment && !/\{\s*[\w]*$/.test(before)) {
            return this.values(assignment[1]);
        }

        const parsed = this.parser.parse(text);
        const file = uriToPath(document.uri);
        const ctx = contextAt(this.workspace, file, parsed.ast, position);
        return this.keys(ctx);
    }

    /** Documentation is attached lazily: the engine doc of the name, verbatim. */
    public async resolveCompletion(completion: CompletionItem): Promise<CompletionItem> {
        const data = completion.data as ItemData | undefined;
        if (!data || completion.documentation) {
            return completion;
        }
        let value: string | undefined;
        if (data.iterator) {
            value = iteratorMarkdown(this.spec, data.name);
        } else if (data.bucket) {
            value = keywordMarkdown(this.spec, data.name);
        } else if (data.field) {
            const f = data.field;
            value =
                `**${data.name}** — field of \`${f.directory}\` records (${f.kind})` +
                (f.description ? `\n\n${f.description}` : '') +
                `\n\n*Used ${f.usage} time(s) in vanilla CK3 ${this.spec.version()}*`;
        }
        if (value) {
            completion.documentation = { kind: MarkupKind.Markdown, value };
        }
        return completion;
    }

    // ── key positions ────────────────────────────────────────────────────

    private keys(ctx: PositionContext): CompletionItem[] {
        const out: CompletionItem[] = [];
        const topLevel = ctx.path.length === 1;
        if (topLevel) {
            out.push(...this.recordTemplates(ctx));
            if (ctx.directory?.content_type === 'on_action') {
                out.push(...this.bucketItems('on_actions', CompletionItemKind.Event, '2'));
            }
            return out;
        }
        if (ctx.fields) {
            out.push(...this.fieldItems(ctx.fields, ctx.directory?.path ?? ''));
        }
        switch (ctx.kind) {
            case 'trigger':
                out.push(...this.bucketItems('triggers', CompletionItemKind.Function, '3'));
                out.push(...this.iterators(TRIGGER_PREFIXES));
                out.push(
                    ...this.scripted(
                        [SymbolType.SCRIPTED_TRIGGER, SymbolType.SCRIPT_VALUE],
                        'scripted trigger'
                    )
                );
                out.push(...this.structural());
                break;
            case 'effect':
                out.push(...this.bucketItems('effects', CompletionItemKind.Function, '3'));
                out.push(...this.iterators(EFFECT_PREFIXES));
                out.push(...this.scripted([SymbolType.SCRIPTED_EFFECT], 'scripted effect'));
                out.push(...this.structural());
                break;
            case 'modifier':
                out.push(...this.bucketItems('modifiers', CompletionItemKind.Property, '3'));
                break;
            default:
                break;
        }
        return out;
    }

    private recordTemplates(ctx: PositionContext): CompletionItem[] {
        const templates = ctx.directory ? RECORD_TEMPLATES.get(ctx.directory.path) : undefined;
        return (templates ?? []).map((t) => ({
            label: t.label,
            kind: CompletionItemKind.Snippet,
            detail: t.detail,
            insertText: t.body,
            insertTextFormat: InsertTextFormat.Snippet,
            sortText: `0_${t.label}`,
        }));
    }

    private fieldItems(fields: Record<string, FieldSpec>, directory: string): CompletionItem[] {
        const out: CompletionItem[] = [];
        for (const [name, field] of Object.entries(fields)) {
            if (name.startsWith('<')) {
                continue; // placeholder keys (<date>, <title>, <number>)
            }
            const block =
                field.kind !== 'value' && field.kind !== 'reference' && field.kind !== 'enum';
            const completion = item(
                name,
                CompletionItemKind.Property,
                `${directory || 'record'} field · ${fieldKindLabel(field)}`,
                field.required ? '0' : '1',
                {
                    name,
                    field: {
                        directory: directory || 'record',
                        description: field.description,
                        kind: fieldKindLabel(field),
                        usage: field.usage,
                    },
                }
            );
            completion.insertText = block ? blockSnippet(name) : `${name} = $0`;
            completion.insertTextFormat = InsertTextFormat.Snippet;
            out.push(completion);
        }
        return out;
    }

    private bucketItems(bucket: Bucket, kind: CompletionItemKind, rank: string): CompletionItem[] {
        return this.spec.names(bucket).map((name) => {
            const completion = item(name, kind, bucketLabel(bucket), rank, { name, bucket });
            const snippet = KEYWORD_SNIPPETS.get(name);
            if (snippet) {
                completion.insertText = snippet;
                completion.insertTextFormat = InsertTextFormat.Snippet;
            }
            return completion;
        });
    }

    private iterators(prefixes: string[]): CompletionItem[] {
        const bases = new Set(this.spec.names('lists'));
        for (const symbol of this.workspace.index.findSymbolsByType(SymbolType.SCRIPTED_LIST)) {
            bases.add(symbol.name);
        }
        const out: CompletionItem[] = [];
        for (const prefix of prefixes) {
            for (const base of bases) {
                const name = prefix + base;
                const completion = item(
                    name,
                    CompletionItemKind.Function,
                    `iterator over ${base}`,
                    '4',
                    {
                        name,
                        iterator: true,
                    }
                );
                completion.insertText = `${name} = {\n\t$0\n}`;
                completion.insertTextFormat = InsertTextFormat.Snippet;
                out.push(completion);
            }
        }
        return out;
    }

    private scripted(types: SymbolType[], label: string): CompletionItem[] {
        const seen = new Set<string>();
        const out: CompletionItem[] = [];
        for (const type of types) {
            for (const symbol of this.workspace.index.findSymbolsByType(type)) {
                if (seen.has(symbol.name)) {
                    continue;
                }
                seen.add(symbol.name);
                const file = symbol.uri.split('/').pop() ?? symbol.uri;
                const completion = item(symbol.name, CompletionItemKind.Function, label, '2');
                completion.documentation = `Defined in ${file}:${symbol.range.start.line + 1}`;
                out.push(completion);
            }
        }
        return out;
    }

    private structural(): CompletionItem[] {
        return Array.from(STRUCTURAL.keys()).map((name) => {
            const completion = item(name, CompletionItemKind.Keyword, 'structural keyword', '1');
            const snippet = KEYWORD_SNIPPETS.get(name);
            if (snippet) {
                completion.insertText = snippet;
                completion.insertTextFormat = InsertTextFormat.Snippet;
            }
            return completion;
        });
    }

    // ── other positions ──────────────────────────────────────────────────

    private savedScopes(): CompletionItem[] {
        const seen = new Set<string>();
        const out: CompletionItem[] = [];
        for (const symbol of this.workspace.index.findSymbolsByType(SymbolType.SCOPE)) {
            if (seen.has(symbol.name)) {
                continue;
            }
            seen.add(symbol.name);
            const file = symbol.uri.split('/').pop() ?? symbol.uri;
            const completion = item(
                symbol.name,
                CompletionItemKind.Variable,
                `Saved scope from ${file}`,
                '0'
            );
            completion.documentation = `Saved scope defined at line ${symbol.range.start.line + 1}`;
            out.push(completion);
        }
        return out;
    }

    private links(): CompletionItem[] {
        return this.bucketItems('links', CompletionItemKind.Reference, '1');
    }

    private values(key: string): CompletionItem[] {
        const out: CompletionItem[] = [];
        if (TRAIT_KEYS.has(key)) {
            for (const symbol of this.workspace.index.findSymbolsByType(SymbolType.TRAIT)) {
                out.push(item(symbol.name, CompletionItemKind.EnumMember, 'trait', '1'));
            }
        }
        if (EVENT_KEYS.has(key)) {
            for (const symbol of this.workspace.index.findSymbolsByType(SymbolType.EVENT)) {
                out.push(item(symbol.name, CompletionItemKind.Event, 'event', '1'));
            }
        }
        if (ON_ACTION_KEYS.has(key)) {
            out.push(...this.bucketItems('on_actions', CompletionItemKind.Event, '1'));
        }
        if (out.length === 0 && this.takesBoolean(key)) {
            out.push(
                item('yes', CompletionItemKind.Constant, 'boolean', '0'),
                item('no', CompletionItemKind.Constant, 'boolean', '0')
            );
        }
        return out;
    }

    /** yes/no for keys whose engine doc shows `= yes`/`= no`, and for is_/has_/can_ keys. */
    private takesBoolean(key: string): boolean {
        if (/^(is|has|can|allow)_/.test(key)) {
            return true;
        }
        const doc = this.spec.doc(key) ?? '';
        return /=\s*(yes|no)\b/.test(doc);
    }
}
