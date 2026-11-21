# The spec package

pychivalry takes its CK3 vocabulary only from the spec package that `pdx-parser-re` derives
from the game (docs/MVP.md, "The spec package"). The built package is committed here with its
checksum and its schema.

| File | What it is |
| --- | --- |
| `ck3-spec-1.20.0.2.json.gz` | The package for game 1.20.0.2, package format 4, gzipped |
| `ck3-spec-1.20.0.2.sha256` | SHA-256 of the **uncompressed** JSON, in `sha256sum` form |
| `schema.json` | The package's own JSON Schema, from `pdx-parser-re` (`spec/package/schema.json`) |

## This package is a stand-in

**The committed package is a stand-in until the 1.21 package in format 5 arrives from step 0**
(docs/PLAN.md, item 1.6). It is the 1.20.0.2 package exactly as release 2.3.0 shipped it
(`legacy/packages/engine/spec/`), byte for byte, so that the check below exists and the 2.3.0
baselines name the spec they ran on. Nothing in the rebuild reads it: the spec reader is
written in item 4.2, against format 5.

When the 1.21 format 5 package arrives, it replaces these three files: the package, its
`.sha256`, and the `schema.json` of format 5. Every record made on the stand-in then fails
`task records:check` and its suite is re-run (records/README.md).

## Compressed or raw: an open decision

Whether the package is committed compressed or raw is **an open decision for the owner**
(docs/PLAN.md, "Decisions the plan will bring to the owner", item 1.6). Release 2.3.0
compressed it because a commit hook refused files over 1 MB; the package is about 7 MB
uncompressed (the 1.20.0.2 package: 7,120,885 bytes raw, 542,820 gzipped). The stand-in is
committed compressed only because that is how 2.3.0 shipped it. Either way the checksum is of
the uncompressed bytes, and the check accepts both forms.

## The check

`task spec:check` (part of `task ci`) fails unless:

- the folder holds exactly one `ck3-spec-<version>.json` or `ck3-spec-<version>.json.gz`;
- `ck3-spec-<version>.sha256` exists and its hash equals the SHA-256 of the uncompressed bytes;
- the package's `package_format` is one this repository supports: 4 (the stand-in) or 5 (the
  format the rebuild's spec reader is written against);
- `schema.json` declares the same `package_format` as the package.
