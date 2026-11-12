/**
 * Benchmarks parsing and serialization, on the happy path and on the error path, for speed and for memory.
 *
 * The inputs are the documents of the pinned spec artifact corpus, so each run measures the same bytes. Each case
 * checks its own outcome before it is timed: a valid input must not throw, and an invalid input must throw an
 * `OscalError`. A case that does the wrong thing fails the run, so a number never describes the wrong work.
 *
 * Measures for each case:
 *
 * - Time: the median time of one operation, from many samples. Each sample is one batch of operations, so the clock
 *   resolution does not matter. `±%` is the relative standard deviation of the samples.
 * - Allocated: the bytes that one operation allocates on the V8 heap. This number is stable between runs, so it is
 *   the best signal for a small regression.
 * - Retained: the heap bytes that one parsed document keeps alive after a garbage collection. Parse of valid input only.
 *
 * `serialize` has no error path. It does not check its input, so no input of the contract makes it throw.
 *
 * Usage:
 *
 *   npm run bench                                  Print the results as Markdown.
 *   npm run bench -- --json tmp/bench.json         Also write the results as JSON.
 *   npm run bench -- --baseline tmp/base.json      Add the change from a saved run to each row.
 *   npm run bench -- --quick                       A short run, to check that the script works. Not for numbers.
 *
 * To measure a pull request: run with `--json tmp/base.json` on main, switch to the branch, and run again with
 * `--baseline tmp/base.json`. Run both on the same machine, with nothing else busy. Time moves with the machine, so
 * compare a time only to a run from the same machine. The allocation numbers do not move with the machine.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import v8 from "node:v8";
import vm from "node:vm";
import { OscalError } from "../src/errors.ts";
import { parse, parseCatalog } from "../src/parse.ts";
import { serialize } from "../src/serialize.ts";
import type { OscalDocument } from "../src/generated/oscal.ts";
import { artifactPaths, ensureSpecArtifact, SPEC_ARTIFACT_VERSION } from "./spec-artifact.ts";

/** The corpus documents of the eight document types, and the smallest valid document. */
const VALID = [
  "minimal-catalog",
  "mapping-collection",
  "profile",
  "component-definition",
  "assessment-plan",
  "plan-of-action-and-milestones",
  "assessment-results",
  "catalog",
  "system-security-plan",
] as const;

/** The corpus documents that `parse` must reject, from the cheapest failure to the most expensive one. */
const INVALID = [
  "not-json",
  "invalid-utf8",
  "unknown-root",
  "missing-required-field",
  "two-failures",
  "many-failures",
] as const;

type Group = "Parse, valid input" | "Serialize, valid input" | "Parse, invalid input";

export interface Result {
  /** Stable key of the case, used to match a run against a baseline. */
  id: string;
  group: Group;
  name: string;
  /** Size of the input in bytes, or of the output for serialize. */
  bytes: number;
  /** Median microseconds for one operation. */
  medianUs: number;
  /** Relative standard deviation of the samples, in percent. */
  rsdPct: number;
  /** V8 heap bytes allocated by one operation. */
  allocatedBytes: number;
  /** Heap bytes that one result keeps alive. Only for parse of valid input. */
  retainedBytes?: number;
}

export interface Report {
  version: 1;
  generatedAt: string;
  commit: string | null;
  environment: { node: string; platform: string; cpu: string; specArtifact: string };
  settings: { samples: number; sampleMs: number };
  /** One-time costs of the first parse of a type, from one sample each, so rough. Names: catalog, then profile. */
  coldStartMs: { firstType: number; nextType: number };
  /** The peak resident set size of the whole process, in bytes. It includes the benchmark itself. */
  peakRssBytes: number;
  results: Result[];
}

// --- Measurement ---------------------------------------------------------------------------------------------------

// A forced collection needs `--expose-gc`. Turning it on from inside avoids a flag in every command that runs this file.
v8.setFlagsFromString("--expose-gc");
const gc = vm.runInNewContext("gc") as () => void;

const now = () => Number(process.hrtime.bigint()) / 1e3; // microseconds
const allocatedNow = () => v8.getHeapStatistics().total_allocated_bytes;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Holds results so the engine cannot drop them as dead code. */
let sink: unknown;

interface Settings {
  samples: number;
  sampleMs: number;
  warmupMs: number;
}

