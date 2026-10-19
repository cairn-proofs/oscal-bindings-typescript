import assert from "node:assert/strict";
import fs from "node:fs";
import { before, test } from "node:test";
import { generate } from "../scripts/generate.ts";
import type { Json, Manifest } from "../scripts/manifest.ts";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";

let schema: Json;
let manifest: Manifest;

before(async () => {
  const paths = artifactPaths(await ensureSpecArtifact());
  schema = JSON.parse(fs.readFileSync(paths.schema, "utf8")) as Json;
  manifest = JSON.parse(fs.readFileSync(paths.names, "utf8")) as Manifest;
});

test("the released manifest covers every place: zero gaps and zero problems", () => {
  const result = generate(schema, manifest);
  assert.deepEqual(result.gaps, []);
  assert.deepEqual(result.problems, []);
});

test("the output exports exactly the manifest names and no other name", () => {
  const { output } = generate(schema, manifest);
  const exported = [...output.matchAll(/^export (?:interface|type) ([A-Za-z0-9]+)\b/gm)].map((m) => m[1]).sort();
  const names = manifest.types.map((e) => e.name).sort();
  assert.equal(exported.length, 244);
  assert.deepEqual(exported, names);
});

test("two runs give byte-identical output", () => {
  assert.equal(generate(schema, manifest).output, generate(schema, manifest).output);
});

test("the committed file is the generator output", () => {
  assert.equal(fs.readFileSync("src/generated/oscal.ts", "utf8"), generate(schema, manifest).output);
});

test("a missing entry is a gap: the run fails, names the pointer, and generates nothing", () => {
  const site = "#/definitions/oscal-complete-oscal-assessment-common:task/properties/timing/anyOf/0/properties/on-date";
  const onDate = manifest.types.find((e) => e.name === "TaskTimingOnDate");
  assert.ok(onDate?.sites.includes(site), `TaskTimingOnDate is not at ${site}`);
  const without = { ...manifest, types: manifest.types.filter((e) => e.name !== "TaskTimingOnDate") };
  const result = generate(schema, without);
  assert.equal(result.output, "");
  assert.ok(result.gaps.includes(site), `gaps: ${result.gaps.join(", ")}`);
});
