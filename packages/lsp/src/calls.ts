/**
 * The call hierarchy (docs/PLAN.md items 10.7 and 12.2): what calls a definition and what it
 * calls, from the core's call graph (`CallGraph`, docs/call-graph.md), the same links the command
 * line's `calls` and the agent server's `call_graph` give.
 *
 * - **Prepare** names the definitions at the cursor: the one whose key the cursor is on, or every
 *   definition of script of the name written there (the mod's first), each an item that carries its
 *   name, database and place.
 * - **Incoming calls** of an item: the links that name it in its database, grouped by the
 *   definition they are written in, each with the places they are written at in it.
 * - **Outgoing calls** of an item: the links written inside that one definition, grouped by the
 *   definition they name (its first definition, the mod's first), each with the places in the
 *   item's own file. A callee nothing defines has no file to open and is left out.
 */

import type { CallDefinition, CallGraph, CallLink, Position } from '@pychivalry/core';
import {
    SymbolKind,
    type CallHierarchyIncomingCall,
    type CallHierarchyItem,
    type CallHierarchyOutgoingCall,
    type Location,
    type Range,
} from 'vscode-languageserver/node';

/** What an item carries to the requests that follow it: the definition it is. */
export interface CallItemData {
    readonly name: string;
    readonly database: string;
    readonly layer: string;
    readonly file: string;
    readonly start: number;
}

/** What the call hierarchy reads beside the graph: where a place of a layer is. */
export interface CallHierarchyContext {
    readonly graph: CallGraph;
    location(item: {
        readonly layer: string;
        readonly file: string;
        readonly range: Range;
    }): Location | null;
}

/** A definition as an item, or null when its file has no place an editor can open. */
export function itemOf(
    context: CallHierarchyContext,
    definition: CallDefinition,
): CallHierarchyItem | null {
    const location = context.location(definition);
    if (location === null) {
        return null;
    }
    const data: CallItemData = {
        name: definition.name,
        database: definition.database,
        layer: definition.layer,
        file: definition.file,
        start: definition.start,
    };
    return {
        name: definition.name,
        kind: SymbolKind.Function,
        detail: `${definition.database} · ${definition.layer}`,
        uri: location.uri,
        range: location.range,
        selectionRange: location.range,
        data,
    };
}

function contains(range: Range, position: Position): boolean {
    const after =
        position.line > range.start.line ||
        (position.line === range.start.line && position.character >= range.start.character);
    const before =
        position.line < range.end.line ||
        (position.line === range.end.line && position.character <= range.end.character);
    return after && before;
}

/**
 * The items at a place: the definition whose key holds the position in the file at `here`, or
 * every definition of script of `name`, the mod's first; null when there is none.
 */
export function prepareItems(
    context: CallHierarchyContext,
    name: string,
    here: { readonly layer: string; readonly file: string; readonly position: Position } | null,
): CallHierarchyItem[] | null {
    const definitions = context.graph.definitionsOf(name);
    const own =
        here === null
            ? undefined
            : definitions.find(
                  (d) =>
                      d.layer === here.layer &&
                      d.file === here.file &&
                      contains(d.range, here.position),
              );
    const items = (own === undefined ? definitions : [own])
        .map((d) => itemOf(context, d))
        .filter((i): i is CallHierarchyItem => i !== null);
    return items.length === 0 ? null : items;
}

function dataOf(item: CallHierarchyItem): CallItemData | null {
    const data = item.data as Partial<CallItemData> | undefined;
    return typeof data?.name === 'string' &&
        typeof data.database === 'string' &&
        typeof data.layer === 'string' &&
        typeof data.file === 'string' &&
        typeof data.start === 'number'
        ? (data as CallItemData)
        : null;
}

/** Links grouped by a key, in the order of the first of each. */
function groups(links: readonly CallLink[], key: (l: CallLink) => string): CallLink[][] {
    const out = new Map<string, CallLink[]>();
    for (const l of links) {
        const k = key(l);
        out.set(k, [...(out.get(k) ?? []), l]);
    }
    return [...out.values()];
}

/** What calls the item's definition: by caller, with the places in the caller's file. */
export function incomingCalls(
    context: CallHierarchyContext,
    item: CallHierarchyItem,
): CallHierarchyIncomingCall[] {
    const data = dataOf(item);
    if (data === null) {
        return [];
    }
    const links = context.graph.callers(data.name).filter((l) => l.to.database === data.database);
    const out: CallHierarchyIncomingCall[] = [];
    for (const group of groups(
        links,
        (l) => `${l.from.layer}\u0000${l.from.file}\u0000${String(l.from.start)}`,
    )) {
        const [first] = group;
        const from = first === undefined ? null : itemOf(context, first.from);
        if (from !== null) {
            out.push({ from, fromRanges: group.map((l) => l.at.range) });
        }
    }
    return out;
}

/** What the item's definition calls: by callee, with the places in the item's own file. */
export function outgoingCalls(
    context: CallHierarchyContext,
    item: CallHierarchyItem,
): CallHierarchyOutgoingCall[] {
    const data = dataOf(item);
    if (data === null) {
        return [];
    }
    const links = context.graph
        .callees(data.name)
        .filter(
            (l) =>
                l.from.database === data.database &&
                l.from.layer === data.layer &&
                l.from.file === data.file &&
                l.from.start === data.start,
        );
    const out: CallHierarchyOutgoingCall[] = [];
    for (const group of groups(links, (l) => `${l.to.database}\u0000${l.to.name}`)) {
        const [first] = group;
        if (first === undefined || !first.to.defined) {
            continue;
        }
        const callee = context.graph
            .definitionsOf(first.to.name)
            .find((d) => d.database === first.to.database);
        const to = callee === undefined ? null : itemOf(context, callee);
        if (to !== null) {
            out.push({ to, fromRanges: group.map((l) => l.at.range) });
        }
    }
    return out;
}