/** Time and allocation of `op`. */
function measure(op: () => unknown, s: Settings): Pick<Result, "medianUs" | "rsdPct" | "allocatedBytes"> {
  // Warm up, so the optimizer has seen the code, and learn the size of a batch that takes about `sampleMs`.
  let iterations = 0;
  const warmStart = now();
  while (now() - warmStart < s.warmupMs * 1e3) {
    sink = op();
    iterations++;
  }
  const perOpUs = (now() - warmStart) / iterations;
  const batch = Math.max(1, Math.ceil((s.sampleMs * 1e3) / perOpUs));

  const times: number[] = [];
  const allocations: number[] = [];
  for (let i = 0; i < s.samples; i++) {
    gc(); // Start each sample from a clean heap, so a collection in the middle is rare.
    const allocatedBefore = allocatedNow();
    const start = now();
    for (let j = 0; j < batch; j++) sink = op();
    const elapsed = now() - start;
    allocations.push((allocatedNow() - allocatedBefore) / batch);
    times.push(elapsed / batch);
  }
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length;
  return { medianUs: median(times), rsdPct: (Math.sqrt(variance) / mean) * 100, allocatedBytes: median(allocations) };
}

/**
 * Heap bytes that one result of `op` keeps alive. One trial of a small document is below the noise of the heap
 * counter, so the number is the median of several trials that each keep many results.
 */
function retained(op: () => unknown, copies = 100, trials = 5): number {
  const perDocument: number[] = [];
  for (let t = 0; t < trials; t++) {
    gc();
    gc();
    const before = v8.getHeapStatistics().used_heap_size;
    const keep = Array.from({ length: copies }, op);
    gc();
    gc();
    const after = v8.getHeapStatistics().used_heap_size;
    sink = keep;
    perDocument.push((after - before) / copies);
  }
  return Math.max(0, median(perDocument));
}

// --- Cases ---------------------------------------------------------------------------------------------------------

interface Case {
  group: Group;
  name: string;
  bytes: number;
  op: () => unknown;
  /** Throws when the case does not do what its group says. Runs once, before the timing. */
  check: () => void;
  withRetained?: boolean;
}

function fail(message: string): never {
  throw new Error(`benchmark case is wrong: ${message}`);
}

function expectThrowsOscalError(label: string, op: () => unknown): void {
  try {
    op();
  } catch (error) {
    if (error instanceof OscalError) return;
    fail(`${label} threw ${String(error)}, not an OscalError`);
  }
  fail(`${label} did not throw`);
}

async function buildCases(): Promise<Case[]> {
  const { documents } = artifactPaths(await ensureSpecArtifact());
  const text = (kind: "valid" | "invalid", name: string) => fs.readFileSync(path.join(documents, kind, `${name}.json`), "utf8");
  const cases: Case[] = [];

  const valid = new Map(VALID.map((name) => [name, text("valid", name)]));
  for (const [name, input] of valid) {
    cases.push({
      group: "Parse, valid input",
      name,
      bytes: Buffer.byteLength(input),
      op: () => parse(input),
      check: () => void parse(input),
      withRetained: true,
    });
  }
  for (const compact of [false, true]) {
    for (const [name, input] of valid) {
      const document = parse(input) as OscalDocument;
      const output = serialize(document, { compact });
      cases.push({
        group: "Serialize, valid input",
        name: `${name}${compact ? " (compact)" : ""}`,
        bytes: Buffer.byteLength(output),
        op: () => serialize(document, { compact }),
        check: () => {
          if (typeof output !== "string" || output.length === 0) fail(`serialize of ${name} gave no text`);
        },
      });
    }
  }

  for (const name of INVALID) {
    // The invalid UTF-8 case must reach `parse` as bytes, because a JavaScript string cannot hold invalid UTF-8.
    const input: string | Uint8Array =
      name === "invalid-utf8"
        ? fs.readFileSync(path.join(documents, "invalid", `${name}.json`))
        : text("invalid", name);
    cases.push({
      group: "Parse, invalid input",
      name,
      bytes: typeof input === "string" ? Buffer.byteLength(input) : input.byteLength,
      op: () => tryParse(() => parse(input)),
      check: () => expectThrowsOscalError(name, () => parse(input)),
    });
  }
  // A well-formed document of the wrong type, and a document over the depth limit. Neither is in the corpus files above.
  const profile = valid.get("profile")!;
  cases.push({
    group: "Parse, invalid input",
    name: "wrong-document-type (parseCatalog on a profile)",
    bytes: Buffer.byteLength(profile),
    op: () => tryParse(() => parseCatalog(profile)),
    check: () => expectThrowsOscalError("wrong-document-type", () => parseCatalog(profile)),
  });
  const tooDeep = `${"[".repeat(300)}${"]".repeat(300)}`;
  cases.push({
    group: "Parse, invalid input",
    name: "over-depth-limit (300 levels)",
    bytes: tooDeep.length,
    op: () => tryParse(() => parse(tooDeep)),
    check: () => expectThrowsOscalError("over-depth-limit", () => parse(tooDeep)),
  });
  return cases;
}

