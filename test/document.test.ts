import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import { OscalDoc } from "../src/document.ts";
import { NotFoundError, ParseError } from "../src/errors.ts";
import type { OscalDocument } from "../src/generated/oscal.ts";
import { parse } from "../src/parse.ts";
import { rootKeys } from "../src/validators.ts";
import { type Case, loadCorpus } from "./support/runner.ts";

const paths = artifactPaths(await ensureSpecArtifact());
const cases = loadCorpus(paths.corpus).cases;
const read = (c: Case) => fs.readFileSync(path.join(paths.corpus, c.input));

/** The valid corpus documents: the inputs of the round-trip cases. */
const validCases = cases.filter((c) => c.operation === "round-trip");

const rootKeyOf = (doc: object) => Object.keys(doc).find((k) => rootKeys.includes(k)) as string;

test("fromJson wraps each valid corpus document: the wrapper is the parsed document and the body is the root value (FAC-001.01, FAC-003.01)", () => {
  assert.ok(validCases.length > 0);
  for (const c of validCases) {
    const bytes = new Uint8Array(read(c));
    const parsed = parse(bytes);
    for (const doc of [OscalDoc.fromJson(bytes), OscalDoc.fromJson(read(c).toString("utf8"))]) {
      assert.deepEqual(doc.wrapper, parsed, c.id);
      assert.equal(doc.body, (doc.wrapper as unknown as Record<string, unknown>)[rootKeyOf(parsed)], c.id);
    }
  }
});

test("the corpus has a valid document of each of the eight types", () => {
  assert.deepEqual(new Set(validCases.map((c) => c["document-type"])), new Set(rootKeys));
});

test("metadata, oscalVersion, and uuid return the values of the body for each valid corpus document (FAC-002.01, FAC-002.02)", () => {
  for (const c of validCases) {
    const doc = OscalDoc.fromJson(new Uint8Array(read(c)));
    const body = doc.body as unknown as { uuid: string; metadata: { "oscal-version": string } };
    assert.equal(doc.metadata, body.metadata, c.id);
    assert.equal(doc.oscalVersion, body.metadata["oscal-version"], c.id);
    assert.equal(doc.uuid, body.uuid, c.id);
  }
});

test("the constructor throws a TypeError and wraps nothing for a value that is not a document wrapper (FAC-001.02)", () => {
  const catalog = { catalog: { uuid: "u", metadata: {} } };
  const values: unknown[] = [
    null,
    undefined,
    [],
    [catalog],
    "catalog",
    7,
    {},
    { $schema: "x" },
    { ...catalog, profile: { uuid: "u", metadata: {} } },
    { catalog: null },
    { catalog: [] },
    { catalog: "x" },
  ];
  for (const value of values) {
    assert.throws(() => new OscalDoc(value as OscalDocument), TypeError, JSON.stringify(value));
  }
});

test("the constructor wraps a plain wrapper that holds $schema", () => {
  const wrapper = { $schema: "x", catalog: { uuid: "u", metadata: { "oscal-version": "1.2.3" } } };
  const doc = new OscalDoc(wrapper as unknown as OscalDocument);
  assert.equal(doc.wrapper, wrapper);
  assert.equal(doc.uuid, "u");
  assert.equal(doc.oscalVersion, "1.2.3");
});

test("fromFile wraps a valid file, and throws a NotFoundError that names a missing path (FAC-003.02)", () => {
  const c = validCases[0];
  const file = path.join(paths.corpus, c.input);
  assert.deepEqual(OscalDoc.fromFile(file).wrapper, parse(read(c)));
  const missing = path.join(os.tmpdir(), "oscal-doc-does-not-exist.json");
  assert.throws(() => OscalDoc.fromFile(missing), (e) => e instanceof NotFoundError && e.path === missing);
});

test("fromJson passes through the error of parse", () => {
  assert.throws(() => OscalDoc.fromJson("{"), ParseError);
  assert.throws(() => OscalDoc.fromJson("{}"), ParseError);
});
