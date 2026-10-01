/**
 * Presentation of the engine's keyword documentation (Phase 4): hover, completion
 * documentation and signature help all show the spec package's doc string verbatim, per
 * bucket, so a name registered as both a trigger and an effect shows both.
 */

import { Bucket, Spec } from 'pychivalry-engine';

const BUCKET_LABEL: Record<Bucket, string> = {
    triggers: 'trigger',
    effects: 'effect',
    links: 'scope link',
    lists: 'list (iterator base)',
    on_actions: 'on_action',
    modifiers: 'modifier',
};

export function bucketLabel(bucket: Bucket): string {
    return BUCKET_LABEL[bucket];
}

/** A doc string verbatim, fenced so that its own layout survives Markdown rendering. */
function fenced(doc: string): string {
    const fence = doc.includes('```') ? '~~~' : '```';
    return `${fence}text\n${doc}\n${fence}`;
}

/**
 * Markdown for `name` from the spec: its buckets and, for each, the engine doc string
 * verbatim. Undefined when the name is in no bucket.
 */
export function keywordMarkdown(spec: Spec, name: string, only?: Bucket[]): string | undefined {
    const buckets = spec.bucketsOf(name).filter((b) => !only || only.includes(b));
    if (buckets.length === 0) {
        return undefined;
    }
    const parts = [`**${name}** — ${buckets.map((b) => `*${bucketLabel(b)}*`).join(' · ')}`];
    for (const bucket of buckets) {
        const doc = spec.doc(name, bucket);
        if (buckets.length > 1) {
            parts.push(`**As ${bucketLabel(bucket)}**`);
        }
        parts.push(doc ? fenced(doc) : '*(the engine registers this name without a doc string)*');
    }
    parts.push(`*CK3 ${spec.version()} engine documentation*`);
    return parts.join('\n\n');
}

/** Markdown for an iterator (`every_vassal`): the list base's engine doc. */
export function iteratorMarkdown(spec: Spec, name: string): string | undefined {
    const match = spec.isIterator(name);
    if (!match) {
        return undefined;
    }
    const doc = spec.doc(match.base, 'lists');
    const kind = match.prefix === 'any_' ? 'trigger' : 'effect';
    const parts = [
        `**${name}** — *${kind} iterator* over the list \`${match.base}\` (prefix \`${match.prefix}\`)`,
    ];
    if (doc) {
        parts.push(fenced(doc));
    }
    parts.push(`*CK3 ${spec.version()} engine documentation*`);
    return parts.join('\n\n');
}

/** Markdown for a keyword retired from the engine, with its replacement. */
export function retiredMarkdown(spec: Spec, name: string): string | undefined {
    const retired = spec.retired(name);
    if (!retired) {
        return undefined;
    }
    const replacement = retired.replacement;
    const list = Array.isArray(replacement)
        ? replacement.map((r) => `\`${r}\``).join(' or ')
        : replacement
          ? `\`${replacement}\``
          : '';
    const parts = [
        `**${name}** — *${bucketLabel(retired.bucket)}* removed in CK3 ${retired.removed_in}`,
        list ? `Use ${list} instead.` : 'No replacement.',
    ];
    if (retired.note) {
        parts.push(retired.note);
    }
    return parts.join('\n\n');
}

/**
 * Parameter keys of a block-form keyword, read from the usage example in its engine doc
 * (`trigger_event = {\n id = <event ID> ...}`): the `key =` assignments directly inside
 * the first `<name> = {` block of the doc, in order (`days/months/years =` gives all
 * three). Comments, quoted strings, `<placeholders>` and nested blocks are skipped. Empty
 * when the doc shows no block form.
 */
export function docParameters(doc: string | undefined, name: string): string[] {
    if (!doc) {
        return [];
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const head = new RegExp(`(^|[^\\w])${escaped}\\s*=\\s*\\{`).exec(doc);
    if (!head) {
        return [];
    }
    // The body of the first block, nested blocks blanked out.
    let depth = 0;
    let body = '';
    for (let i = doc.indexOf('{', head.index); i < doc.length; i++) {
        const ch = doc[i];
        if (ch === '{') {
            depth++;
            if (depth > 1) {
                continue;
            }
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                break;
            }
            continue;
        } else if (depth === 1) {
            body += ch;
        }
    }
    const cleaned = body
        .replace(/#[^\n]*/g, ' ')
        .replace(/"[^"\n]*"/g, ' ')
        .replace(/<[^>\n]*>/g, ' ');
    const params: string[] = [];
    const assignment = /(?:^|[\s])([A-Za-z_]\w*(?:\/[A-Za-z_]\w*)*)\s*\??=/g;
    let match: RegExpExecArray | null;
    while ((match = assignment.exec(cleaned)) !== null) {
        for (const key of match[1].split('/')) {
            if (!params.includes(key)) {
                params.push(key);
            }
        }
    }
    return params;
}