/** Runs an operation that is expected to throw. The throw is part of the cost, so it stays inside the timing. */
function tryParse(op: () => unknown): unknown {
  try {
    return op();
  } catch (error) {
    return error;
  }
}

// --- Cold start ----------------------------------------------------------------------------------------------------

/**
 * The first parse of a document type compiles the fail-fast and the collecting validator of that type, so it costs
 * much more than every later call. The second number is the first parse of another type, which shows what each further
 * type adds once the shared parts of the schema are compiled.
 */
async function coldStart(): Promise<Report["coldStartMs"]> {
  const { documents } = artifactPaths(await ensureSpecArtifact());
  const read = (name: string) => fs.readFileSync(path.join(documents, "valid", `${name}.json`), "utf8");
  const first = read("catalog");
  const next = read("profile");
  let start = now();
  parse(first);
  const firstType = (now() - start) / 1e3;
  start = now();
  parse(next);
  const nextType = (now() - start) / 1e3;
  return { firstType, nextType };
}

// --- Report --------------------------------------------------------------------------------------------------------

function gitCommit(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const fmtTime = (us: number) => (us >= 1000 ? `${(us / 1000).toFixed(2)} ms` : `${us.toFixed(us >= 100 ? 0 : 1)} µs`);
const fmtBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MiB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KiB` : `${Math.round(n)} B`;
const fmtRate = (r: Result) => `${(r.bytes / r.medianUs).toFixed(1)} MB/s`; // bytes per microsecond equals MB per second
const fmtOps = (us: number) => Math.round(1e6 / us).toLocaleString("en-US");

/** The change of `now` from `before`, in percent. A change over `limit` is bold. */
function delta(now: number, before: number | undefined, limit: number): string {
  if (before === undefined || before === 0) return "n/a";
  const pct = ((now - before) / before) * 100;
  const text = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  return Math.abs(pct) > limit ? `**${text}**` : text;
}

/** Allocation does not vary between runs on one build, so a small change is a real change. */
const ALLOCATION_LIMIT_PCT = 2;
/** The first-call times and the peak memory come from one sample each, so only a large change is bold. */
const COLD_LIMIT_PCT = 50;

export function renderMarkdown(report: Report, baseline?: Report, threshold = 10): string {
  const out: string[] = [];
  const base = new Map(baseline?.results.map((r) => [r.id, r]));
  const e = report.environment;
  out.push(`Node ${e.node} on ${e.platform}, ${e.cpu}. Spec artifact ${e.specArtifact}.`);
  if (baseline) {
    const b = baseline.environment;
    out.push(`Baseline: ${baseline.commit ?? "unknown commit"}, this run: ${report.commit ?? "unknown commit"}.`);
    if (b.node !== e.node || b.cpu !== e.cpu || b.platform !== e.platform || b.specArtifact !== e.specArtifact) {
      out.push(`**The baseline ran in another environment** (Node ${b.node}, ${b.cpu}). Compare its times with care.`);
    }
    out.push(
      `A change is bold when it is real and not noise. A time change is bold when it is over ${threshold}% and over the ` +
        `spread (±%) of both runs together. An allocation change is bold when it is over ${ALLOCATION_LIMIT_PCT}%.`,
    );
  }
  for (const group of ["Parse, valid input", "Serialize, valid input", "Parse, invalid input"] as const) {
    const rows = report.results.filter((r) => r.group === group);
    const hasRetained = rows.some((r) => r.retainedBytes !== undefined);
    const header = ["Case", "Size", "Median", "Ops/s", ...(group === "Parse, invalid input" ? [] : ["Throughput"]), "±%", "Allocated/op"];
    if (hasRetained) header.push("Retained/doc");
    if (baseline) header.push("Δ time", "Δ allocated");
    out.push("", `### ${group}`, "", `| ${header.join(" | ")} |`, `|${header.map((_, i) => (i === 0 ? "---" : "---:")).join("|")}|`);
    for (const r of rows) {
      const b = base.get(r.id);
      const cells = [
        r.name,
        fmtBytes(r.bytes),
        fmtTime(r.medianUs),
        fmtOps(r.medianUs),
        ...(group === "Parse, invalid input" ? [] : [fmtRate(r)]),
        r.rsdPct.toFixed(1),
        fmtBytes(r.allocatedBytes),
      ];
      if (hasRetained) cells.push(r.retainedBytes === undefined ? "" : fmtBytes(r.retainedBytes));
      if (baseline) {
        const noise = (b?.rsdPct ?? 0) + r.rsdPct;
        cells.push(delta(r.medianUs, b?.medianUs, Math.max(threshold, noise)), delta(r.allocatedBytes, b?.allocatedBytes, ALLOCATION_LIMIT_PCT));
      }
      out.push(`| ${cells.join(" | ")} |`);
    }
  }
  const cold = report.coldStartMs;
  const coldBase = baseline?.coldStartMs;
  out.push(
    "",
    "### First call and process memory",
    "",
    "| Measure | Value |" + (baseline ? " Δ |" : ""),
    "|---|---:|" + (baseline ? "---:|" : ""),
    `| First parse in the process (catalog, compiles its validators) | ${cold.firstType.toFixed(1)} ms |` +
      (baseline ? ` ${delta(cold.firstType, coldBase?.firstType, COLD_LIMIT_PCT)} |` : ""),
    `| First parse of a second document type (profile) | ${cold.nextType.toFixed(1)} ms |` +
      (baseline ? ` ${delta(cold.nextType, coldBase?.nextType, COLD_LIMIT_PCT)} |` : ""),
    `| Peak resident memory of the process | ${fmtBytes(report.peakRssBytes)} |` +
      (baseline ? ` ${delta(report.peakRssBytes, baseline.peakRssBytes, COLD_LIMIT_PCT)} |` : ""),
    "",
    "Allocated/op is the V8 heap that one call allocates. Retained/doc is the heap that one parsed document keeps after a " +
      "garbage collection. Peak resident memory covers the whole process, including this script. `serialize` has no error path.",
  );
  return out.join("\n");
}

