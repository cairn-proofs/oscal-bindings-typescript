import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import type { Adapter, FacadeView } from "./support/adapter.ts";
import {
  checkListedIds,
  isPendingCase,
  loadCorpus,
  runCase,
  runWithExpectation,
  unofferedReason,
  type Case,
} from "./support/runner.ts";

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

/** The category tree of ERR-009: the only parent is parse-error, the parent of document-type-mismatch. */
const inTree = (own: string, category: string) =>
  category === own || (own === "document-type-mismatch" && category === "parse-error");

/** An adapter that answers from the corpus data of one case, so the case passes. */
function conforming(c: Case): Adapter {
  /** The one document that each parse of a passing case returns. The serializer gives the expected JSON for it only. */
  const marker = { marker: true };
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
    parse: () => (c.operation === "parse" ? fail() : marker),
    parseTyped: () => (c.operation === "parse-typed" ? fail() : {}),
    parseFile: () => (c.operation === "parse-file" ? fail() : marker),
    parseYamlFile: () => (c.operation === "yaml-parse-file" ? fail() : marker),
    serialize: (document) => (document === marker ? expectedJson() : "{}"),
    isValid: () => c.operation !== "parse",
    validateElement: () => (throwing ? fail() : (c["expected-valid"] as boolean)),
    elementTypes: () => JSON.parse(expectedJson()) as string[],
    assessmentPeriod: () => (throwing ? fail() : (c["expected-period"] as { start: string | null; end: string | null })),
    parseYaml: () => (c.operation === "yaml-parse" ? fail() : marker),
    serializeYaml: () => "",
    facade: view,
    facadeFromBytes: view,
    facadeFromPath: (): FacadeView => (throwing ? fail() : view()),
    buildHash: build,
    buildRlink: build,
    buildResource: build,
    category: (error) => (error as FakeError).category,
    inCategory: (error, category) => inTree((error as FakeError).category, category),
    failureCount: (error) => (error as FakeError).count,
  };
}

const byId = (id: string) => corpus.cases.find((c) => c.id === id) as Case;

const firstOf = (operation: string, where: (c: Case) => boolean = () => true) =>
  corpus.cases.find((c) => c.operation === operation && where(c)) as Case;

