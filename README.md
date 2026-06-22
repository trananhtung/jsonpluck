# jsonpluck

[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)

> Pluck valid JSON out of messy LLM output — **markdown fences, trailing commas, single quotes, comments, truncation** — with **zero dependencies**.

[![CI](https://github.com/trananhtung/jsonpluck/actions/workflows/ci.yml/badge.svg)](https://github.com/trananhtung/jsonpluck/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/jsonpluck.svg)](https://www.npmjs.com/package/jsonpluck)
[![bundle size](https://img.shields.io/bundlephobia/minzip/jsonpluck)](https://bundlephobia.com/package/jsonpluck)
[![types](https://img.shields.io/npm/types/jsonpluck.svg)](https://www.npmjs.com/package/jsonpluck)
[![license](https://img.shields.io/npm/l/jsonpluck.svg)](./LICENSE)

You asked the model for JSON. You got:

````text
Sure! Here's the data you requested:

```json
{
  "title": "Quarterly Report",
  "tags": ["finance", "q3",],   // trailing comma + comment
  'confidence': 0.87,           // single quotes
}
```

Hope that helps!
````

`JSON.parse` throws on every line of that. **`jsonpluck` returns the object.**

```ts
import { pluck } from "jsonpluck";

pluck(llmResponse);
// → { title: "Quarterly Report", tags: ["finance", "q3"], confidence: 0.87 }
```

## What it handles

- **Markdown fences** — ` ```json `, ` ```jsonc `, or plain ` ``` `.
- **Prose around the JSON** — finds the first balanced `{…}` / `[…]`.
- **Trailing commas**, **single quotes**, **“smart” quotes**, **unquoted keys**.
- **`//` and `/* */` comments**.
- **Python literals** — `True` / `False` / `None`.
- **`NaN` / `Infinity`** → `null` (valid JSON).
- **Truncated output** — a response cut off mid-object/array/string is recovered
  as the partial value, with a `truncated` flag so you can decide what to do.

Strictly-valid JSON takes a `JSON.parse` fast path, so there's no penalty for the
happy case.

## Install

```bash
npm install jsonpluck
# or: pnpm add jsonpluck  /  yarn add jsonpluck  /  bun add jsonpluck
```

## API

### `pluck<T>(text, options?): T`

Extract and parse JSON, throwing if nothing is recoverable.

```ts
const data = pluck<{ title: string }>(llmResponse);
```

### `tryPluck<T>(text, options?): PluckResult<T>`

Never throws. Returns a discriminated union you can branch on.

```ts
const r = tryPluck<MySchema>(llmResponse);
if (r.ok) {
  use(r.value);
  if (r.truncated) console.warn("recovered a partial value");
} else {
  console.error(r.error);
}
```

```ts
type PluckResult<T> =
  | { ok: true;  value: T; strict: boolean; truncated: boolean }
  | { ok: false; error: string };
```

### `repair(text, indent?): string`

Return canonical JSON text (handy for logging or re-serialising).

```ts
repair("{'a':1,}");      // '{"a":1}'
repair("{'a':1}", 2);    // '{\n  "a": 1\n}'
```

### Options

| Option           | Type      | Default | Description                                            |
| ---------------- | --------- | ------- | ------------------------------------------------------ |
| `allowTruncated` | `boolean` | `true`  | Accept partial values from truncated input vs. fail.   |

### Low-level building blocks

```ts
import { extractCandidate, parseTolerant } from "jsonpluck";

extractCandidate(text); // → the JSON-ish substring (or null)
parseTolerant(jsonish); // → { value, strict, truncated }
```

## Why use it?

LLMs are probabilistic; structured-output modes help but don't eliminate stray
prose, fences, or truncation under token limits. Wrapping every parse in
`jsonpluck` turns a class of intermittent production crashes into recovered data.

- **Zero dependencies** — runs in Node, browsers, edge runtimes, and Workers.
- **Fast path** for valid JSON — no overhead when the model behaves.
- **Honest about truncation** — you get a flag, not a silent guess.

## CLI

```bash
cat llm-response.txt | jsonpluck            # repaired JSON to stdout
cat llm-response.txt | jsonpluck --pretty   # pretty-printed
jsonpluck response.json --strict-truncation # exit 1 if truncated
```

## A note on guarantees

`jsonpluck` recovers *structure*; it cannot invent data that the model never
produced. For a truncated array of 10 items where only 6 arrived, you get 6.
Validate the recovered value against your schema (e.g. with Zod) before trusting
it.

## Contributors ✨

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind are welcome — code, docs, bug reports, ideas, reviews! See the [emoji key](https://allcontributors.org/docs/en/emoji-key) for how each contribution is recognized, and open a PR or issue to get involved.

Thanks goes to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/trananhtung"><img src="https://avatars.githubusercontent.com/u/30992229?v=4?s=100" width="100px;" alt="Tung Tran"/><br /><sub><b>Tung Tran</b></sub></a><br /><a href="https://github.com/trananhtung/jsonpluck/commits?author=trananhtung" title="Code">💻</a> <a href="#maintenance-trananhtung" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

[MIT](./LICENSE) © Tung Tran
