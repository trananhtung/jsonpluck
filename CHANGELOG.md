# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-21

### Added

- `pluck` / `tryPluck` — extract and parse JSON from messy LLM output, with a
  `JSON.parse` fast path for valid input.
- `repair` — return canonical JSON text from messy input.
- Tolerant parser handling markdown fences, surrounding prose, trailing commas,
  single/smart quotes, unquoted keys, `//` and `/* */` comments, Python literals
  (`True`/`False`/`None`), `NaN`/`Infinity`, and truncated input.
- `extractCandidate` and `parseTolerant` exported as low-level building blocks.
- `jsonpluck` CLI with `--pretty` and `--strict-truncation`.
- Full TypeScript types, ESM + CJS builds, and CI across Node 18 / 20 / 22.
