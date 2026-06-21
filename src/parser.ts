/**
 * A tolerant, single-pass recursive-descent JSON parser.
 *
 * Unlike `JSON.parse`, it accepts the malformed JSON that language models
 * routinely emit and reconstructs a real JavaScript value:
 *
 *  - single-quoted and “smart”-quoted strings
 *  - unquoted object keys
 *  - trailing commas
 *  - `//` line and `/* *\/` block comments
 *  - Python-style literals (`True`, `False`, `None`) and `NaN` / `Infinity`
 *  - **truncated** input (a response cut off mid-object/array/string)
 *
 * The parser never throws on malformed structure; it returns the best value it
 * can recover and reports whether anything was repaired.
 */

/** Outcome of {@link parseTolerant}. */
export interface ParseOutcome {
  /** The recovered value. */
  value: unknown;
  /** `true` if the input was already strictly valid JSON. */
  strict: boolean;
  /** `true` if the input ended before the value was complete. */
  truncated: boolean;
}

const SMART_QUOTES = new Set(["“", "”", "‘", "’"]);

function isQuote(ch: string): boolean {
  return ch === '"' || ch === "'" || SMART_QUOTES.has(ch);
}

function closingQuoteFor(open: string): string {
  if (open === "“") return "”";
  if (open === "‘") return "’";
  return open;
}

/**
 * Parse a string that is *meant* to be a single JSON value, tolerating common
 * malformations. Assumes leading prose/fences have already been stripped (see
 * `extractCandidate`), but is robust to trailing junk.
 */
