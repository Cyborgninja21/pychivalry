/**
 * Traits (engine plug-in): CK3800, a trait name defined neither in the workspace's nor in the
 * base game's common/traits.
 *
 * Evidence: the game logs an unknown trait (catalogue `unknown_trait_X_in_event_at_X`,
 * "Unknown trait {}, in event at {}", and `invalid_trait_name`), so the code is a warning.
 * The known set is the base game's trait database (trait keys and their `group` names) plus
 * the workspace's own traits and the discovered mods' traits; without the base game's trait
 * database the check does not run (the extracted data/traits alone is not complete enough to
 * prove a name missing). Only the keywords whose value is a trait are read: add_trait,
 * remove_trait, has_trait and the `trait = x` field of history/characters and of
 * create_character; `trait = x` elsewhere names other things (culture traditions in
 * `dlc_tradition`, UI markers on event options …). CK3801-CK3804 were documented but never
 * emitted.
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { ASTNode } from 'pychivalry-engine';

export interface TraitsConfig {
    enabled: boolean;
    checkExistence: boolean;
    checkCompatibility: boolean;
    checkOpposites: boolean;
    /** Known traits; undefined (the base game's traits are unknown): nothing is reported. */
    knownTraits?: ReadonlySet<string>;
    /** Mod-relative path of the file (history/characters reads `trait = x`). */
    file?: string;
    /** Is the value a scope reference (a spec link such as `liege`)? Not a trait then. */
    isScopeLink?: (name: string) => boolean;
}

/** The scope references that are not links (as the engine's scope check reads them). */
const SCOPE_HEADS = new Set(['root', 'this', 'prev']);

const TRAIT_KEYWORDS = new Set(['add_trait', 'remove_trait', 'has_trait']);

/** Trait references: nodes whose value names a trait. */
function collectTraitReferences(node: ASTNode, file: string): ASTNode[] {
    const refs: ASTNode[] = [];
    const characterHistory = /^history\/characters\//i.test(file.replace(/\\/g, '/'));
    const visit = (n: ASTNode, parentKey: string | undefined, depth: number): void => {
        if (n.key && TRAIT_KEYWORDS.has(n.key)) {
            refs.push(n);
        } else if (
            n.key === 'trait' &&
            (parentKey === 'create_character' || (characterHistory && depth <= 3))
        ) {
            refs.push(n);
        }
        for (const child of n.children ?? []) {
            visit(child, n.key, depth + 1);
        }
    };
    visit(node, undefined, 0);
    return refs;
}

export function validateTraits(node: ASTNode, config: TraitsConfig): Diagnostic[] {
    if (!config.enabled || !config.checkExistence || !config.knownTraits) {
        return [];
    }
    const known = config.knownTraits;
    const out: Diagnostic[] = [];
    for (const ref of collectTraitReferences(node, config.file ?? '')) {
        if (typeof ref.value !== 'string') {
            continue;
        }
        const name = ref.value;
        // Saved scopes, parameters and other non-names are not trait keys.
        if (
            !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ||
            known.has(name) ||
            SCOPE_HEADS.has(name.toLowerCase()) ||
            config.isScopeLink?.(name)
        ) {
            continue;
        }
        out.push({
            severity: DiagnosticSeverity.Warning,
            range: ref.range,
            message: `Unknown trait '${name}': defined neither in the workspace's nor in the base game's common/traits`,
            code: 'CK3800',
            source: 'ck3-lsp',
        });
    }
    return out;
}
