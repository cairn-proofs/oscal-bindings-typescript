/**
 * The rules of the conformance corpus (corpus/1.2.3/README.md of the pinned artifact), applied through an adapter, and
 * the rules for the list of expected failures (VER-007).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Adapter } from "./adapter.ts";
import { canonicalize } from "./canonical-json.ts";

export interface Case {
  id: string;
  operation: string;
  input: string;
  "document-type"?: string;
  "element-type"?: string;
  "input-form"?: "bytes";
  expected?: string;
  "expected-category"?: string;
  "expected-valid"?: boolean;
  "expected-min-failures"?: number;
  "expected-max-failures"?: number;
}

export interface Corpus {
  /** The absolute path of the corpus directory. */
  dir: string;
  cases: Case[];
}

export function loadCorpus(dir: string): Corpus {
  const index = JSON.parse(fs.readFileSync(path.join(dir, "cases.json"), "utf8")) as { cases: Case[] };
  return { dir, cases: index.cases };
}

/** The input of a case: raw bytes when `input-form` is `bytes`, text otherwise. */
function inputOf(corpusDir: string, c: Case): string | Uint8Array {
  const bytes = fs.readFileSync(path.join(corpusDir, c.input));
  return c["input-form"] === "bytes" ? new Uint8Array(bytes) : bytes.toString("utf8");
}

/** The canonical bytes of JSON text. */
const canonicalBytes = (json: string) => Buffer.from(canonicalize(json), "utf8");

function assertCanonicalEqual(corpusDir: string, c: Case, json: string, what: string): void {
  const expected = fs.readFileSync(path.join(corpusDir, c.expected as string));
  assert.ok(canonicalBytes(json).equals(expected), `${c.id}: the canonical form of ${what} differs from ${c.expected}`);
}

/** Runs `action`, which must throw an error of category `category`. Returns that error. */
function reports(adapter: Adapter, c: Case, category: string, action: () => unknown): unknown {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error !== undefined, `${c.id}: expected the category ${category}, but the operation did not throw`);
  assert.equal(adapter.category(error), category, `${c.id}: wrong category`);
  return error;
}

function checkFailureCount(adapter: Adapter, c: Case, error: unknown): void {
  const count = adapter.failureCount(error);
  const min = c["expected-min-failures"];
  const max = c["expected-max-failures"];
  if (min !== undefined) assert.ok(count >= min, `${c.id}: ${count} failure entries, expected at least ${min}`);
  if (max !== undefined) assert.ok(count <= max, `${c.id}: ${count} failure entries, expected at most ${max}`);
}

/** Runs one corpus case through the adapter. Throws when the binding does not give the expected result. */
export function runCase(adapter: Adapter, corpusDir: string, c: Case): void {
  const category = c["expected-category"] as string;
  switch (c.operation) {
    case "round-trip": {
      const input = inputOf(corpusDir, c);
      const document = adapter.parse(input);
      adapter.parseTyped(c["document-type"] as string, input);
      assertCanonicalEqual(corpusDir, c, adapter.serialize(document), "the serialized document");
      assert.equal(adapter.isValid(input), true, `${c.id}: isValid must be true`);
      return;
    }
    case "parse": {
      const input = inputOf(corpusDir, c);
      const error = reports(adapter, c, category, () => adapter.parse(input));
      assert.equal(adapter.isValid(input), false, `${c.id}: isValid must be false`);
      checkFailureCount(adapter, c, error);
      return;
    }
    case "parse-typed": {
      const input = inputOf(corpusDir, c);
      reports(adapter, c, category, () => adapter.parseTyped(c["document-type"] as string, input));
      return;
    }
    case "parse-file": {
      const file = path.join(corpusDir, c.input);
      const error = reports(adapter, c, category, () => adapter.parseFile(file));
      const message = error instanceof Error ? error.message : String(error);
      assert.ok(message.includes(file), `${c.id}: the error message must name ${file}`);
      return;
    }
    case "assessment-period": {
      const document = adapter.parse(inputOf(corpusDir, c));
      reports(adapter, c, category, () => adapter.assessmentPeriod(document));
      return;
    }
    case "validate-element": {
      const value: unknown = JSON.parse(fs.readFileSync(path.join(corpusDir, c.input), "utf8"));
      const elementType = c["element-type"] as string;
      if (c["expected-valid"] !== undefined) {
        assert.equal(adapter.validateElement(elementType, value), c["expected-valid"], `${c.id}: wrong validity`);
      } else {
        reports(adapter, c, category, () => adapter.validateElement(elementType, value));
      }
      return;
    }
    case "yaml-round-trip": {
      const document = adapter.parseYaml(inputOf(corpusDir, c));
      assertCanonicalEqual(corpusDir, c, adapter.serialize(document), "the parsed YAML");
      const again = adapter.parseYaml(adapter.serializeYaml(document));
      assertCanonicalEqual(corpusDir, c, adapter.serialize(again), "the YAML output parsed again");
      return;
    }
    case "yaml-parse": {
      const input = inputOf(corpusDir, c);
      const error = reports(adapter, c, category, () => adapter.parseYaml(input));
      checkFailureCount(adapter, c, error);
      return;
    }
    default:
      assert.fail(`${c.id}: unknown operation ${c.operation}`);
  }
}

/** A map from case id to the reason that the case is expected to fail (VER-007). */
export type ExpectedFailures = Record<string, string>;

/** Rule 3: a listed id that is not in the corpus. Throws. */
export function checkListedIds(expected: ExpectedFailures, cases: readonly Case[]): void {
  const ids = new Set(cases.map((c) => c.id));
  const unknown = Object.keys(expected).filter((id) => !ids.has(id));
  assert.equal(unknown.length, 0, `expected-failures.json lists ids that are not in the corpus: ${unknown.join(", ")}`);
}

/**
 * Rules 1 and 2: a listed case that fails passes, and a listed case that passes fails. An unlisted case runs as
 * normal.
 */
export function runWithExpectation(expected: ExpectedFailures, c: Case, run: () => void): void {
  if (!(c.id in expected)) {
    run();
    return;
  }
  try {
    run();
  } catch {
    return;
  }
  assert.fail(`${c.id} passes, but it is listed in expected-failures.json. Remove its entry.`);
}