export function parseTolerant(input: string): ParseOutcome {
  let pos = 0;
  let repaired = false;
  let truncated = false;

  const len = input.length;

  function peek(): string {
    return input[pos] ?? "";
  }

  function skipWs(): void {
    while (pos < len) {
      const ch = input[pos]!;
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "﻿") {
        pos++;
        continue;
      }
      // Comments
      if (ch === "/" && input[pos + 1] === "/") {
        repaired = true;
        pos += 2;
        while (pos < len && input[pos] !== "\n") pos++;
        continue;
      }
      if (ch === "/" && input[pos + 1] === "*") {
        repaired = true;
        pos += 2;
        while (pos < len && !(input[pos] === "*" && input[pos + 1] === "/")) pos++;
        pos += 2;
        continue;
      }
      break;
    }
  }

  function parseString(): string {
    const open = input[pos]!;
    if (open !== '"') repaired = true;
    const close = closingQuoteFor(open);
    pos++; // consume opening quote
    let out = "";

    while (pos < len) {
      const ch = input[pos]!;
      if (ch === "\\") {
        const next = input[pos + 1];
        if (next === undefined) {
          truncated = true;
          pos++;
          break;
        }
        switch (next) {
          case "n": out += "\n"; break;
          case "t": out += "\t"; break;
          case "r": out += "\r"; break;
          case "b": out += "\b"; break;
          case "f": out += "\f"; break;
          case "/": out += "/"; break;
          case "\\": out += "\\"; break;
          case '"': out += '"'; break;
          case "'": out += "'"; break;
          case "u": {
            const hex = input.slice(pos + 2, pos + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              out += String.fromCharCode(parseInt(hex, 16));
              pos += 6;
              continue;
            }
            out += next;
            break;
          }
          default: out += next; break;
        }
        pos += 2;
        continue;
      }
      if (ch === close || (close !== '"' && ch === '"')) {
        pos++; // consume closing quote
        return out;
      }
      // A bare newline inside a single-quoted/smart string is tolerated.
      out += ch;
      pos++;
    }

    // Reached EOF without a closing quote.
    truncated = true;
    return out;
  }

  function parseUnquotedKey(): string {
    repaired = true;
    let out = "";
    while (pos < len) {
      const ch = input[pos]!;
      if (ch === ":" || ch === " " || ch === "\t" || ch === "\n" || ch === "\r") break;
      out += ch;
      pos++;
    }
    return out.trim();
  }

  function parseKeyword(): { matched: boolean; value: unknown } {
    const rest = input.slice(pos);
    const map: Array<[RegExp, unknown, boolean]> = [
      [/^true\b/i, true, false],
      [/^false\b/i, false, false],
      [/^null\b/i, null, false],
      [/^none\b/i, null, true],
      [/^undefined\b/i, null, true],
    ];
    for (const [re, val, isRepair] of map) {
      const m = re.exec(rest);
      if (m) {
        pos += m[0].length;
        if (isRepair || m[0] !== m[0].toLowerCase()) repaired = true;
        return { matched: true, value: val };
      }
    }
    return { matched: false, value: undefined };
  }

  function parseNumber(): { matched: boolean; value: unknown } {
    const rest = input.slice(pos);
    const inf = /^[+-]?Infinity/.exec(rest);
    if (inf) {
      pos += inf[0].length;
      repaired = true;
      return { matched: true, value: null }; // not representable in JSON
    }
    if (/^NaN/.test(rest)) {
      pos += 3;
      repaired = true;
      return { matched: true, value: null };
    }
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (m && m[0] !== "" && m[0] !== "+" && m[0] !== "-") {
      pos += m[0].length;
      if (m[0].startsWith("+")) repaired = true;
      const n = Number(m[0]);
      return { matched: true, value: Number.isFinite(n) ? n : null };
    }
    return { matched: false, value: undefined };
  }

  function parseArray(): unknown[] {
    pos++; // consume [
    const arr: unknown[] = [];
    while (pos < len) {
      skipWs();
      if (peek() === "]") {
        pos++;
        return arr;
      }
      if (peek() === ",") {
        repaired = true; // leading/duplicate comma
        pos++;
        continue;
      }
      if (pos >= len) break;
      const before = pos;
      arr.push(parseValue());
      if (pos === before) {
        pos++; // guarantee progress on garbage
        continue;
      }
      skipWs();
      if (peek() === ",") {
        pos++;
        const save = pos;
        skipWs();
        if (peek() === "]") {
          repaired = true; // trailing comma
        } else {
          pos = save;
        }
      } else if (peek() === "]") {
        pos++;
        return arr;
      }
    }
    truncated = true;
    return arr;
  }

  function parseObject(): Record<string, unknown> {
    pos++; // consume {
    const obj: Record<string, unknown> = {};
    while (pos < len) {
      skipWs();
      if (peek() === "}") {
        pos++;
        return obj;
      }
      if (peek() === ",") {
        repaired = true;
        pos++;
        continue;
      }
      if (pos >= len) break;

      // Key
      let key: string;
      if (isQuote(peek())) key = parseString();
      else key = parseUnquotedKey();
      if (key === "" && pos >= len) break;

      skipWs();
      if (peek() === ":") pos++;
      else repaired = true; // missing colon

      skipWs();
      if (pos >= len) {
        truncated = true;
        obj[key] = null;
        break;
      }
      obj[key] = parseValue();

      skipWs();
      if (peek() === ",") {
        pos++;
        const save = pos;
        skipWs();
        if (peek() === "}") {
          repaired = true; // trailing comma
        } else {
          pos = save;
        }
      } else if (peek() === "}") {
        pos++;
        return obj;
      }
    }
    truncated = true;
    return obj;
  }

  function parseValue(): unknown {
    skipWs();
    const ch = peek();
    if (ch === "") {
      truncated = true;
      return null;
    }
    if (ch === "{") return parseObject();
    if (ch === "[") return parseArray();
    if (isQuote(ch)) return parseString();

    const kw = parseKeyword();
    if (kw.matched) return kw.value;
    const num = parseNumber();
    if (num.matched) return num.value;

    // Unknown token: treat the run up to a structural char as a bare string.
    repaired = true;
    let out = "";
    while (pos < len && !",]}".includes(input[pos]!)) {
      out += input[pos]!;
      pos++;
    }
    return out.trim();
  }

  skipWs();
  const value = parseValue();
  return { value, strict: !repaired && !truncated, truncated };
}
