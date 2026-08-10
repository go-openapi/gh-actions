// SPDX-License-Identifier: Apache-2.0

/**
 * Content-shape feature extraction, shared by issues and pulls.
 *
 * These operate on redacted text only. Note the absence of fossier's em-dash
 * and emoji penalties: an em-dash is punctuation, and penalising it costs real
 * contributors — anyone writing careful prose, anyone whose keyboard layout
 * produces one, anyone pasting from a word processor. If placeholder or
 * punctuation density genuinely discriminates, the fitted term weights will
 * find it from data without anyone having to assert it.
 */

import type { Evidence, RedactedText } from '../types/index.js';
import type { LoadedKb } from '../storage/kb.js';

export interface ContentFacts {
  readonly titleLength: number;
  readonly bodyLength: number;
  /** Distinct hosts referenced, from the redactor's side-channel. */
  readonly hostCount: number;
  readonly urlCount: number;
  readonly mentionCount: number;
  readonly codeBlockCount: number;
  /** Placeholder tokens as a share of all tokens — a link-spam proxy. */
  readonly placeholderRatio: number;
  /** Share of body that is verbatim-repeated within itself. Stuffing proxy. */
  readonly selfRepetition: number;
  readonly language: string;
}

export declare function extract(title: RedactedText, body: RedactedText): ContentFacts;

export declare function toEvidence(kb: LoadedKb, kind: 'issue' | 'pull', facts: ContentFacts): readonly Evidence[];

/**
 * Language identification on redacted text, for the `lang` corpus field.
 * Used for stratification during training, never as a signal: penalising
 * non-English issues would be both wrong and discriminatory.
 */
export declare function detectLanguage(text: string): string;
