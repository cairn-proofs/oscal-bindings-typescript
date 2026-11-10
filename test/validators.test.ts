import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, test } from "node:test";
import { type Json, type Manifest, resolvePointer } from "../scripts/manifest.ts";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import { loadCorpus } from "./support/runner.ts";

type Validators = typeof import("../src/validators.ts");

const paths = artifactPaths(await ensureSpecArtifact());
const manifest = JSON.parse(fs.readFileSync(paths.names, "utf8")) as Manifest;
const schema = JSON.parse(fs.readFileSync("src/generated/oscal-complete-schema.json", "utf8")) as Json;

// The module loads, and each validator compiles, while the console methods record their calls.
const consoleCalls: string[] = [];
let validators: Validators;

before(async () => {
  const methods = ["debug", "error", "info", "log", "warn"] as const;
  const saved = methods.map((m) => console[m]);
  for (const m of methods) console[m] = (...args: unknown[]) => void consoleCalls.push(`console.${m}: ${args.join(" ")}`);
  try {
    validators = await import("../src/validators.ts");
    for (const row of validators.elementTypes) validators.validatorFor(row.typeName);
  } finally {
    methods.forEach((m, i) => {
      console[m] = saved[i];
    });
  }
});

/** The PascalCase type name that the element-type name of design D4 came from. */
const typeNameOf = (elementType: string) =>
  elementType
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");

test("validatorFor compiles a validator for each manifest type", () => {
  assert.equal(validators.elementTypes.length, manifest.types.length);
  assert.deepEqual(
    validators.elementTypes.map((row) => row.typeName).sort(),
    manifest.types.map((e) => e.name).sort(),
  );
  for (const row of validators.elementTypes) {
    assert.equal(typeof validators.validatorFor(row.typeName), "function", row.typeName);
  }
});

test("validatorFor throws for a name that is not in the manifest", () => {
  assert.throws(() => validators.validatorFor("NoSuchType"), /NoSuchType/);
  // The element-type name is not a canonical type name.
  assert.throws(() => validators.validatorFor("back-matter"), /back-matter/);
});

test("the element-type names are unique, and each maps back to its canonical type name", () => {
  const names = validators.elementTypes.map((row) => row.elementType);
  assert.equal(new Set(names).size, names.length);
  for (const row of validators.elementTypes) {
    assert.match(row.elementType, /^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/, row.elementType);
    assert.equal(typeNameOf(row.elementType), row.typeName);
  }
});

test("each validator of a corpus element gives the validity result of its case", () => {
  const cases = loadCorpus(paths.corpus).cases.filter(
    (c) => c.operation === "validate-element" && c["expected-valid"] !== undefined,
  );
  assert.ok(cases.length > 0, "the corpus has no validate-element case with expected-valid");
  for (const c of cases) {
    const row = validators.elementTypes.find((r) => r.elementType === c["element-type"]);
    assert.ok(row, `${c.id}: no element type ${c["element-type"]}`);
    const element = JSON.parse(fs.readFileSync(path.join(paths.corpus, c.input), "utf8")) as unknown;
    const validate = validators.validatorFor(row.typeName);
    assert.equal(validate(element), c["expected-valid"], `${c.id}: ${JSON.stringify(validate.errors)}`);
  }
});

test("an open enum accepts an off-list value of its base datatype, and a closed enum rejects one", () => {
  const listed = (typeName: string) => {
    const site = manifest.types.find((e) => e.name === typeName)!.sites[0];
    const node = resolvePointer(schema, site) as { enum: string[] };
    return node.enum[0];
  };
  const open = validators.validatorFor("HashAlgorithm");
  assert.equal(open(listed("HashAlgorithm")), true);
  assert.equal(open("a-value-that-the-enum-does-not-list"), true);
  assert.equal(open(7), false);

  const closed = validators.validatorFor("FindingTargetType");
  assert.equal(closed(listed("FindingTargetType")), true);
  assert.equal(closed("a-value-that-the-enum-does-not-list"), false);
});

test("the module load and the compile of each validator write nothing to the console", () => {
  assert.deepEqual(consoleCalls, []);
});
