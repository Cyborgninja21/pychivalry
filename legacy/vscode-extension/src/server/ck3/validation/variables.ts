/**
 * Variables (engine plug-in): variables read but set nowhere, set but read nowhere, read in
 * another namespace than they are set in, and used both as a list and as a value.
 *
 * Which keywords set and which read a variable comes from the spec package (the effects and
 * triggers whose names contain `variable`), plus the `var:`, `local_var:` and `global_var:`
 * references. Ordinary, global and dead-character variables persist, so they are judged
 * across the workspace index and the base game's indexed directories (the engine Indexer's
 * variable uses), not one file: CK3701 and CK3702 report only while the base game is loaded
 * (without it a variable the base game sets or reads is unknown). Local variables live for one
 * effect execution and are judged in their file.
 *
 * None of these has engine evidence (a variable can also be set by the base game's events,
 * which are not indexed, by GUI or by localization), so all are conventions:
 *     CK3701 (information) a variable read but set nowhere in the workspace or the base game
 *     CK3702 (hint)        a variable set but read nowhere in script
 *     CK3703 (information) a variable read in one namespace (var / local_var / global_var) and
 *                          set only in another
 *     CK3705 (information) a variable used both as a list and as a value in the file
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode, Indexer, Spec, variableUsesOf } from 'pychivalry-engine';

type Kind = 'var' | 'local' | 'global' | 'dead';

export interface VariablesConfig {
    enabled: boolean;
    checkUnused: boolean;
    checkUndeclared: boolean;
    checkScope: boolean;
    checkTypes: boolean;
}

/** What the plug-in knows beyond the file. */
export interface VariableKnowledge {
    spec: Spec;
    /** The workspace index and, when loaded, the base game's. */
    indexes: Indexer[];
    /** Is a base game loaded (CK3701/CK3702 need it)? */
    baseGameKnown: boolean;
}

const PREFIX_KIND: Record<string, Kind> = {
    'var:': 'var',
    'local_var:': 'local',
    'global_var:': 'global',
};

function kindOfKey(key: string): Kind {
    if (key.includes('global_variable')) {
        return 'global';
    }
    if (key.includes('local_variable')) {
        return 'local';
    }
    if (key.includes('dead_character_variable')) {
        return 'dead';
    }
    return 'var';
}

interface Classified {
    setters: Map<Kind, string[]>;
    listSetters: Set<string>;
    valueSetters: Set<string>;
    readers: Map<Kind, string[]>;
}

const classifiedBySpec = new WeakMap<Spec, Classified>();

/** The variable keywords of the spec package, by role and namespace. */
function classify(spec: Spec): Classified {
    const cached = classifiedBySpec.get(spec);
    if (cached) {
        return cached;
    }
    const c: Classified = {
        setters: new Map(),
        listSetters: new Set(),
        valueSetters: new Set(),
        readers: new Map(),
    };
    for (const name of spec.names('effects')) {
        if (!name.includes('variable') || /^(remove|clear)_/.test(name)) {
            continue;
        }
        const kind = kindOfKey(name);
        c.setters.set(kind, [...(c.setters.get(kind) ?? []), name]);
        (name.includes('_list') ? c.listSetters : c.valueSetters).add(name);
    }
    for (const name of spec.names('triggers')) {
        if (!name.includes('variable') || name.includes('income')) {
            continue;
        }
        const kind = kindOfKey(name);
        c.readers.set(kind, [...(c.readers.get(kind) ?? []), name]);
    }
    classifiedBySpec.set(spec, c);
    return c;
}

interface Use {
    kind: Kind;
    name: string;
    node: ASTNode;
}

/** Variable reads and sets of the file, with their nodes. */
function fileUses(ast: ASTNode, c: Classified): { reads: Use[]; sets: Use[] } {
    const reads: Use[] = [];
    const sets: Use[] = [];
    const visit = (node: ASTNode): void => {
        if (node.key && node.key.includes('variable')) {
            const name =
                typeof node.value === 'string'
                    ? node.value
                    : (node.children ?? []).find((ch) => ch.key === 'name')?.value;
            if (typeof name === 'string' && /^[A-Za-z0-9_]+$/.test(name)) {
                const kind = kindOfKey(node.key);
                if ((c.setters.get(kind) ?? []).includes(node.key)) {
                    sets.push({ kind, name, node });
                } else if ((c.readers.get(kind) ?? []).includes(node.key)) {
                    reads.push({ kind, name, node });
                }
            }
        }
        for (const text of [node.key, typeof node.value === 'string' ? node.value : undefined]) {
            if (text && text.includes('var:')) {
                for (const m of text.matchAll(
                    /(?:^|[.\s=<>!])((?:local_|global_)?var:)([A-Za-z0-9_$]+)/g
                )) {
                    // A name built from a parameter (`var:offer_$DEITY$`) is not one variable.
                    if (!m[2].includes('$')) {
                        reads.push({ kind: PREFIX_KIND[m[1]], name: m[2], node });
                    }
                }
            }
        }
        for (const child of node.children ?? []) {
            visit(child);
        }
    };
    visit(ast);
    return { reads, sets };
}

