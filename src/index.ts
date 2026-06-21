/**
 * jsonpluck — pluck valid JSON out of messy LLM output, with zero dependencies.
 *
 * @packageDocumentation
 */

import { extractCandidate } from "./extract.js";
import { parseTolerant } from "./parser.js";

export { extractCandidate } from "./extract.js";
export { parseTolerant, type ParseOutcome } from "./parser.js";

/** Options for {@link pluck} and {@link tryPluck}. */
export interface PluckOptions {
  /**
   * If `true`, accept the recovered value even when the input was truncated
   * (cut off mid-structure). Default `true` — partial objects are usually more
   * useful than an error.
   */
  allowTruncated?: boolean;
}

/** A successful {@link tryPluck} result. */
export interface PluckOk<T> {
  ok: true;
  /** The parsed value. */
  value: T;
  /** `true` if the input was already strictly valid JSON. */
  strict: boolean;
  /** `true` if the input ended before the value was complete. */
  truncated: boolean;
}

/** A failed {@link tryPluck} result. */
export interface PluckErr {
  ok: false;
  /** Why extraction/parsing failed. */
  error: string;
}

/** The result of {@link tryPluck}. */
export type PluckResult<T> = PluckOk<T> | PluckErr;

/**
 * Extract and parse JSON from arbitrary text — fast path first.
 *
 * Tries `JSON.parse` directly; if that fails, strips Markdown fences / prose,
 * locates the JSON region, and runs the tolerant parser. Never throws.
 *
 * @example
 * ```ts
 * tryPluck('Sure! ```json\n{"ok": true,}\n``` hope that helps');
 * // → { ok: true, value: { ok: true }, strict: false, truncated: false }
 * ```
 */
export function tryPluck<T = unknown>(text: string, options: PluckOptions = {}): PluckResult<T> {
  if (typeof text !== "string") {
    return { ok: false, error: "input is not a string" };
  }

  // Fast path: already-valid JSON.
  const trimmed = text.trim();
  if (trimmed) {
    try {
      return { ok: true, value: JSON.parse(trimmed) as T, strict: true, truncated: false };
    } catch {
      /* fall through to tolerant parsing */
    }
  }

  const candidate = extractCandidate(text);
  if (candidate === null) {
    return { ok: false, error: "no JSON object or array found in input" };
  }

  const outcome = parseTolerant(candidate);
  if (outcome.truncated && options.allowTruncated === false) {
    return { ok: false, error: "input appears to be truncated" };
  }

  return {
    ok: true,
    value: outcome.value as T,
    strict: outcome.strict,
    truncated: outcome.truncated,
  };
}

/**
 * Extract and parse JSON from arbitrary text, throwing on failure.
 *
 * @throws {Error} if no JSON can be recovered (or it is truncated and
 *   `allowTruncated` is `false`).
 * @example
 * ```ts
 * const data = pluck<{ title: string }>(llmResponse);
 * ```
 */
export function pluck<T = unknown>(text: string, options: PluckOptions = {}): T {
  const result = tryPluck<T>(text, options);
  if (!result.ok) throw new Error(`jsonpluck: ${result.error}`);
  return result.value;
}

/**
 * Repair messy JSON and return it as a canonical JSON string.
 *
 * @param text - The messy input.
 * @param indent - Passed to `JSON.stringify` (e.g. `2` for pretty output).
 * @throws {Error} if no JSON can be recovered.
 */
export function repair(text: string, indent?: number): string {
  return JSON.stringify(pluck(text), null, indent);
}
