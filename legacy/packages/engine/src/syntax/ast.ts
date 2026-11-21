/**
 * AST of CK3 script, compatible with the extension's `core/parser.ts` consumers.
 *
 * The node shape (`type`, `range`, `children`, `key`, `value`, `operator`, `raw`) and the
 * position model (0-based line and UTF-16 character, block ranges ending at the start of
 * the closing brace) are unchanged. The fields below `operator` are additions; see
 * README.md "Porting notes".
 */

export enum NodeType {
    ROOT = 'ROOT',
    ASSIGNMENT = 'ASSIGNMENT',
    BLOCK = 'BLOCK',
    /** A value list: a block whose items are all bare values (`{ a b c }`, `rgb { 1 2 3 }`). */
    LIST = 'LIST',
    VALUE = 'VALUE',
    COMPARISON = 'COMPARISON',
    COMMENT = 'COMMENT',
}

export interface Position {
    line: number;
    character: number;
}

export interface Range {
    start: Position;
    end: Position;
}

/** How a key or value was written. */
export type TokenKind =
    | 'identifier'
    | 'chain'
    | 'number'
    | 'date'
    | 'string'
    | 'bool'
    | 'constant'
    | 'expression'
    | 'color'
    | 'list';

/** Head kinds of a scope chain (`scope:x.liege` → 'scope'). */
export type ChainKind =
    | 'scope'
    | 'var'
    | 'local_var'
    | 'global_var'
    | 'flag'
    | 'value'
    | 'event_target'
    | 'link'
    | 'plain';

/**
 * `scope:x.liege` → { kind: 'scope', head: 'scope:x', name: 'x', segments: ['scope:x', 'liege'] }
 * `root.primary_title.holder` → { kind: 'plain', head: 'root', segments: [...] }
 * `title:k_france` → { kind: 'link', head: 'title:k_france', name: 'k_france', prefix: 'title' }
 */
export interface ScopeChain {
    kind: ChainKind;
    head: string;
    /** The part after ':' in the head, when the head has one. */
    name?: string;
    /** The part before ':' in the head, when the head has one. */
    prefix?: string;
    segments: string[];
}

export type Expr =
    | { type: 'number'; value: number }
    | { type: 'identifier'; name: string }
    | { type: 'unary'; op: '-'; operand: Expr }
    | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: Expr; right: Expr };

export interface ASTNode {
    type: NodeType;
    range: Range;
    raw?: string;
    children?: ASTNode[];
    key?: string;
    value?: string | number | boolean;
    operator?: string;
    /** How the key was written (absent on keyless nodes). */
    keyKind?: TokenKind;
    /** Range of the key token alone. */
    keyRange?: Range;
    /** How the value was written (scalar values and value lists only). */
    valueKind?: TokenKind;
    /** Range of the value token alone (scalar values). */
    valueRange?: Range;
    /** Set when the key is a scope chain. */
    keyChain?: ScopeChain;
    /** Set when the value is a scope chain. */
    valueChain?: ScopeChain;
    /** `scripted_trigger` / `scripted_effect` for a file-local definition (`key` is its name). */
    keyPrefix?: string;
    /** Parsed `@[ ... ]` expression, when the value (or list item) is one. */
    expression?: Expr;
}

export interface ParseError {
    message: string;
    range: Range;
    severity: 'error' | 'warning';
    /** Catalogue id from the spec package, or a package-local `PYCH-` id. */
    code: string;
}

export interface ParsedDocument {
    ast: ASTNode;
    errors: ParseError[];
    /** True when the text started with a UTF-8 byte-order mark (it is skipped). */
    bom?: boolean;
    /** Top-level `@name = value` definitions, by name including the '@'. */
    constants?: Map<string, ASTNode>;
}
