import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import type { CatalogDocument } from "../src/generated/oscal.ts";
import { parse } from "../src/parse.ts";
import { serialize } from "../src/serialize.ts";
import { loadCorpus } from "./support/runner.ts";

const paths = artifactPaths(await ensureSpecArtifact());
const roundTripCases = loadCorpus(paths.corpus).cases.filter((c) => c.operation === "round-trip");
const documents = roundTripCases.map((c) => ({
  id: c.id,
  document: parse(fs.readFileSync(path.join(paths.corpus, c.input))),
}));

test("the default output of each parsed corpus document has line breaks and an indent of 2 spaces (SER-003)", () => {
  assert.ok(documents.length > 0);
  for (const { id, document } of documents) {
    const output = serialize(document);
    assert.match(output, /\n/, id);
    assert.match(output, /\n {2}"/, id);
    assert.equal(output, JSON.stringify(JSON.parse(output), null, 2), id);
  }
});

test("the compact output has no whitespace between tokens, and both forms give equal values (SER-001, SER-003)", () => {
  for (const { id, document } of documents) {
    const compact = serialize(document, { compact: true });
    assert.equal(compact, JSON.stringify(JSON.parse(compact)), id);
    assert.deepEqual(JSON.parse(compact), JSON.parse(serialize(document)), id);
    assert.deepEqual(JSON.parse(compact), document, id);
  }
});

test("an optional field set to undefined is absent from the default output and the compact output (SER-002)", () => {
  const document: CatalogDocument = {
    catalog: {
      uuid: "5d6e1c9e-0a5f-4c0b-9d54-2f4a2f3c1b11",
      metadata: {
        title: "t",
        "last-modified": "2024-01-02T03:04:05Z",
        version: "1",
        "oscal-version": "1.2.3",
        remarks: undefined,
      },
      groups: undefined,
    },
  };
  for (const output of [serialize(document), serialize(document, { compact: true })]) {
    assert.doesNotMatch(output, /remarks|groups|null|undefined/);
    assert.deepEqual(Object.keys(JSON.parse(output).catalog).sort(), ["metadata", "uuid"]);
  }
});
