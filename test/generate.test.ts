import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { before, test } from "node:test";
import { elementTypeName, generate, validationPointer, yamlTypingProblems } from "../scripts/generate.ts";
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

test("the element-type name has a hyphen before each uppercase letter except the first, and a digit stays in its word", () => {
  assert.equal(elementTypeName("Property"), "property");
  assert.equal(elementTypeName("ParameterSelection"), "parameter-selection");
  assert.equal(elementTypeName("BackMatterResourceBase64"), "back-matter-resource-base64");
});

test("the validator pointer of an enum is the parent of its anyOf or allOf node, and of any other kind its first site", () => {
  const hashAlgorithm = manifest.types.find((e) => e.name === "HashAlgorithm")!;
  assert.equal(
    validationPointer(hashAlgorithm),
    "#/definitions/oscal-complete-oscal-metadata:hash/properties/algorithm",
  );
  const property = manifest.types.find((e) => e.name === "Property")!;
  assert.equal(validationPointer(property), property.sites[0]);
});

test("an enum site that does not end in /anyOf/<n> or /allOf/<n> fails the run and names the entry", () => {
  const types = manifest.types.map((e) =>
    e.name === "HashAlgorithm" ? { ...e, sites: [e.sites[0].replace(/\/anyOf\/1$/, "/oneOf/1")] } : e,
  );
  const result = generate(schema, { ...manifest, types });
  assert.equal(result.output, "");
  assert.equal(result.elementTypes, "");
  assert.ok(
    result.problems.some((p) => p.startsWith("HashAlgorithm:") && p.includes("/anyOf/<n> or /allOf/<n>")),
    `problems: ${result.problems.join("; ")}`,
  );
});

test("two types with the same element-type name fail the run and name both types", () => {
  const property = manifest.types.find((e) => e.name === "Property")!;
  const result = generate(schema, { ...manifest, types: [...manifest.types, { ...property, name: "property" }] });
  assert.equal(result.output, "");
  assert.equal(result.elementTypes, "");
  assert.ok(
    result.problems.some((p) => p.includes("Property and property") && p.includes("property")),
    `problems: ${result.problems.join("; ")}`,
  );
});

/** A copy of the schema with one more definition. */
function withDefinition(name: string, definition: Json): Json {
  const copy = structuredClone(schema) as { definitions: Record<string, Json> };
  copy.definitions[name] = definition;
  return copy as Json;
}

test("the YAML scalar typing check passes on the released schema", () => {
  assert.deepEqual(yamlTypingProblems(schema), []);
});

test("a type keyword with two types fails the run and names the keyword", () => {
  const result = generate(withDefinition("two-types", { type: ["string", "number"] }), manifest);
  assert.equal(result.output, "");
  assert.equal(result.elementTypes, "");
  assert.ok(
    result.problems.some((p) => p.startsWith("#/definitions/two-types:") && p.includes("more than one type")),
    `problems: ${result.problems.join("; ")}`,
  );
});

test("a union that permits a string and another scalar type fails the run and names the union", () => {
  const union: Json = { anyOf: [{ type: "string" }, { $ref: "#/definitions/number-branch" }] };
  const copy = withDefinition("string-or-number", union) as { definitions: Record<string, Json> };
  copy.definitions["number-branch"] = { type: "number" };
  const result = generate(copy, manifest);
  assert.equal(result.output, "");
  assert.equal(result.elementTypes, "");
  assert.ok(
    result.problems.some((p) => p === "#/definitions/string-or-number/anyOf: the union permits a string and another scalar type: string, number"),
    `problems: ${result.problems.join("; ")}`,
  );
});

test("a property that two branches of a union define with different schemas fails the run and names the property", () => {
  const branch = (type: string) => ({ type: "object", properties: { value: { type } } });
  const result = generate(withDefinition("two-values", { oneOf: [branch("string"), branch("number")] }), manifest);
  assert.equal(result.output, "");
  assert.equal(result.elementTypes, "");
  assert.ok(
    result.problems.some((p) => p.startsWith("#/definitions/two-values/oneOf:") && p.includes("the property value")),
    `problems: ${result.problems.join("; ")}`,
  );
});

test("a property that two branches of a union define with the same schema passes the check", () => {
  const branch = (extra: string) => ({ type: "object", properties: { value: { type: "string" }, [extra]: { type: "string" } } });
  assert.deepEqual(yamlTypingProblems(withDefinition("same-values", { oneOf: [branch("a"), branch("b")] })), []);
});

test("the committed element-type table is the generator output", () => {
  assert.equal(fs.readFileSync("src/generated/element-types.ts", "utf8"), generate(schema, manifest).elementTypes);
});

test("the committed schema copy has the sha256 of the manifest", () => {
  const actual = createHash("sha256").update(fs.readFileSync("src/generated/oscal-complete-schema.json")).digest("hex");
  assert.equal(actual, manifest.schema.sha256);
});
