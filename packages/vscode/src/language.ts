/**
 * The language server, started by the extension (docs/PLAN.md, item 7.3): the bundled
 * `pychivalry-lsp.mjs`, a Node module run over IPC on VS Code's own runtime by
 * `vscode-languageclient` (`TransportKind.ipc`: the client forks it with `ELECTRON_RUN_AS_NODE`,
 * so the user needs no Node of their own), for the languages `ck3` and `ck3-localization`, with
 * the spec package the extension ships (`--spec`). Every answer is the server's: the extension
 * holds no checking, parsing or lookup logic (docs/MVP.md, "Architecture"). The server reads the
 * settings of the section `pychivalry` itself, through the client (`workspace/configuration`).
 *
 * The extension listens to two of the server's own messages: `pychivalry/backgroundDone`, the
 * end of a background pass, which gives the time to the first full result and the server's peak
 * memory; and it sends `pychivalry/findings`, a file's findings in the core's shape, which the
 * same-answers test compares with the command line's and the agent server's (item 7.9).
 */

import type { WorkspaceFinding } from '@pychivalry/core';
import type { BackgroundDone, FindingsResult } from '@pychivalry/lsp';
import * as vscode from 'vscode';
import {
    LanguageClient,
    TransportKind,
    type LanguageClientOptions,
    type ServerOptions,
} from 'vscode-languageclient/node';
import { BACKGROUND_DONE, FINDINGS_REQUEST, LANGUAGES } from './ids.js';

export type { BackgroundDone, FindingsResult, WorkspaceFinding };

/** The first background pass that left nothing to check, and when it was announced. */
export interface FullResult {
    /** `Date.now()` when the extension received the notice. */
    readonly at: number;
    readonly done: BackgroundDone;
}

/** The running language server, as the extension and its tests see it. */
export interface LanguageServer {
    readonly client: LanguageClient;
    /** Settles when the client has started the server and initialized it. */
    readonly started: Promise<void>;
    /** A file's findings from the server's state (`pychivalry/findings`). */
    readonly findings: (uri: vscode.Uri) => Promise<FindingsResult>;
    /** The first full result: the first background pass that left nothing to check. */
    readonly firstFullResult: Promise<FullResult>;
    /** The next full result after `after` (a `Date.now()`), for a check after a change. */
    readonly nextFullResult: (after: number) => Promise<FullResult>;
}

/** Start the language server bundled at `module`, reading the spec package in `specDir`. */
export function startLanguageServer(
    module: string,
    specDir: string,
    log: vscode.LogOutputChannel,
): LanguageServer {
    const run = { module, transport: TransportKind.ipc, args: ['--spec', specDir] };
    const serverOptions: ServerOptions = { run, debug: run };
    const clientOptions: LanguageClientOptions = {
        documentSelector: LANGUAGES.map((language) => ({ scheme: 'file', language })),
        outputChannel: log,
    };
    const client = new LanguageClient('pychivalry', 'pychivalry', serverOptions, clientOptions);

    const results: FullResult[] = [];
    const waiting: { after: number; resolve: (r: FullResult) => void }[] = [];
    client.onNotification(BACKGROUND_DONE, (done: BackgroundDone) => {
        if (!done.complete) {
            return;
        }
        const result = { at: Date.now(), done };
        results.push(result);
        for (const w of waiting.splice(0)) {
            if (result.at >= w.after) {
                w.resolve(result);
            } else {
                waiting.push(w);
            }
        }
    });
    const nextFullResult = (after: number): Promise<FullResult> => {
        const ready = results.find((r) => r.at >= after);
        return ready !== undefined
            ? Promise.resolve(ready)
            : new Promise((resolve) => waiting.push({ after, resolve }));
    };
    const started = client.start();
    started.then(
        () => {
            log.info(`Language server started: ${module}`);
        },
        (err: unknown) => {
            log.error(`The language server did not start: ${String(err)}`);
        },
    );
    return {
        client,
        started,
        findings: async (uri) => {
            await started;
            return client.sendRequest<FindingsResult>(FINDINGS_REQUEST, { uri: uri.toString() });
        },
        firstFullResult: nextFullResult(0),
        nextFullResult,
    };
}
