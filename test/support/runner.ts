/**
 * The rules of the conformance corpus (corpus/1.2.3/README.md of the pinned artifact), applied through an adapter, and
 * the rules for the list of expected failures (VER-007).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseGenericYaml } from "yaml";
import type { Adapter } from "./adapter.ts";
import { canonicalize, normalizeDatetime } from "./canonical-json.ts";

export interface Case {
  id: string;
  operation: string;
  input: string;
  "document-type"?: string;
  "element-type"?: string;
  "input-form"?: "bytes" | "path";
  expected?: string;
  "expected-category"?: string;
  "expected-valid"?: boolean;
  "expected-min-failures"?: number;
  "expected-max-failures"?: number;
  arguments?: Record<string, unknown>;
  "expected-period"?: { start: string | null; end: string | null };
  "expected-absent-keys"?: string[];
  "expected-uuid"?: string;
  "expected-element"?: unknown;
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

/** The input of a case as UTF-8 text, whatever its input form. */
const textOf = (corpusDir: string, c: Case): string => fs.readFileSync(path.join(corpusDir, c.input), "utf8");

/** The canonical bytes of JSON text. */
const canonicalBytes = (json: string) => Buffer.from(canonicalize(json), "utf8");

function assertCanonicalEqual(corpusDir: string, c: Case, json: string, what: string): void {
  const expected = fs.readFileSync(path.join(corpusDir, c.expected as string));
  assert.ok(canonicalBytes(json).equals(expected), `${c.id}: the canonical form of ${what} differs from ${c.expected}`);
}

/** The canonical form of the JSON of a value. */
const canonicalOf = (value: unknown) => canonicalize(JSON.stringify(value));

function assertElementEqual(c: Case, actual: unknown, expected: unknown, what: string): void {
  assert.equal(canonicalOf(actual), canonicalOf(expected), `${c.id}: the canonical form of ${what} differs`);
}

/** The error message must name the path. */
function assertNamesPath(c: Case, error: unknown, file: string): void {
  const message = error instanceof Error ? error.message : String(error);
  assert.ok(message.includes(file), `${c.id}: the error message must name ${file}`);
}

/** The UUID pattern of the schema that the corpus pins. The schema is at `../../schemas/<release>/` of the corpus. */
function uuidPattern(corpusDir: string): RegExp {
  const release = path.basename(corpusDir);
  const schemaPath = path.join(corpusDir, "..", "..", "schemas", release, "oscal_complete_schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as { definitions: { UUIDDatatype: { pattern: string } } };
  return new RegExp(schema.definitions.UUIDDatatype.pattern);
}

/** The only parent in the category tree of ERR-009, as the corpus README states it. */
const PARENT_CATEGORY: Readonly<Record<string, string>> = { "document-type-mismatch": "parse-error" };

/** The categories of the corpus (cases.json, `categories`). */
function categoriesOf(corpusDir: string): string[] {
  const index = JSON.parse(fs.readFileSync(path.join(corpusDir, "cases.json"), "utf8")) as { categories: string[] };
  return index.categories;
}

/**
 * Runs `action`, which must throw an error of category `category`. Returns that error. The error is in `category` and
 * in its ancestor, and in no other category of the corpus (ERR-009).
 */
function reportsIn(corpusDir: string, adapter: Adapter, c: Case, category: string, action: () => unknown): unknown {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error !== undefined, `${c.id}: expected the category ${category}, but the operation did not throw`);
  assert.equal(adapter.category(error), category, `${c.id}: wrong category`);
  for (const other of categoriesOf(corpusDir)) {
    const expectedIn = other === category || other === PARENT_CATEGORY[category];
    assert.equal(adapter.inCategory(error, other), expectedIn, `${c.id}: wrong test result for the category ${other}`);
  }
  return error;
}

function checkFailureCount(adapter: Adapter, c: Case, error: unknown): void {
  const count = adapter.failureCount(error);
  const min = c["expected-min-failures"];
  const max = c["expected-max-failures"];
  if (min !== undefined) assert.ok(count >= min, `${c.id}: ${count} failure entries, expected at least ${min}`);
  if (max !== undefined) assert.ok(count <= max, `${c.id}: ${count} failure entries, expected at most ${max}`);
}

