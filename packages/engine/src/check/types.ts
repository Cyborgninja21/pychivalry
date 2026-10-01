/**
 * Shared types of the check layer.
 */

import { Spec } from '../spec/spec';
import { ASTNode, Range } from '../syntax/ast';
import { Workspace } from '../index/workspace';

export type Severity = 'error' | 'warning' | 'information' | 'hint';

export interface Diagnostic {
    /** Mod-relative path with '/' separators. */
    file: string;
    range: Range;
    severity: Severity;
    /** Catalogue id from the spec package, or a package-local `PYCH-` id. */
    code: string;
    message: string;
    source: 'engine' | 'plugin';
}

/** What every check receives. */
export interface CheckInput {
    spec: Spec;
    workspace: Workspace;
    /** Mod-relative path of the file. */
    file: string;
    /** File URI as the index stores it. */
    uri: string;
    ast: ASTNode;
}