/** Is the variable set (kind, name) in the file or one of the indexes? */
function isSet(
    kind: Kind,
    name: string,
    c: Classified,
    local: Set<string>,
    k: VariableKnowledge
): boolean {
    if (local.has(`${kind}|${name}`)) {
        return true;
    }
    return (c.setters.get(kind) ?? []).some((key) =>
        k.indexes.some((index) => index.hasVariableUse(`${key}|${name}`))
    );
}

/** Is the variable read (kind, name) in one of the indexes (`variable = x` counts for any)? */
function isReadAnywhere(kind: Kind, name: string, c: Classified, k: VariableKnowledge): boolean {
    const prefix = Object.entries(PREFIX_KIND).find(([, v]) => v === kind)?.[0];
    const uses = [
        ...(c.readers.get(kind) ?? []).map((key) => `${key}|${name}`),
        `variable|${name}`,
        ...(prefix ? [`${prefix}|${name}`] : []),
    ];
    return uses.some((use) => k.indexes.some((index) => index.hasVariableUse(use)));
}

export function validateVariables(
    node: ASTNode,
    config: VariablesConfig,
    knowledge: VariableKnowledge
): Diagnostic[] {
    if (!config.enabled) {
        return [];
    }
    const c = classify(knowledge.spec);
    const { reads, sets } = fileUses(node, c);
    const setHere = new Set(sets.map((s) => `${s.kind}|${s.name}`));
    const readHere = new Set(reads.map((r) => `${r.kind}|${r.name}`));
    const out: Diagnostic[] = [];
    const reported = new Set<string>();
    const kinds: Kind[] = ['var', 'local', 'global', 'dead'];

    for (const read of reads) {
        const id = `${read.kind}|${read.name}`;
        if (reported.has(id)) {
            continue;
        }
        const crossFile = read.kind !== 'local';
        if (crossFile && !knowledge.baseGameKnown) {
            continue;
        }
        const setSameKind = crossFile
            ? isSet(read.kind, read.name, c, setHere, knowledge)
            : setHere.has(id);
        if (setSameKind) {
            continue;
        }
        reported.add(id);
        const otherKind = kinds.find(
            (k) =>
                k !== read.kind &&
                (setHere.has(`${k}|${read.name}`) ||
                    (knowledge.baseGameKnown && isSet(k, read.name, c, setHere, knowledge)))
        );
        if (otherKind && config.checkScope) {
            out.push({
                severity: DiagnosticSeverity.Information,
                range: read.node.range,
                message: `Convention: variable '${read.name}' is read as a ${read.kind} variable but set only as a ${otherKind} variable (a different variable)`,
                code: 'CK3703',
                source: 'ck3-lsp',
            });
        } else if (!otherKind && config.checkUndeclared) {
            out.push({
                severity: DiagnosticSeverity.Information,
                range: read.node.range,
                message: crossFile
                    ? `Convention: variable '${read.name}' is read but set nowhere in the workspace or the base game's indexed script`
                    : `Convention: local variable '${read.name}' is read but not set in this file`,
                code: 'CK3701',
                source: 'ck3-lsp',
            });
        }
    }

    if (config.checkUnused) {
        for (const set of sets) {
            const id = `${set.kind}|${set.name}`;
            if (reported.has(id) || readHere.has(id)) {
                continue;
            }
            const crossFile = set.kind !== 'local';
            if (
                crossFile &&
                (!knowledge.baseGameKnown || isReadAnywhere(set.kind, set.name, c, knowledge))
            ) {
                continue;
            }
            reported.add(id);
            out.push({
                severity: DiagnosticSeverity.Hint,
                range: set.node.range,
                message: crossFile
                    ? `Convention: variable '${set.name}' is set but read nowhere in the workspace's or the base game's script`
                    : `Convention: local variable '${set.name}' is set but not read in this file`,
                code: 'CK3702',
                source: 'ck3-lsp',
            });
        }
    }

    if (config.checkTypes) {
        const asList = new Set(
            sets.filter((s) => c.listSetters.has(s.node.key!)).map((s) => s.name)
        );
        for (const set of sets) {
            if (
                c.valueSetters.has(set.node.key!) &&
                asList.has(set.name) &&
                !reported.has(`list|${set.name}`)
            ) {
                reported.add(`list|${set.name}`);
                out.push({
                    severity: DiagnosticSeverity.Information,
                    range: set.node.range,
                    message: `Convention: variable '${set.name}' is used both as a list and as a value in this file`,
                    code: 'CK3705',
                    source: 'ck3-lsp',
                });
            }
        }
    }
    return out;
}

/** The variable uses of a file as the engine Indexer records them (for tests). */
export { variableUsesOf };

/** Variable names hold only letters, digits and underscores, and do not start with a digit. */
export function isValidVariableName(name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}