// --- Main ----------------------------------------------------------------------------------------------------------

export async function runBenchmark(quick: boolean): Promise<Report> {
  const settings: Settings = quick ? { samples: 3, sampleMs: 10, warmupMs: 20 } : { samples: 20, sampleMs: 50, warmupMs: 300 };
  // Cold start must come first. Every later call finds the validators already compiled.
  const coldStartMs = await coldStart();
  const cases = await buildCases();
  for (const c of cases) c.check();

  const results: Result[] = [];
  for (const c of cases) {
    const m = measure(c.op, settings);
    results.push({
      id: `${c.group}/${c.name}`,
      group: c.group,
      name: c.name,
      bytes: c.bytes,
      ...m,
      ...(c.withRetained ? { retainedBytes: retained(c.op) } : {}),
    });
    process.stderr.write(`  ${c.group}: ${c.name}\n`);
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    commit: gitCommit(),
    environment: {
      node: process.versions.node,
      platform: `${process.platform} ${process.arch}`,
      cpu: os.cpus()[0]?.model ?? "unknown cpu",
      specArtifact: SPEC_ARTIFACT_VERSION,
    },
    settings: { samples: settings.samples, sampleMs: settings.sampleMs },
    coldStartMs,
    peakRssBytes: process.resourceUsage().maxRSS * 1024, // Node reports kilobytes.
    results,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { values } = parseArgs({
    options: {
      json: { type: "string" },
      baseline: { type: "string" },
      threshold: { type: "string", default: "10" },
      quick: { type: "boolean", default: false },
    },
  });
  const baseline = values.baseline ? (JSON.parse(fs.readFileSync(values.baseline, "utf8")) as Report) : undefined;
  if (baseline && baseline.version !== 1) throw new Error(`${values.baseline}: unknown report version ${baseline.version}`);
  const report = await runBenchmark(values.quick);
  if (values.json) {
    fs.mkdirSync(path.dirname(path.resolve(values.json)), { recursive: true });
    fs.writeFileSync(values.json, `${JSON.stringify(report, null, 2)}\n`);
    process.stderr.write(`wrote ${values.json}\n`);
  }
  console.log(renderMarkdown(report, baseline, Number(values.threshold)));
}