test("each case passes with the conforming fake adapter", () => {
  for (const c of corpus.cases) if (!isPendingCase(c) && unofferedReason(c) === undefined) runCase(conforming(c), corpus.dir, c);
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
  ["assessment-period: no error", firstOf("assessment-period"), () => ({ assessmentPeriod: () => ({ start: undefined, end: undefined }) })],
  ["assessment-period: wrong category", firstOf("assessment-period"), () => ({ category: () => "other" })],
  [
    "assessment-period: wrong start",
    byId("assessment-period/mixed-offsets"),
    () => ({ assessmentPeriod: () => ({ start: "2026-03-01T23:00:00-05:00", end: "2026-03-01T23:00:00-05:00" }) }),
  ],
  [
    "assessment-period: wrong end",
    byId("assessment-period/mixed-offsets"),
    () => ({ assessmentPeriod: () => ({ start: "2026-03-02T01:00:00Z", end: "2026-03-02T01:00:00Z" }) }),
  ],
  [
    "assessment-period: no start",
    byId("assessment-period/mixed-offsets"),
    () => ({ assessmentPeriod: () => ({ start: undefined, end: "2026-03-01T23:00:00-05:00" }) }),
  ],
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
  [
    "yaml-parse-file: no error",
    firstOf("yaml-parse-file"),
    (a) => ({ parseYamlFile: () => a.parseYaml("") }),
  ],
  ["yaml-parse-file: wrong category", firstOf("yaml-parse-file"), () => ({ category: () => "other" })],
  [
    "yaml-parse-file: message lacks the path",
    firstOf("yaml-parse-file"),
    () => ({
      parseYamlFile: () => {
        throw new FakeError("not-found", 1, "no such file");
      },
    }),
  ],
  [
    "assessment-period: a datetime for an empty bound",
    byId("assessment-period/at-frequency-only"),
    () => ({ assessmentPeriod: () => ({ start: "2026-03-01T00:00:00Z", end: null }) }),
  ],
  [
    "round-trip: parseFile returns another document",
    byId("round-trip/catalog-path"),
    () => ({ parseFile: () => ({}) }),
  ],
  [
    "yaml-round-trip: parseYamlFile returns another document",
    byId("yaml-round-trip/profile-path"),
    () => ({ parseYamlFile: () => ({}) }),
  ],
  [
    "yaml-round-trip: serializeYaml writes an empty value for an absent key",
    byId("yaml-round-trip/minimal-catalog"),
    () => ({ serializeYaml: () => "catalog:\n  metadata:\n    remarks: ''\n" }),
  ],
  [
    "category tree: parse-error is also in document-type-mismatch",
    byId("parse/not-json"),
    (a) => ({ inCategory: (e, category) => category === "document-type-mismatch" || a.inCategory(e, category) }),
  ],
  [
    "category tree: parse-error is not in parse-error",
    byId("parse/not-json"),
    (a) => ({ inCategory: (e, category) => category !== "parse-error" && a.inCategory(e, category) }),
  ],
  [
    "category tree: document-type-mismatch is not in parse-error",
    byId("parse-typed/wrong-document-type"),
    (a) => ({ inCategory: (e, category) => category !== "parse-error" && a.inCategory(e, category) }),
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

test("the runner normalizes a bound of an assessment period before it compares the bound", () => {
  const c = byId("assessment-period/mixed-offsets");
  const base = conforming(c);
  const start = "2026-03-02T01:00:00+00:00";
  runCase({ ...base, assessmentPeriod: () => ({ ...(c["expected-period"] as { start: string; end: string }), start }) }, corpus.dir, c);
});

test("a parse case of the bytes input form gives raw bytes to the parser", () => {
  const c = firstOf("parse", (x) => x["input-form"] === "bytes");
  let seen: unknown;
  const base = conforming(c);
  assert.throws(() =>
    runCase({ ...base, parse: (i) => ((seen = i), base.parse(i)) }, corpus.dir, { ...c, "expected-category": "other" }),
  );
  assert.ok(seen instanceof Uint8Array);
});

test("round-trip/catalog-path gives the path of the input to parseFile", () => {
  const c = byId("round-trip/catalog-path");
  const seen: string[] = [];
  const base = conforming(c);
  runCase({ ...base, parseFile: (p) => (seen.push(p), base.parseFile(p)) }, corpus.dir, c);
  assert.deepEqual(seen, [path.join(corpus.dir, c.input)]);
});

test("round-trip/catalog-bytes gives bytes to the generic parser and the validity check, and text to the typed parser", () => {
  const c = byId("round-trip/catalog-bytes");
  const seen: Record<string, unknown> = {};
  const base = conforming(c);
  runCase(
    {
      ...base,
      parse: (i) => ((seen.parse = i), base.parse(i)),
      isValid: (i) => ((seen.isValid = i), base.isValid(i)),
      parseTyped: (t, i) => ((seen.parseTyped = i), base.parseTyped(t, i)),
    },
    corpus.dir,
    c,
  );
  assert.ok(seen.parse instanceof Uint8Array);
  assert.ok(seen.isValid instanceof Uint8Array);
  assert.equal(typeof seen.parseTyped, "string");
});

test("yaml-round-trip/profile-path gives the input path, and then a file with the serialized YAML", () => {
  const c = byId("yaml-round-trip/profile-path");
  const calls: Array<{ path: string; content: string | undefined }> = [];
  const base = conforming(c);
  runCase(
    {
      ...base,
      serializeYaml: () => "profile: {}\n",
      parseYamlFile: (p) => {
        calls.push({ path: p, content: fs.existsSync(p) ? fs.readFileSync(p, "utf8") : undefined });
        return base.parseYamlFile(p);
      },
    },
    corpus.dir,
    c,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].path, path.join(corpus.dir, c.input));
  assert.notEqual(calls[1].path, calls[0].path);
  assert.equal(calls[1].content, "profile: {}\n");
  assert.equal(fs.existsSync(calls[1].path), false, "the runner removes the temporary file");
});

test("yaml-round-trip/catalog-bytes gives bytes to both parses, and the second holds the serialized YAML", () => {
  const c = byId("yaml-round-trip/catalog-bytes");
  const seen: unknown[] = [];
  const base = conforming(c);
  runCase(
    { ...base, serializeYaml: () => "catalog: {}\n", parseYaml: (i) => (seen.push(i), base.parseYaml(i)) },
    corpus.dir,
    c,
  );
  assert.equal(seen.length, 2);
  assert.ok(seen[0] instanceof Uint8Array);
  assert.ok(seen[1] instanceof Uint8Array);
  assert.deepEqual(seen[1], new TextEncoder().encode("catalog: {}\n"));
});

test("the runner skips each case of an operation that the binding does not offer", () => {
  const c = byId("yaml-parse-typed/wrong-document-type");
  assert.match(unofferedReason(c) as string, /typed YAML parser/);
  assert.equal(unofferedReason(byId("yaml-parse/syntax-error")), undefined);
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
