import assert from "node:assert/strict";
import fs from "node:fs";
import { before, test } from "node:test";
import { type Manifest, validateManifest } from "../scripts/manifest.ts";
import { artifactPaths, ensureSpecArtifact, OSCAL_RELEASE } from "../scripts/spec-artifact.ts";

let manifest: Manifest;
let namesSchema: object;
let schemaBytes: Buffer;

before(async () => {
  const paths = artifactPaths(await ensureSpecArtifact());
  manifest = JSON.parse(fs.readFileSync(paths.names, "utf8")) as Manifest;
  namesSchema = JSON.parse(fs.readFileSync(paths.namesSchema, "utf8")) as object;
  schemaBytes = fs.readFileSync(paths.schema);
});

const validate = (m: unknown, overrides: { schemaBytes?: Buffer; release?: string } = {}) =>
  validateManifest({
    manifest: m,
    namesSchema,
    schemaBytes: overrides.schemaBytes ?? schemaBytes,
    release: overrides.release ?? OSCAL_RELEASE,
  });

/** A deep copy of the real manifest, changed by `edit`. */
const changed = (edit: (m: Manifest) => void) => {
  const copy = structuredClone(manifest);
  edit(copy);
  return copy;
};

const entry = (m: Manifest, name: string) => {
  const found = m.types.find((e) => e.name === name);
  assert.ok(found, `no entry ${name}`);
  return found;
};

const assertFails = (failures: string[], pattern: RegExp) => {
  assert.ok(failures.length > 0, "expected the manifest to be invalid");
  assert.ok(
    failures.some((f) => pattern.test(f)),
    `no failure matches ${pattern}:\n${failures.join("\n")}`,
  );
};

test("the released manifest is valid", () => {
  assert.deepEqual(validate(manifest), []);
});

test("NAM-003.01 a name with a non-identifier character is invalid", () => {
  assertFails(validate(changed((m) => (entry(m, "Hash").name = "Bad-Name"))), /\/types\/\d+\/name/);
});

test("NAM-003.03 a name with a final newline is invalid", () => {
  assertFails(validate(changed((m) => (entry(m, "Hash").name = "Hash\n"))), /\/types\/\d+\/name/);
});

test("NAM-003.02 a duplicate name is invalid", () => {
  assertFails(validate(changed((m) => (entry(m, "Hash").name = "Link"))), /the name Link occurs more than once/);
});

test("NAM-003.04 a branch reference to no entry is invalid", () => {
  const m = changed((m) => (entry(m, "CatalogGroup").variants![0].type = "CatalogGroupWithNothing"));
  assertFails(validate(m), /the reference CatalogGroupWithNothing names no entry/);
});

test("NAM-004.03 a variant property that is not a key of its branch is invalid", () => {
  const m = changed((m) => (entry(m, "CatalogGroup").variants![0].property = "parts-of-speech"));
  assertFails(validate(m), /parts-of-speech is not a property of the branch/);
});

test("NAM-003.05 an unknown format version is rejected", () => {
  assertFails(validate(changed((m) => (m.format = 2))), /\/format/);
});

test("NAM-003 rule 5: another OSCAL release is rejected", () => {
  assertFails(validate(manifest, { release: "1.2.4" }), /oscal-release 1\.2\.3 is not 1\.2\.4/);
});

test("NAM-002.03 a schema hash mismatch is detected", () => {
  const other = Buffer.concat([schemaBytes, Buffer.from("\n")]);
  assertFails(validate(manifest, { schemaBytes: other }), /schema\.sha256 .* is not the sha256/);
});

test("NAM-004.02 a schema file name with a path is invalid", () => {
  assertFails(validate(changed((m) => (m.schema.file = "../schema.json"))), /\/schema\/file/);
});

test("NAM-001.03 an unresolvable pointer is invalid", () => {
  const m = changed((m) => (entry(m, "Hash").sites = ["#/definitions/oscal-complete-oscal-metadata:no-such"]));
  assertFails(validate(m), /does not resolve/);
});

test("NAM-001 a __proto__ pointer does not resolve to an inherited member", () => {
  for (const site of ["#/definitions/__proto__", "#/definitions/constructor", "#/__proto__"]) {
    const m = changed((m) => (entry(m, "Hash").sites = [site]));
    assertFails(validate(m), /does not resolve/);
  }
});

test("NAM-004.01 an entry without a kind is invalid", () => {
  const m = changed((m) => delete (entry(m, "Hash") as { kind?: string }).kind);
  assertFails(validate(m), /json-schema/);
});
