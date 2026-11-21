/**
 * Directory-schema checks: a file's top-level records against the spec package's
 * per-directory schema.
 *
 *   unknown_X_in_X                   (warning) a record field the schema does not list
 *                                    (unconfirmed wiki-era fields are allowed, not evidence)
 *   unexpected_token_X_found_at_X_expected   (error) a bare value directly in a record
 *                                    body, where the reader expects `key =`
 *   <required_evidence id> / PYCH-S002       (error) a field the package marks required
 *                                    is missing (only the 3 engine-evidenced ones)
 *   PYCH-S003                        (warning) the file declares event content
 *                                    (`namespace = …`) outside a directory that loads events
 */

import { FieldSpec, SchemaEntry } from '../spec/types';
import { ASTNode, NodeType } from '../syntax/ast';
import { messageText } from '../messages';
import { fieldFor } from './registry';
import { CheckInput, Diagnostic, Severity } from './types';

function isSkippedKey(node: ASTNode): boolean {
    const key = node.key ?? '';
    return (
        key.includes('$') ||
        node.keyChain !== undefined ||
        node.keyKind === 'constant' ||
        node.keyKind === 'expression' ||
        node.keyKind === 'string'
    );
}

class SchemaChecker {
    public readonly diagnostics: Diagnostic[] = [];
    private readonly modifierFields: boolean;

    constructor(
        private readonly input: CheckInput,
        private readonly schema: SchemaEntry | undefined
    ) {
        // Directories whose records hold modifier types directly (traits, …).
        this.modifierFields =
            schema !== undefined &&
            Object.keys(schema.fields).some((k) => input.spec.isModifier(k) !== undefined);
    }

    private report(
        node: ASTNode,
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
        this.checkDeclaredContent();
        if (!this.schema || this.schema.record_body) {
            return;
        }
        for (const record of this.input.ast.children ?? []) {
            if (
                record.type === NodeType.COMMENT ||
                !record.key ||
                !record.children ||
                record.keyPrefix !== undefined ||
                isSkippedKey(record)
            ) {
                continue;
            }
            this.checkRecord(record, this.schema);
        }
    }

    private checkRecord(record: ASTNode, schema: SchemaEntry): void {
        const children = record.children ?? [];
        const what = `${schema.content_type} '${record.key ?? ''}'`;
        // A record whose body is only values is a list (name_equivalency, console_groups).
        const hasStatements = children.some(
            (c) => c.key !== undefined && c.type !== NodeType.VALUE && c.type !== NodeType.COMMENT
        );
        const present = new Set<string>();
        const reportedNext = new Set<ASTNode>();

        children.forEach((child, i) => {
            if (child.type === NodeType.COMMENT) {
                return;
            }
            if (child.type === NodeType.VALUE || !child.key) {
                if (!hasStatements || reportedNext.has(child) || child.type !== NodeType.VALUE) {
                    return;
                }
                // A bare value in a record body: the reader takes it as a key and finds the
                // next token where it expects '='.
                const next = children.slice(i + 1).find((c) => c.type !== NodeType.COMMENT);
                const where = (next ?? child).range;
                const text = next ? String(next.key ?? next.value ?? '') : '}';
                const line = where.start.line + 1;
                this.report(child, where, 'error', 'unexpected_token_X_found_at_X_expected', [
                    text,
                    `${this.input.file}:${line}`,
                ]);
                if (next) {
                    reportedNext.add(next);
                }
                return;
            }
            present.add(child.key);
            if (isSkippedKey(child) || this.isKnownField(schema, child.key)) {
                return;
            }
            this.report(child, child.keyRange ?? child.range, 'warning', 'unknown_X_in_X', [
                `'${child.key}'`,
                what,
            ]);
        });

        for (const [name, field] of Object.entries(schema.fields)) {
            if (field.required && !present.has(name)) {
                this.reportRequired(record, name, field, schema);
            }
        }
    }

    private isKnownField(schema: SchemaEntry, key: string): boolean {
        if (fieldFor(schema.fields, key)) {
            return true;
        }
        if (schema.unconfirmed && Object.prototype.hasOwnProperty.call(schema.unconfirmed, key)) {
            return true;
        }
        return this.modifierFields && this.input.spec.isModifier(key) !== undefined;
    }

    private reportRequired(
        record: ASTNode,
        name: string,
        field: FieldSpec,
        schema: SchemaEntry
    ): void {
        const range = record.keyRange ?? record.range;
        const evidence = field.required_evidence;
        const entry = evidence
            ? this.input.spec.data.errors.find((e) => e.text === evidence)
            : undefined;
        if (entry) {
            this.report(record, range, 'error', entry.id, [record.key ?? '']);
        } else {
            this.report(record, range, 'error', 'PYCH-S002', [
                name,
                schema.content_type,
                record.key ?? '',
            ]);
        }
    }

    /** `namespace = x` declares event content; only events/ loads it. */
    private checkDeclaredContent(): void {
        const { spec, file, ast } = this.input;
        const namespace = (ast.children ?? []).find(
            (n) => n.key === 'namespace' && n.type === NodeType.ASSIGNMENT
        );
        if (!namespace) {
            return;
        }
        const dir = spec.directoryOf(file);
        if (dir && dir.content_type === 'event') {
            return;
        }
        const where = dir ? dir.path : file.split('/').slice(0, -1).join('/') || '.';
        const loads = dir ? dir.content_type : 'no script';
        this.report(namespace, namespace.keyRange ?? namespace.range, 'warning', 'PYCH-S003', [
            file,
            'event',
            where,
            loads,
        ]);
    }
}

/** Run the schema checks on one parsed file. */
export function checkSchema(input: CheckInput): Diagnostic[] {
    const dir = input.spec.directoryOf(input.file);
    const schema = dir ? input.spec.schemaOf(dir) : undefined;
    const checker = new SchemaChecker(input, schema);
    checker.run();
    return checker.diagnostics;
}
