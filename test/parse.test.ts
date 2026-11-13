import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import { DocumentTypeMismatchError, NotFoundError, OscalError, ParseError } from "../src/errors.ts";
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
} from "../src/parse.ts";
import { rootKeys } from "../src/validators.ts";
import { type Case, loadCorpus } from "./support/runner.ts";

const paths = artifactPaths(await ensureSpecArtifact());
const cases = loadCorpus(paths.corpus).cases;
const read = (c: Case) => fs.readFileSync(path.join(paths.corpus, c.input));

/** The valid corpus documents: the inputs of the round-trip cases. */
const validCases = cases.filter((c) => c.operation === "round-trip");
const invalidCases = cases.filter((c) => c.operation === "parse");

/** The typed parsers by root key. */
const typedParsers = {
  catalog: parseCatalog,
  "mapping-collection": parseMappingCollection,
  profile: parseProfile,
  "component-definition": parseComponentDefinition,
  "system-security-plan": parseSystemSecurityPlan,
  "assessment-plan": parseAssessmentPlan,
  "assessment-results": parseAssessmentResults,
  "plan-of-action-and-milestones": parsePlanOfActionAndMilestones,
};

test("text and bytes of each valid corpus document give equal values", () => {
  assert.ok(validCases.length > 0);
  for (const c of validCases) {
    const bytes = new Uint8Array(read(c));
    assert.deepEqual(parse(bytes), parse(read(c).toString("utf8")), c.id);
  }
});

test("each valid corpus document parses with parse and with the typed parser of its root key", () => {
  assert.deepEqual(Object.keys(typedParsers).sort(), [...rootKeys].sort());
  for (const c of validCases) {
    const text = read(c).toString("utf8");
    const key = Object.keys(JSON.parse(text) as object).find((k) => rootKeys.includes(k)) as string;
    assert.equal(key, c["document-type"], c.id);
    assert.deepEqual(typedParsers[key as keyof typeof typedParsers](text), parse(text), c.id);
    assert.equal(isValid(text), true, c.id);
    assert.equal(isValid(new Uint8Array(read(c))), true, c.id);
  }
});

/** A valid assessment plan whose `tasks` nest `levels` deep. The deepest object is at depth 2 * levels + 2. */
function nestedPlan(levels: number): string {
  const c = validCases.find((x) => x["document-type"] === "assessment-plan") as Case;
  const doc = JSON.parse(read(c).toString("utf8")) as { "assessment-plan": Record<string, unknown> };
  const uuid = "5d6e1c9e-0a5f-4c0b-9d54-2f4a2f3c1b11";
  let task: Record<string, unknown> = { uuid, type: "milestone", title: "t" };
  for (let i = 1; i < levels; i++) task = { uuid, type: "milestone", title: "t", tasks: [task] };
  doc["assessment-plan"].tasks = [task];
  return JSON.stringify(doc);
}

/** `levels` nested arrays inside a catalog-less object. The value is not a document, and the walk stops first. */
const deepArrays = (levels: number) => `{"catalog":${"[".repeat(levels)}${"]".repeat(levels)}}`;

test("ERR-004.03 nested tasks at the nesting depth limit parse, and one level more is a parse error with the limit", () => {
  assert.doesNotThrow(() => parse(nestedPlan(124)));
  assert.equal(isValid(nestedPlan(124)), true);
  assert.throws(
    () => parse(nestedPlan(125)),
    (e) => e instanceof ParseError && e.category === "parse-error" && e.limit === "nesting-depth" && /limit of 250/.test(e.message),
  );
  assert.equal(isValid(nestedPlan(125)), false);
});

test("a depth of 5000 is a parse error, not a RangeError", () => {
  for (const input of [nestedPlan(2500), deepArrays(5000)]) {
    assert.throws(() => parse(input), (e) => e instanceof ParseError && e.failures.length === 0 && e.limit === "nesting-depth");
    assert.equal(isValid(input), false);
  }
});

test("ERR-010.02 a document that fails schema validation is a parse error whose limit is undefined", () => {
  assert.throws(
    () => parseProfile(JSON.stringify({ profile: { not: "a profile" } })),
    (e) => e instanceof ParseError && e.failures.length > 0 && e.limit === undefined && "limit" in e,
  );
});

test("an input with two root keys is a parse error with one entry at the root pointer", () => {
  const c = validCases.find((x) => x["document-type"] === "catalog") as Case;
  const catalog = JSON.parse(read(c).toString("utf8")) as Record<string, unknown>;
  const input = JSON.stringify({ ...catalog, profile: {} });
  assert.throws(
    () => parse(input),
    (e) => e instanceof ParseError && e.failures.length === 1 && e.failures[0].location === "" && /catalog, profile/.test(e.message),
  );
  assert.equal(isValid(input), false);
});

test("an input with no root key is a parse error that says the input names no OSCAL document type", () => {
  for (const input of ['{"$schema":"x"}', "{}", "[]", "7", "null"]) {
    assert.throws(() => parse(input), (e) => e instanceof ParseError && /names no OSCAL document type/.test(e.message), input);
  }
});

test("ERR-009.01 parseCatalog on a profile with an invalid body is a document type mismatch", () => {
  const input = JSON.stringify({ profile: { not: "a profile" } });
  assert.throws(
    () => parseCatalog(input),
    (e) => e instanceof DocumentTypeMismatchError && e instanceof ParseError && e.category === "document-type-mismatch",
  );
  assert.throws(() => parseProfile(input), (e) => e instanceof ParseError && e.category === "parse-error" && e.failures.length > 0);
});

test("ERR-009.02 input that is not valid JSON is a parse error that is not a document type mismatch", () => {
  assert.throws(
    () => parseCatalog("{"),
    (e) => e instanceof ParseError && !(e instanceof DocumentTypeMismatchError) && e.category === "parse-error",
  );
});

test("isValid returns false and does not throw for each invalid corpus input", () => {
  assert.ok(invalidCases.length > 0);
  for (const c of invalidCases) {
    const input = c["input-form"] === "bytes" ? new Uint8Array(read(c)) : read(c).toString("utf8");
    assert.equal(isValid(input), false, c.id);
  }
  assert.equal(isValid(undefined as unknown as string), false);
});

test("parseFile throws an error that is not an OscalError for a directory", () => {
  assert.throws(() => parseFile(os.tmpdir()), (e) => e instanceof Error && !(e instanceof OscalError));
});

test("parseFile throws a NotFoundError for a path through a file", () => {
  const c = validCases[0];
  const file = path.join(paths.corpus, c.input, "x");
  assert.throws(() => parseFile(file), (e) => e instanceof NotFoundError && e.path === file && e.message.includes(file));
});
