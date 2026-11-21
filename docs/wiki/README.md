# The repository wiki

The GitHub wiki of this repository is generated from `docs/`. The repository is the one source:
a page is changed by changing its document here and publishing again. A change made on the wiki
itself is overwritten by the next publish.

## What is published

[manifest.json](manifest.json) lists the pages. Each entry gives the wiki page's name and the
document it is made from, and `sidebar` gives the order they are listed in. The wiki's home
page is [Home.md](Home.md) in this folder; every other page is a document that also reads on
its own in the repository.

To publish another document, add it to `pages` and to a `sidebar` section. `task ci` fails when
a published document is missing, is not in the sidebar, or holds a link that points at nothing.

## How a page is built

- A relative link to another published document becomes a link to that wiki page.
- A relative link to anything else in the repository becomes a link to the file on GitHub.
- Links to the web, links within a page, and anything inside code are left as they are.
- Each page starts with a comment naming the document it came from. The sidebar and the footer
  are written from the manifest.

## The tasks

| Task | What it does |
| --- | --- |
| `task wiki:check` | Builds into a throwaway folder and reports any problem. Part of `task ci` |
| `task wiki:build` | Builds into `.wiki-build/`, which is not committed, to look at the result |
| `task wiki:publish` | Publishes to the wiki. This is public the moment it runs |

`task wiki:publish` takes three variables:

| Variable | Meaning |
| --- | --- |
| `WIKI_DRY_RUN=true` | Show what would change and publish nothing |
| `WIKI_PRUNE=all` | Also remove every page this task did not write. Without it, only pages an earlier publish wrote are replaced or removed, and hand-written pages are left alone |
| `WIKI_REMOTE` | Publish to another git repository; the default is this repository's wiki |

It records the files it wrote in `.generated.json` in the wiki, which is how the next publish
knows which pages are its own.

## When to publish

After a merge to `main` that changes a published document. Publishing is done by a person or an
agent on the owner's word; public CI never publishes.
