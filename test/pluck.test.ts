import { describe, expect, it } from "vitest";
import { pluck, tryPluck, repair } from "../src/index.js";

describe("pluck — valid input", () => {
  it("parses strictly valid JSON via the fast path", () => {
    const r = tryPluck('{"a": 1, "b": [2, 3]}');
    expect(r.ok && r.value).toEqual({ a: 1, b: [2, 3] });
    expect(r.ok && r.strict).toBe(true);
  });

  it("parses a top-level array", () => {
    expect(pluck("[1, 2, 3]")).toEqual([1, 2, 3]);
  });
});

describe("pluck — markdown fences", () => {
  it("unwraps a ```json fenced block", () => {
    const text = 'Here you go:\n```json\n{"ok": true}\n```\nHope that helps!';
    expect(pluck(text)).toEqual({ ok: true });
  });

  it("unwraps an unlabelled fence", () => {
    expect(pluck("```\n{\"x\": 1}\n```")).toEqual({ x: 1 });
  });

  it("extracts JSON embedded in prose without fences", () => {
    expect(pluck('The answer is {"score": 0.9} based on analysis.')).toEqual({ score: 0.9 });
  });
});

describe("pluck — common malformations", () => {
  it("removes trailing commas", () => {
    expect(pluck('{"a": 1, "b": 2,}')).toEqual({ a: 1, b: 2 });
    expect(pluck("[1, 2, 3,]")).toEqual([1, 2, 3]);
  });

  it("accepts single-quoted strings", () => {
    expect(pluck("{'name': 'Ada'}")).toEqual({ name: "Ada" });
  });

  it("accepts unquoted keys", () => {
    expect(pluck("{name: \"Ada\", age: 36}")).toEqual({ name: "Ada", age: 36 });
  });

  it("strips // and /* */ comments", () => {
    const text = `{
      // the name
      "name": "Ada", /* inline */ "age": 36
    }`;
    expect(pluck(text)).toEqual({ name: "Ada", age: 36 });
  });

  it("normalises Python literals", () => {
    expect(pluck("{\"a\": True, \"b\": False, \"c\": None}")).toEqual({
      a: true,
      b: false,
      c: null,
    });
  });

  it("handles smart quotes", () => {
    expect(pluck("{“key”: “value”}")).toEqual({ key: "value" });
  });

  it("maps NaN / Infinity to null", () => {
    expect(pluck('{"a": NaN, "b": Infinity}')).toEqual({ a: null, b: null });
  });
});

describe("pluck — truncation", () => {
  it("recovers a truncated object", () => {
    const r = tryPluck('{"a": 1, "b": "hello wor');
    expect(r.ok).toBe(true);
    expect(r.ok && r.truncated).toBe(true);
    expect(r.ok && r.value).toEqual({ a: 1, b: "hello wor" });
  });

  it("recovers a truncated array", () => {
    expect(pluck("[1, 2, 3")).toEqual([1, 2, 3]);
  });

  it("can be told to fail on truncation", () => {
    const r = tryPluck('{"a": 1, "b":', { allowTruncated: false });
    expect(r.ok).toBe(false);
  });
});

describe("pluck — failure", () => {
  it("returns an error when there is no JSON", () => {
    const r = tryPluck("just some prose, no json here");
    expect(r.ok).toBe(false);
  });

  it("pluck throws when nothing is recoverable", () => {
    expect(() => pluck("nothing to see")).toThrow(/jsonpluck/);
  });

  it("rejects non-string input", () => {
    // @ts-expect-error testing runtime guard
    expect(tryPluck(42).ok).toBe(false);
  });
});

describe("repair", () => {
  it("returns canonical JSON text", () => {
    expect(repair("{'a':1,}")).toBe('{"a":1}');
  });

  it("pretty-prints with indent", () => {
    expect(repair("{'a':1}", 2)).toBe('{\n  "a": 1\n}');
  });
});

describe("pluck — real-world LLM shapes", () => {
  it("handles a chatty wrapper with a fenced object and trailing comma", () => {
    const text = [
      "Absolutely! Here's the structured result you asked for:",
      "",
      "```json",
      "{",
      '  "title": "Quarterly Report",',
      '  "tags": ["finance", "q3",],',
      "  // confidence is approximate",
      '  "confidence": 0.87,',
      "}",
      "```",
      "",
      "Let me know if you need anything else.",
    ].join("\n");

    expect(pluck(text)).toEqual({
      title: "Quarterly Report",
      tags: ["finance", "q3"],
      confidence: 0.87,
    });
  });
});