/**
 * The operations of the corpus that runCase has no rules for yet. The change that adds the rules of an operation
 * removes it from this list. Until then, each case of the operation is in expected-failures.json, because runCase
 * rejects an operation that it does not know. The list is empty, because runCase has rules for each operation.
 */
export const PENDING_OPERATIONS: ReadonlySet<string> = new Set();

/** True when runCase rejects the case, because its operation is pending. */
export function isPendingCase(c: Case): boolean {
  return PENDING_OPERATIONS.has(c.operation);
}

/**
 * The operations of the corpus that the binding does not offer, with the reason. The corpus README tells a binding to
 * skip such an operation.
 */
export const UNOFFERED_OPERATIONS: ReadonlyMap<string, string> = new Map([
  ["yaml-parse-typed", "the binding offers no typed YAML parser, and YML-007 makes these parsers optional"],
]);

/** The reason that the binding skips the operation of the case, or undefined when it offers the operation. */
export const unofferedReason = (c: Case): string | undefined => UNOFFERED_OPERATIONS.get(c.operation);

/** Writes `text` to a file in a new temporary directory, runs `action` with the path, and removes the directory. */
function withTempFile<T>(text: string, action: (file: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oscal-runner-"));
  try {
    const file = path.join(dir, "second-parse.yaml");
    fs.writeFileSync(file, text);
    return action(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The first mapping key of `keys` that occurs at any depth of a YAML value, or undefined. */
function findKey(value: unknown, keys: readonly string[]): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findKey(item, keys);
      if (found !== undefined) return found;
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (keys.includes(key)) return key;
      const found = findKey(item, keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Runs one corpus case through the adapter. Throws when the binding does not give the expected result. */
export function runCase(adapter: Adapter, corpusDir: string, c: Case): void {
  const category = c["expected-category"] as string;
  const reports = (a: Adapter, cc: Case, cat: string, action: () => unknown) => reportsIn(corpusDir, a, cc, cat, action);
  switch (c.operation) {
    case "round-trip": {
      const text = textOf(corpusDir, c);
      const fromPath = c["input-form"] === "path";
      const input = inputOf(corpusDir, c);
      const document = fromPath ? adapter.parseFile(path.join(corpusDir, c.input)) : adapter.parse(input);
      adapter.parseTyped(c["document-type"] as string, text);
      assertCanonicalEqual(corpusDir, c, adapter.serialize(document), "the serialized document");
      assert.equal(adapter.isValid(fromPath ? text : input), true, `${c.id}: isValid must be true`);
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
      assertNamesPath(c, error, file);
      return;
    }
    case "assessment-period": {
      const document = adapter.parse(inputOf(corpusDir, c));
      const expected = c["expected-period"];
      if (expected === undefined) {
        reports(adapter, c, category, () => adapter.assessmentPeriod(document));
        return;
      }
      const period = adapter.assessmentPeriod(document);
      for (const bound of ["start", "end"] as const) {
        const value = period[bound];
        if (expected[bound] === null) {
          assert.ok(value === undefined || value === null, `${c.id}: the ${bound} of the period is not empty`);
          continue;
        }
        assert.equal(typeof value, "string", `${c.id}: the ${bound} of the period is not a string`);
        assert.equal(normalizeDatetime(value as string), expected[bound], `${c.id}: wrong ${bound}`);
      }
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
    case "element-types": {
      const names: unknown = JSON.parse(fs.readFileSync(path.join(corpusDir, c.expected as string), "utf8"));
      assert.deepEqual(adapter.elementTypes(), names, `${c.id}: the element types differ from ${c.expected}`);
      return;
    }
    case "facade": {
      const form = c["input-form"];
      const file = path.join(corpusDir, c.input);
      const build = () =>
        form === "bytes"
          ? adapter.facadeFromBytes(inputOf(corpusDir, c) as Uint8Array)
          : form === "path"
            ? adapter.facadeFromPath(file)
            : adapter.facade(adapter.parse(inputOf(corpusDir, c)));
      if (category !== undefined) {
        assertNamesPath(c, reports(adapter, c, category, build), file);
        return;
      }
      const view = build();
      const wrapper = JSON.parse(fs.readFileSync(path.join(corpusDir, c.expected as string), "utf8")) as Record<string, unknown>;
      const body = wrapper[c["document-type"] as string] as { metadata: Record<string, unknown>; uuid: string };
      assertCanonicalEqual(corpusDir, c, JSON.stringify(view.wrapper), "the facade wrapper");
      assertElementEqual(c, view.body, body, "the facade body");
      assertElementEqual(c, view.metadata, body.metadata, "the facade metadata");
      assert.equal(view.oscalVersion, body.metadata["oscal-version"], `${c.id}: wrong OSCAL version`);
      assert.equal(view.uuid, body.uuid, `${c.id}: wrong body uuid`);
      return;
    }
    case "build-hash":
    case "build-rlink": {
      const build = () =>
        c.operation === "build-hash"
          ? adapter.buildHash((c.arguments ?? {}) as { value: string; algorithm?: string })
          : adapter.buildRlink((c.arguments ?? {}) as { href: string; "media-type"?: string; hashes?: unknown[] });
      if (category !== undefined) {
        reports(adapter, c, category, build);
        return;
      }
      assertElementEqual(c, build(), c["expected-element"], "the result");
      return;
    }
    case "build-resource": {
      const args = (c.arguments ?? {}) as { key?: string; title?: string; identifier?: string; "document-ids"?: unknown[] };
      if (category !== undefined) {
        reports(adapter, c, category, () => adapter.buildResource(args));
        return;
      }
      const resource = adapter.buildResource(args) as Record<string, unknown>;
      if (c["expected-uuid"] !== undefined) assert.equal(resource.uuid, c["expected-uuid"], `${c.id}: wrong uuid`);
      if (c["expected-element"] !== undefined) {
        let rest = resource;
        if (args.key === undefined && args.identifier === undefined) {
          assert.equal(typeof resource.uuid, "string", `${c.id}: the generated uuid is not a string`);
          assert.match(resource.uuid as string, uuidPattern(corpusDir), `${c.id}: the generated uuid is not a UUID`);
          rest = Object.fromEntries(Object.entries(resource).filter(([key]) => key !== "uuid"));
        }
        assertElementEqual(c, rest, c["expected-element"], "the resource");
      }
      return;
    }
    case "yaml-round-trip": {
      const form = c["input-form"];
      const document =
        form === "path" ? adapter.parseYamlFile(path.join(corpusDir, c.input)) : adapter.parseYaml(inputOf(corpusDir, c));
      assertCanonicalEqual(corpusDir, c, adapter.serialize(document), "the parsed YAML");
      const yaml = adapter.serializeYaml(document);
      const parseAgain = (): unknown =>
        form === "path"
          ? withTempFile(yaml, (file) => adapter.parseYamlFile(file))
          : adapter.parseYaml(form === "bytes" ? new TextEncoder().encode(yaml) : yaml);
      assertCanonicalEqual(corpusDir, c, adapter.serialize(parseAgain()), "the YAML output parsed again");
      const absent = c["expected-absent-keys"];
      if (absent !== undefined) {
        const found = findKey(parseGenericYaml(yaml), absent);
        assert.equal(found, undefined, `${c.id}: the serialized YAML has the key ${found}`);
      }
      return;
    }
    case "yaml-parse-file": {
      const file = path.join(corpusDir, c.input);
      const error = reports(adapter, c, category, () => adapter.parseYamlFile(file));
      assertNamesPath(c, error, file);
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

/** The parsed `expected-failures.json` of the binding (VER-007). */
export const EXPECTED_FAILURES: ExpectedFailures = JSON.parse(
  fs.readFileSync(new URL("../conformance/expected-failures.json", import.meta.url), "utf8"),
) as ExpectedFailures;

/** The cases that `expected-failures.json` does not list. Tests that read corpus inputs directly use only these. */
export const withoutExpectedFailures = (cases: readonly Case[]): Case[] => cases.filter((c) => !(c.id in EXPECTED_FAILURES));

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
