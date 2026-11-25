/**
 * The agent server's name and versions. The version is this package's, as in its package.json
 * (a test holds the two equal). The schema version is the version of the tools' shapes: what
 * each takes and returns. A change that breaks a tool gets a new tool name, because the
 * protocol has no other way to version a tool (docs/MVP.md, "Agent server"); the schema version
 * moves with every change to a shape, so a client can tell which shapes it was given.
 */

/** The server, as it names itself to a client. */
export const SERVER_NAME = 'pychivalry';

/** This package's version. */
export const VERSION = '0.0.0';

/**
 * The version of the tools' input and output shapes: 1, the six tools of step 6; 2, `format`
 * (step 8); 3, `apply_format` (item 9.8); 4, `source`, `lookup` answering each name whole (no
 * cursor), and every place saying its layer, a place outside the mod saying `read_with: "source"`
 * (the owner's decision of 2026-11-25).
 */
export const SCHEMA_VERSION = 4;
