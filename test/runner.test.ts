import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import type { Adapter } from "./support/adapter.ts";
import { checkListedIds, loadCorpus, PENDING_OPERATIONS, runCase, runWithExpectation, type Case } from "./support/runner.ts";

const corpus = loadCorpus(artifactPaths(await ensureSpecArtifact()).corpus);

class FakeError extends Error {
  constructor(
    readonly category: string,
    readonly count: number,
    message: string,
  ) {
    super(message);
  }
}

/** An adapter that answers from the corpus data of one case, so the case passes. */
function conforming(c: Case): Adapter {
  const fail = (): never => {
    throw new FakeError(c["expected-category"] as string, c["expected-min-failures"] ?? 1, `fails at ${path.join(corpus.dir, c.input)}`);
  };
  const expectedJson = () => fs.readFileSync(path.join(corpus.dir, c.expected as string), "utf8");
  const throwing = c["expected-category"] !== undefined;
  return {
    parse: () => (c.operation === "parse" || c.operation === "yaml-parse" ? fail() : {}),
    parseTyped: () => (c.operation === "parse-typed" ? fail() : {}),
    parseFile: fail,
    serialize: () => expectedJson(),
    isValid: () => c.operation !== "parse",
    validateElement: () => (throwing ? fail() : (c["expected-valid"] as boolean)),
    elementTypes: () => JSON.parse(expectedJson()) as string[],
    assessmentPeriod: fail,
    parseYaml: () => (c.operation === "yaml-parse" ? fail() : {}),
    serializeYaml: () => "",
    category: (error) => (error as FakeError).category,
    failureCount: (error) => (error as FakeError).count,
  };
}

const firstOf = (operation: string, where: (c: Case) => boolean = () => true) =>
  corpus.cases.find((c) => c.operation === operation && where(c)) as Case;

test("each case passes with the conforming fake adapter", () => {
  for (const c of corpus.cases) if (!PENDING_OPERATIONS.has(c.operation)) runCase(conforming(c), corpus.dir, c);
});

test("a pending operation is one that runCase does not know yet", () => {
  for (const operation of PENDING_OPERATIONS) {
    const c = firstOf(operation);
    assert.throws(() => runCase(conforming(c), corpus.dir, c), /unknown operation/, operation);
  }
});

