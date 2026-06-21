/**
 * Locate the JSON region inside a larger blob of text (typically an LLM
 * response wrapped in prose and/or Markdown code fences).
 */

/**
 * Extract the most likely JSON candidate substring from `text`.
 *
 * Resolution order:
 *  1. A fenced code block — ` ```json … ``` ` is preferred, then any ` ``` … ``` `.
 *  2. The first balanced `{…}` or `[…]` region (quotes/escapes respected). If
 *     the region never closes (truncated output), everything from the first
 *     opener to the end is returned.
 *  3. The original text, trimmed, as a last resort.
 *
 * @returns The candidate substring, or `null` if no JSON-ish content is found.
 */
export function extractCandidate(text: string): string | null {
  if (!text) return null;

  const fenced = extractFenced(text);
  const source = fenced ?? text;

  const region = extractBalanced(source);
  if (region !== null) return region;

  if (fenced !== null) return fenced.trim();
  return null;
}

/** Pull the content of the first relevant Markdown code fence. @internal */
function extractFenced(text: string): string | null {
  // ```json ... ```  (or ```json5, ```jsonc) preferred.
  const labelled = /```(?:json5?|jsonc)?[ \t]*\r?\n([\s\S]*?)```/i.exec(text);
  if (labelled?.[1] !== undefined) return labelled[1];

  // Any fence.
  const any = /```[ \t]*\r?\n?([\s\S]*?)```/.exec(text);
  if (any?.[1] !== undefined) return any[1];

  return null;
}

/**
 * Return the first balanced `{…}` or `[…]` region, honouring strings and
 * escapes. Falls back to opener-through-end when the structure is truncated.
 * @internal
 */
function extractBalanced(text: string): string | null {
  let start = -1;
  let opener = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "{" || ch === "[") {
      start = i;
      opener = ch;
      break;
    }
  }
  if (start === -1) return null;

  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let quote = "";

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (ch === "\\") {
        i++; // skip escaped char
        continue;
      }
      if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  // Never balanced — likely truncated. Return from the opener to the end.
  return text.slice(start);
}
