/**
 * The language server lends its base game (docs/shared-index.md): once the base game is open,
 * the agent servers and the command line of the same spec package ask the language server
 * instead of loading their own copy. The language server answers each request with the asking
 * program's own code (the command line's `serveCliSteps`, the agent server's `McpHost`), over a
 * fork of its base game, a slice at a time so that the editor is answered between slices.
 */

import { serveCliSteps } from '@pychivalry/cli';
import {
    BaseRefused,
    drainInSlices,
    IndexHost,
    sharingOff,
    type HostRequest,
    type HostStatus,
    type Place,
    type SharedBase,
    type Spec,
} from '@pychivalry/core';
import { McpHost } from '@pychivalry/mcp/hosting';

/** The request that says what the language server lends: `SharingStatus`. */
export const SHARING_REQUEST = 'pychivalry/sharing';

/** What the language server lends, and what it answered since it began lending. */
export interface SharingStatus extends HostStatus {
    /** The agent servers' sessions it keeps. */
    readonly sessions: number;
}

const NOT_LENDING: SharingStatus = {
    lending: false,
    answered: {},
    refused: 0,
    failed: 0,
    sessions: 0,
};

/** How long a slice of work done for another program runs before the editor's turn. */
const SLICE_MS = 10;

export class Lender {
    private host: IndexHost | null = null;
    private mcp: McpHost | null = null;
    private turn = 0;

    constructor(
        private readonly place: Place,
        private readonly log: (text: string) => void,
        /** How often to look at the address file; `CLAIM_MS` by default (tests give less). */
        private readonly claimMs?: number,
    ) {}

    /**
     * Lend `base`, read with `spec`, in place of the base game lent before; with null, lend
     * nothing. Resolves once the address is held, or found held by another program.
     */
    async lend(spec: Spec, base: SharedBase | null, cacheDir: string | null): Promise<void> {
        const turn = ++this.turn;
        await this.drop();
        if (base === null || sharingOff(this.place.env) || turn !== this.turn) {
            return;
        }
        const mcp = new McpHost({ spec, base, cacheDir });
        const handle = async (request: HostRequest): Promise<unknown> => {
            if (request.kind === 'cli') {
                return drainInSlices(serveCliSteps(request, { spec, base }), SLICE_MS);
            }
            if (request.kind === 'mcp') {
                return drainInSlices(mcp.serveSteps(request), SLICE_MS);
            }
            throw new BaseRefused(`no request of the kind ${request.kind}`);
        };
        const host = await IndexHost.start({
            ...this.place,
            specSha256: spec.sha256,
            handle,
            log: this.log,
            claimMs: this.claimMs,
        });
        if (turn !== this.turn) {
            await host.stop();
            return;
        }
        this.host = host;
        this.mcp = mcp;
    }

    status(): SharingStatus {
        const host = this.host;
        return host === null ? NOT_LENDING : { ...host.status(), sessions: this.mcp?.size ?? 0 };
    }

    /**
     * Stop lending, and any lending still starting; the address file goes at once if it is
     * still this program's.
     */
    async stop(): Promise<void> {
        this.turn++;
        await this.drop();
    }

    private async drop(): Promise<void> {
        const host = this.host;
        this.host = null;
        this.mcp = null;
        await host?.stop();
    }
}