/** Each entry changes one answer of the conforming adapter. The case must then fail. */
const changes: Array<[string, Case, (a: Adapter, c: Case) => Partial<Adapter>]> = [
  ["round-trip: serialize gives other bytes", firstOf("round-trip"), () => ({ serialize: () => "{}" })],
  ["round-trip: isValid gives false", firstOf("round-trip"), () => ({ isValid: () => false })],
  [
    "round-trip: parse fails",
    firstOf("round-trip"),
    () => ({
      parse: () => {
        throw new Error("x");
      },
    }),
  ],
  [
    "round-trip: parseTyped fails",
    firstOf("round-trip"),
    () => ({
      parseTyped: () => {
        throw new Error("x");
      },
    }),
  ],
  ["parse: no error", firstOf("parse"), () => ({ parse: () => ({}) })],
  ["parse: wrong category", firstOf("parse"), () => ({ category: () => "other" })],
  ["parse: isValid gives true", firstOf("parse"), () => ({ isValid: () => true })],
  [
    "parse: too few failure entries",
    firstOf("parse", (c) => c["expected-min-failures"] !== undefined && c["expected-min-failures"] > 1),
    () => ({ failureCount: () => 1 }),
  ],
  [
    "parse: too many failure entries",
    firstOf("parse", (c) => c["expected-max-failures"] !== undefined),
    (_a, c) => ({ failureCount: () => (c["expected-max-failures"] as number) + 1 }),
  ],
  ["parse-typed: no error", firstOf("parse-typed"), () => ({ parseTyped: () => ({}) })],
  ["parse-typed: wrong category", firstOf("parse-typed"), () => ({ category: () => "other" })],
  [
    "parse-file: message lacks the path",
    firstOf("parse-file"),
    () => ({
      parseFile: () => {
        throw new FakeError("not-found", 1, "no such file");
      },
    }),
  ],
  ["parse-file: wrong category", firstOf("parse-file"), () => ({ category: () => "other" })],
  ["assessment-period: no error", firstOf("assessment-period"), () => ({ assessmentPeriod: () => ({}) })],
  ["assessment-period: wrong category", firstOf("assessment-period"), () => ({ category: () => "other" })],
  [
    "validate-element: wrong validity",
    firstOf("validate-element", (c) => c["expected-valid"] !== undefined),
    (_a, c) => ({ validateElement: () => !c["expected-valid"] }),
  ],
  [
    "validate-element: no error",
    firstOf("validate-element", (c) => c["expected-category"] !== undefined),
    () => ({ validateElement: () => true }),
  ],
  [
    "validate-element: wrong category",
    firstOf("validate-element", (c) => c["expected-category"] !== undefined),
    () => ({ category: () => "other" }),
  ],
  [
    "element-types: one name less",
    firstOf("element-types"),
    (a) => ({ elementTypes: () => a.elementTypes().slice(1) }),
  ],
  [
    "element-types: one name more",
    firstOf("element-types"),
    (a) => ({ elementTypes: () => [...a.elementTypes(), "extra-name"] }),
  ],
  [
    "element-types: two names change position",
    firstOf("element-types"),
    (a) => {
      const names = [...a.elementTypes()];
      [names[0], names[1]] = [names[1], names[0]];
      return { elementTypes: () => names };
    },
  ],
  ["yaml-round-trip: first output differs", firstOf("yaml-round-trip"), () => ({ serialize: () => "{}" })],
  [
    "yaml-round-trip: output parsed again differs",
    firstOf("yaml-round-trip"),
    (a) => {
      let calls = 0;
      return { serialize: (d) => (++calls === 1 ? a.serialize(d) : "{}") };
    },
  ],
  ["yaml-parse: no error", firstOf("yaml-parse"), () => ({ parseYaml: () => ({}) })],
  ["yaml-parse: wrong category", firstOf("yaml-parse"), () => ({ category: () => "other" })],
];

for (const [name, c, change] of changes) {
  test(`a changed answer fails the case: ${name}`, () => {
    const base = conforming(c);
    const changed = { ...base, ...change(base, c) };
    assert.throws(() => runCase(changed, corpus.dir, c));
  });
}

test("a case of the corpus has the bytes input form that the runner passes as bytes", () => {
  const c = corpus.cases.find((x) => x["input-form"] === "bytes") as Case;
  let seen: unknown;
  const base = conforming(c);
  assert.throws(() =>
    runCase({ ...base, parse: (i) => ((seen = i), base.parse(i)), parseYaml: (i) => ((seen = i), base.parseYaml(i)) }, corpus.dir, {
      ...c,
      "expected-category": "other",
    }),
  );
  assert.ok(seen instanceof Uint8Array);
});

test("expected failures: a listed case that fails passes", () => {
  const c = firstOf("parse");
  const failing: Adapter = { ...conforming(c), parse: () => ({}) };
  runWithExpectation({ [c.id]: "x" }, c, () => runCase(failing, corpus.dir, c));
});

test("expected failures: a listed case that passes fails", () => {
  const c = firstOf("parse");
  assert.throws(() => runWithExpectation({ [c.id]: "x" }, c, () => runCase(conforming(c), corpus.dir, c)), /Remove its entry/);
});

test("expected failures: an unlisted case that fails fails", () => {
  const c = firstOf("parse");
  const failing: Adapter = { ...conforming(c), parse: () => ({}) };
  assert.throws(() => runWithExpectation({}, c, () => runCase(failing, corpus.dir, c)));
});

test("expected failures: a listed id that is not in the corpus fails", () => {
  assert.throws(() => checkListedIds({ "no/such-case": "x" }, corpus.cases), /no\/such-case/);
  checkListedIds({ [corpus.cases[0].id]: "x" }, corpus.cases);
});
