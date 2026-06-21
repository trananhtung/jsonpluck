#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { tryPluck } from "./index.js";

const HELP = `jsonpluck — pluck valid JSON out of messy LLM output

Usage:
  jsonpluck [file]            Extract & repair JSON (reads stdin if no file)

Options:
  --pretty, -p               Pretty-print with 2-space indent
  --strict-truncation        Fail instead of recovering truncated input
  --help, -h                 Show this help

Examples:
  cat llm-response.txt | jsonpluck
  cat llm-response.txt | jsonpluck --pretty
  jsonpluck response.json

Exit codes: 0 = JSON recovered, 1 = nothing recoverable.`;

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function main(argv: string[]): number {
  const args = new Set(argv);
  if (args.has("--help") || args.has("-h")) {
    process.stdout.write(HELP + "\n");
    return 0;
  }

  const pretty = args.has("--pretty") || args.has("-p");
  const allowTruncated = !args.has("--strict-truncation");
  const file = argv.find((a) => !a.startsWith("-"));

  const text = file ? readFileSync(file, "utf8") : readStdin();
  const result = tryPluck(text, { allowTruncated });

  if (!result.ok) {
    process.stderr.write(`jsonpluck: ${result.error}\n`);
    return 1;
  }

  process.stdout.write(JSON.stringify(result.value, null, pretty ? 2 : undefined) + "\n");
  if (result.truncated) process.stderr.write("warning: input was truncated; recovered partial value\n");
  return 0;
}

process.exit(main(process.argv.slice(2)));
