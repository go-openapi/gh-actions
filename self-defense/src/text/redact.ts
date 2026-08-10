// SPDX-License-Identifier: Apache-2.0

/**
 * Redaction — the gate between user-supplied text and anything durable.
 *
 * Nothing writes raw issue or PR text to disk, to a corpus record, or to a log.
 * A public repository accumulating verbatim spam bodies would republish the
 * payload and hand it search-engine indexing; SEO link injection is a large
 * share of what we are defending against, and storing it verbatim would make
 * this repository part of the attack.
 *
 * Redaction preserves everything the lexical model needs — structure, phrasing,
 * boilerplate, placeholder density — and destroys the parts that carry value to
 * the spammer: the URLs, the contact addresses, the reply targets.
 *
 * See DESIGN.md §3.1 for the substitution table.
 */

import { createHash } from 'node:crypto';
import type { RedactedText } from '../types/index.js';

/** Placeholder tokens. Chosen to survive tokenisation as single units. */
export const PLACEHOLDER = {
  url: '«url»',
  email: '«email»',
  user: '«user»',
  ref: '«ref»',
  num: '«num»',
  code: (lang: string) => (lang ? `«code:${lang}»` : '«code»'),
} as const;

// Every pattern is suffixed `_RE`. This is not decoration: naming one of these
// `URL` shadows the global `URL` class inside this module, so `new URL(...)` in
// `hostOf` throws, the catch swallows it, and every hostname is silently
// dropped from `hosts[]` — signal loss with no error anywhere.

/** Fenced code blocks. Captured first so their contents never reach later passes. */
const FENCED_CODE_RE = /```([A-Za-z0-9_+-]*)\r?\n[\s\S]*?```/g;
/** Indented code blocks are left alone: too easily confused with quoted prose. */
const INLINE_CODE_RE = /`[^`\n]+`/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()[\]{}"'`]+/gi;
/** Bare `host.tld/path` without a scheme — common in link spam avoiding filters. */
const SCHEMELESS_URL_RE = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}\/[^\s<>()[\]{}"'`]*/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,24})\b/g;
const MENTION_RE = /(^|[^\w/])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\b/g;
/** Issue/PR references and commit-sha-looking hex runs. */
const ISSUE_REF_RE = /(^|\s)#\d+\b/g;
const SHA_RE = /\b[0-9a-f]{7,40}\b/gi;
const DIGIT_RUN_RE = /\b\d{4,}\b/g;

/**
 * Extract the registrable-ish hostname from a URL match.
 * Deliberately not a public-suffix implementation: we want a stable grouping
 * key for host reputation, not DNS-accurate ownership.
 */
function hostOf(raw: string): string | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const h = new URL(withScheme).hostname.toLowerCase();
    return h.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/**
 * Redact `text`, returning the storable form plus the extracted side-channels.
 *
 * `hosts` is kept on purpose: a bare hostname in a JSONL file is not a backlink,
 * and host reputation across the org-wide corpus is one of the strongest
 * signals available to us.
 *
 * Order matters. Code blocks are removed before URL matching so that a URL
 * inside a fenced example does not count as link spam, and emails are matched
 * before mentions so that `foo@bar.com` does not leave a stray `@bar`.
 */
export function redact(text: string): RedactedText {
  const sha256 = createHash('sha256').update(text, 'utf8').digest('hex');

  const hosts = new Set<string>();
  const emailDomains = new Set<string>();
  const codeLangs: string[] = [];
  const placeholders: Record<string, number> = Object.create(null);

  const bump = (key: string) => {
    placeholders[key] = (placeholders[key] ?? 0) + 1;
  };

  let out = text;

  out = out.replace(FENCED_CODE_RE, (_m, lang: string) => {
    const l = (lang || '').toLowerCase();
    codeLangs.push(l);
    bump('code');
    return PLACEHOLDER.code(l);
  });

  out = out.replace(INLINE_CODE_RE, () => {
    bump('code');
    return PLACEHOLDER.code('');
  });

  const takeUrl = (m: string): string => {
    const h = hostOf(m);
    if (h) hosts.add(h);
    bump('url');
    return PLACEHOLDER.url;
  };
  out = out.replace(URL_RE, takeUrl);
  out = out.replace(SCHEMELESS_URL_RE, takeUrl);

  out = out.replace(EMAIL_RE, (_m, domain: string) => {
    emailDomains.add(domain.toLowerCase());
    bump('email');
    return PLACEHOLDER.email;
  });

  out = out.replace(MENTION_RE, (_m, lead: string) => {
    bump('user');
    return `${lead}${PLACEHOLDER.user}`;
  });

  out = out.replace(ISSUE_REF_RE, (_m, lead: string) => {
    bump('ref');
    return `${lead}${PLACEHOLDER.ref}`;
  });
  out = out.replace(SHA_RE, () => {
    bump('ref');
    return PLACEHOLDER.ref;
  });
  out = out.replace(DIGIT_RUN_RE, () => {
    bump('num');
    return PLACEHOLDER.num;
  });

  return {
    redacted: out.trim(),
    sha256,
    hosts: [...hosts].sort(),
    emailDomains: [...emailDomains].sort(),
    codeLangs,
    placeholders,
  };
}

/**
 * Assert that a string carries no un-redacted payload. Call before any write
 * that leaves the process. Cheap enough to leave enabled in production.
 *
 * @throws if the string still contains a URL or an email address.
 */
export function assertRedacted(s: string): void {
  URL_RE.lastIndex = 0;
  EMAIL_RE.lastIndex = 0;
  if (URL_RE.test(s) || EMAIL_RE.test(s)) {
    throw new Error('refusing to persist un-redacted text');
  }
}
