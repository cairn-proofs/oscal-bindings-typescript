import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { before, test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import { compile, constraintFailures, loadManifest } from "../src/constraints.ts";
import { ParseError } from "../src/errors.ts";
import {
  isValid,
  parse,
  parseAssessmentPlan,
  parseAssessmentResults,
  parseCatalog,
  parseComponentDefinition,
  parseFile,
  parseMappingCollection,
  parsePlanOfActionAndMilestones,
  parseProfile,
  parseSystemSecurityPlan,
  parseYaml,
  parseYamlFile,
} from "../src/parse.ts";

interface ManifestEntry {
  id: string | null;
  context: { document: string[] };
  target: string[];
  "key-fields"?: { target: string[] }[];
  test?: string;
}

let entries: ManifestEntry[];
let documents: string;

before(async () => {
  const paths = artifactPaths(await ensureSpecArtifact());
  entries = (JSON.parse(fs.readFileSync(paths.constraints, "utf8")) as { entries: ManifestEntry[] }).entries;
  documents = paths.documents;
});

test("each document, target, key and test query of the manifest compiles", () => {
  const descKeys = new Set<string>();
  let count = 0;
  for (const entry of entries) {
    const queries = [
      ...entry.context.document,
      ...entry.target,
      ...(entry["key-fields"] ?? []).flatMap((field) => field.target),
      ...(entry.test === undefined ? [] : [entry.test]),
    ];
    for (const query of queries) {
      compile(query, descKeys);
      count += 1;
    }
  }
  assert.ok(count >= entries.length);
  assert.doesNotThrow(() => loadManifest());
});

test("the compiler throws, with the query in the message, for a slice, for `..[*]` and for a function other than match", () => {
  for (const query of ["$[0:2]", "$..[*]", "$[?length(@['a']) == 1]"]) {
    assert.throws(
      () => compile(query, new Set()),
      (error: Error) => error.message.includes(query),
      query,
    );
  }
});

test("a valid document of the corpus has no constraint failure", () => {
  const dir = path.join(documents, "valid");
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
  assert.ok(files.length > 0);
  for (const file of files) {
    const value = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as unknown;
    assert.deepEqual(constraintFailures(value), [], file);
  }
});

const CASE = "oscal-catalog-metadata-prop-name";
const inputOf = (name: string) =>
  fs.readFileSync(path.join(documents, "invalid", "constraints", `${name}.json`), "utf8");

function parseError(run: () => unknown): ParseError {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof ParseError, String(error));
    return error;
  }
  return assert.fail("the call did not throw");
}

test("PRS-015 parse, parseYaml and a typed parser give a ParseError whose entries name the constraints", () => {
  const input = inputOf(CASE);
  for (const run of [() => parse(input), () => parseYaml(input), () => parseCatalog(input)]) {
    const error = parseError(run);
    assert.equal(error.category, "parse-error");
    assert.equal(error.limit, undefined);
    assert.deepEqual(error.failures.map((f) => f.constraint).sort(), [
      "oscal-catalog-metadata-prop-name",
      "oscal-metadata-prop-name-values",
      "oscal-metadata-prop-name-values",
    ]);
    for (const failure of error.failures) {
      assert.ok(failure.location.startsWith("/catalog/metadata"), failure.location);
      assert.ok(failure.messages.length === 1 && failure.messages[0].includes(failure.constraint!));
    }
  }
});

test("PRS-015 two failures of one location give two entries", () => {
  const error = parseError(() => parse(inputOf(CASE)));
  const locations = error.failures.map((f) => f.location);
  assert.ok(new Set(locations).size < locations.length, locations.join(", "));
});

test("PRS-015.02 a document that fails the schema gives no entry with a constraint", () => {
  const document = JSON.parse(inputOf(CASE)) as { catalog: { metadata: Record<string, unknown> } };
  document.catalog.metadata.colour = "blue";
  const error = parseError(() => parse(JSON.stringify(document)));
  assert.ok(error.failures.length > 0);
  assert.ok(error.failures.every((f) => f.constraint === undefined));
});

test("PRS-015.03 isValid is false for the input of a constraint case and true for a valid document", () => {
  assert.equal(isValid(inputOf(CASE)), false);
  const valid = path.join(documents, "valid");
  const file = fs.readdirSync(valid).find((name) => name.endsWith(".json"))!;
  assert.equal(isValid(fs.readFileSync(path.join(valid, file), "utf8")), true);
});

test("PRS-015 the typed parsers, parseFile, parseYaml and parseYamlFile give the failures of parse for each constraint document", () => {
  const typed: Record<string, (input: string) => unknown> = {
    catalog: parseCatalog,
    "mapping-collection": parseMappingCollection,
    profile: parseProfile,
    "component-definition": parseComponentDefinition,
    "system-security-plan": parseSystemSecurityPlan,
    "assessment-plan": parseAssessmentPlan,
    "assessment-results": parseAssessmentResults,
    "plan-of-action-and-milestones": parsePlanOfActionAndMilestones,
  };
  const dir = path.join(documents, "invalid", "constraints");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "constraints-test-"));
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
  assert.ok(files.length > 0);
  for (const name of files) {
    const input = fs.readFileSync(path.join(dir, name), "utf8");
    const expected = parseError(() => parse(input)).failures;
    assert.ok(expected.length > 0 && expected.every((f) => f.constraint !== undefined), name);
    const rootKey = Object.keys(JSON.parse(input) as object)[0];
    const copy = path.join(tmp, name);
    fs.writeFileSync(copy, input);
    const runs = [
      () => typed[rootKey](input),
      () => parseFile(copy),
      () => parseYaml(input),
      () => parseYamlFile(copy),
    ];
    for (const run of runs) assert.deepEqual(parseError(run).failures, expected, name);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("a schema failure has no constraint, also for the typed parsers", () => {
  const error = parseError(() => parseCatalog('{"catalog": {}}'));
  assert.ok(error.failures.length > 0);
  assert.ok(error.failures.every((f) => f.constraint === undefined));
});
