import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import type { Adapter, FacadeView } from "./support/adapter.ts";
import { checkListedIds, isPendingCase, loadCorpus, runCase, runWithExpectation, type Case } from "./support/runner.ts";

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
  /** The facade view of the wrapper at `expected`. */
  const view = (): FacadeView => {
    const wrapper = JSON.parse(expectedJson()) as Record<string, { metadata: Record<string, string>; uuid: string }>;
    const body = wrapper[c["document-type"] as string];
    return { wrapper, body, metadata: body.metadata, oscalVersion: body.metadata["oscal-version"], uuid: body.uuid };
  };
  /** A builder that checks its arguments, and then answers from the corpus data of the case. */
  const build = (args: unknown): unknown => {
    assert.deepEqual(args, c.arguments);
    if (throwing) throw new FakeError(c["expected-category"] as string, 1, "the builder fails");
    if (c["expected-uuid"] !== undefined) return { uuid: c["expected-uuid"] };
    const element = structuredClone(c["expected-element"]) as Record<string, unknown>;
    const generated = c.operation === "build-resource" && c.arguments?.key === undefined && c.arguments?.identifier === undefined;
    return generated ? { ...element, uuid: randomUUID() } : element;
  };
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
    facade: view,
    facadeFromBytes: view,
    facadeFromPath: (): FacadeView => (throwing ? fail() : view()),
    buildHash: build,
    buildRlink: build,
    buildResource: build,
    category: (error) => (error as FakeError).category,
    failureCount: (error) => (error as FakeError).count,
  };
}

const byId = (id: string) => corpus.cases.find((c) => c.id === id) as Case;

const firstOf = (operation: string, where: (c: Case) => boolean = () => true) =>
  corpus.cases.find((c) => c.operation === operation && where(c)) as Case;

test("each case passes with the conforming fake adapter", () => {
  for (const c of corpus.cases) if (!isPendingCase(c)) runCase(conforming(c), corpus.dir, c);
});

test("a pending case is one that runCase does not know yet", () => {
  for (const c of corpus.cases.filter(isPendingCase)) {
    assert.throws(() => runCase(conforming(c), corpus.dir, c), /unknown operation|pending: /, c.id);
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
  [
    "build-resource: another uuid",
    firstOf("build-resource", (c) => c["expected-uuid"] !== undefined),
    () => ({ buildResource: () => ({ uuid: "00000000-0000-5000-8000-000000000000" }) }),
  ],
  [
    "build-resource: no error",
    firstOf("build-resource", (c) => c["expected-category"] !== undefined),
    () => ({ buildResource: () => ({}) }),
  ],
  [
    "build-resource: wrong category",
    firstOf("build-resource", (c) => c["expected-category"] !== undefined),
    () => ({ category: () => "other" }),
  ],
  ...(
    [
      ["wrapper", { wrapper: {} }],
      ["body", { body: {} }],
      ["metadata", { metadata: {} }],
      ["oscalVersion", { oscalVersion: "0.0.0" }],
      ["uuid", { uuid: "not-the-uuid" }],
    ] as Array<[string, Partial<FacadeView>]>
  ).map(
    ([field, other]): [string, Case, (a: Adapter, c: Case) => Partial<Adapter>] => [
      `facade: another ${field}`,
      byId("facade/catalog"),
      (a) => ({ facade: (d) => ({ ...a.facade(d), ...other }) }),
    ],
  ),
  [
    "facade: the construction from a parsed document throws",
    byId("facade/catalog"),
    () => ({
      facade: () => {
        throw new Error("x");
      },
    }),
  ],
  [
    "facade: the construction from bytes throws",
    byId("facade/profile"),
    () => ({
      facadeFromBytes: () => {
        throw new Error("x");
      },
    }),
  ],
  [
    "facade: the construction from a path throws",
    byId("facade/component-definition"),
    () => ({
      facadeFromPath: () => {
        throw new Error("x");
      },
    }),
  ],
  [
    "facade: message lacks the path",
    byId("facade/missing-file"),
    () => ({
      facadeFromPath: () => {
        throw new FakeError("not-found", 1, "no such file");
      },
    }),
  ],
  [
    "build-hash: another algorithm",
    byId("build-hash/off-list-algorithm"),
    (a) => ({ buildHash: (args) => ({ ...(a.buildHash(args) as object), algorithm: "SHA-256" }) }),
  ],
  ["build-hash: no error", byId("build-hash/invalid-algorithm"), () => ({ buildHash: () => ({}) })],
  [
    "build-rlink: a media-type in the result",
    byId("build-rlink/reference-only"),
    (a) => ({ buildRlink: (args) => ({ ...(a.buildRlink(args) as object), "media-type": "text/plain" }) }),
  ],
  [
    "build-resource: generated uuid is not a UUID",
    byId("build-resource/generated-identifier"),
    (a) => ({ buildResource: (args) => ({ ...(a.buildResource(args) as object), uuid: "not-a-uuid" }) }),
  ],
  [
    "build-resource: another title",
    byId("build-resource/generated-identifier"),
    (a) => ({ buildResource: (args) => ({ ...(a.buildResource(args) as object), title: "Other Title" }) }),
  ],
  [
    "build-resource: another uuid in the result",
    byId("build-resource/omitted-inputs"),
    (a) => ({
      buildResource: (args) => ({ ...(a.buildResource(args) as object), uuid: "00000000-0000-5000-8000-000000000000" }),
    }),
  ],
  [
    "build-resource: no document-ids given to the builder",
    byId("build-resource/invalid-document-id"),
    () => ({
      buildResource: (args) => {
        if (args["document-ids"] !== undefined) return {};
        throw new FakeError("builder-error", 1, "the builder fails");
      },
    }),
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

test("the facade case of the bytes input form gives raw bytes to the facade", () => {
  const c = byId("facade/profile");
  let seen: unknown;
  const base = conforming(c);
  runCase({ ...base, facadeFromBytes: (i) => ((seen = i), base.facadeFromBytes(i)) }, corpus.dir, c);
  assert.ok(seen instanceof Uint8Array);
  assert.deepEqual(seen, new Uint8Array(fs.readFileSync(path.join(corpus.dir, c.input))));
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
