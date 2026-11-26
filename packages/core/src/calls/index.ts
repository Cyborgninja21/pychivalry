/**
 * The call graph (docs/PLAN.md item 10.6): which definitions call which, read from the spec
 * package and the workspace index (`links.ts`, `graph.ts`; docs/call-graph.md).
 */

export {
    callLinksOf,
    callRows,
    firedDatabases,
    type CallBasis,
    type CallEnd,
    type CallLink,
    type CallPlace,
    type CallRows,
    type LinksInput,
} from './links.js';
export {
    CallGraph,
    comparePlaces,
    linkKind,
    type CallAnswer,
    type CallDefinition,
    type CallGraphOptions,
} from './graph.js';
