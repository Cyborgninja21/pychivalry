/**
 * Completion (docs/PLAN.md item 7.5): the core's answer of what may be written at a place
 * (`completionsAt`) as a protocol completion list. Each item replaces the word already written
 * at the place; its detail says where it comes from, its documentation is the package's
 * description. A list the core cut to its limit is marked incomplete, so the editor asks again
 * as the word grows.
 */

import { completionsAt, type CompletionCandidate, type CompletionInput } from '@pychivalry/core';
import {
    CompletionItemKind,
    type CompletionItem,
    type CompletionList,
} from 'vscode-languageserver/node';

const KIND: Readonly<Record<CompletionCandidate['kind'], CompletionItemKind>> = {
    trigger: CompletionItemKind.Function,
    effect: CompletionItemKind.Method,
    link: CompletionItemKind.Reference,
    iterator: CompletionItemKind.Keyword,
    'modifier-type': CompletionItemKind.Property,
    structural: CompletionItemKind.Keyword,
    'value-key': CompletionItemKind.Operator,
    field: CompletionItemKind.Field,
    defined: CompletionItemKind.Variable,
    value: CompletionItemKind.Value,
};

/** What may be written at a place of a script file, as a completion list. */
export function completionList(input: CompletionInput): CompletionList {
    const answer = completionsAt(input);
    const lines = input.parsed.lines;
    const range = lines.rangeOf(answer.word.start, answer.word.end);
    const items = answer.candidates.map((c): CompletionItem => ({
        label: c.name,
        kind: KIND[c.kind],
        detail: c.detail,
        ...(c.description === null ? {} : { documentation: c.description }),
        textEdit: { range, newText: c.name },
    }));
    return { isIncomplete: !answer.complete, items };
}
