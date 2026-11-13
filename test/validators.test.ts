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

test("each distinct pattern of the schema compiles with the pattern engine", () => {
  const patterns = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node === null || typeof node !== "object") return;
    const object = node as Record<string, unknown>;
    if (typeof object.pattern === "string") patterns.add(object.pattern);
    Object.values(object).forEach(walk);
  };
  walk(schema);
  assert.ok(patterns.size > 0);
  for (const pattern of patterns) assert.doesNotThrow(() => validators.regExpEngine(pattern, "u"), pattern);
});

test("the pattern of StringDatatype follows the XSD meaning of white space and of the dot", () => {
  const definitions = (schema as { definitions: Record<string, { pattern?: string }> }).definitions;
  const pattern = definitions["StringDatatype"]?.pattern;
  assert.equal(typeof pattern, "string");
  const regExp = validators.regExpEngine(pattern as string, "u");
  assert.equal(regExp.test("\u3000a"), true);
  assert.equal(regExp.test("a\u2028b"), true);
  assert.equal(regExp.test(" a"), false);
  assert.equal(regExp.test("a\n"), false);
});

test("the pattern engine throws for a white space escape inside a character class", () => {
  assert.throws(() => validators.regExpEngine("^[\\s]+$", "u"), /character class/);
  assert.throws(() => validators.regExpEngine("^[^\\S]+$", "u"), /character class/);
  assert.doesNotThrow(() => validators.regExpEngine("^[a-z\\]]\\s$", "u"));
});

test("documentValidators returns a validator pair for each root key", () => {
  assert.equal(validators.rootKeys.length, 8);
  for (const key of validators.rootKeys) {
    const pair = validators.documentValidators(key);
    assert.equal(typeof pair.failFast, "function", key);
    assert.equal(typeof pair.full, "function", key);
  }
  assert.throws(() => validators.documentValidators("catalog-document"), /not a root key/);
});

test("the fail-fast validator stops at the first error", () => {
  const c = loadCorpus(paths.corpus).cases.find((x) => x.id === "parse/two-failures")!;
  const input = JSON.parse(fs.readFileSync(path.join(paths.corpus, c.input), "utf8")) as unknown;
  const pair = validators.documentValidators("catalog");
  assert.equal(pair.failFast(input), false);
  assert.equal(pair.failFast.errors?.length, 1);
  assert.equal(pair.full(input), false);
  assert.ok((pair.full.errors?.length ?? 0) >= 2);
});

// Nested-union branch selection of a parse error (PRS-014, NAM-020).

type Parse = typeof import("../src/parse.ts");
type ValidateElement = typeof import("../src/validate-element.ts");

const metadata = { title: "T", "last-modified": "2024-01-02T03:04:05Z", version: "1.0", "oscal-version": "1.2.3" };
const catalogWith = (body: object) => ({
  catalog: { uuid: "2f6e5c2a-6b0e-4b8e-9a3e-1c7d0b5f4a10", metadata, ...body },
});
/** The parameter of PRS-014.01: it holds `select`, and `how-many` is not in the closed enum. */
const selectParam = (id = "param-1") => ({ id, select: { "how-many": "seven" } });

/** The failures of the `ParseError` that `parse` throws for a document. Fails the test when `parse` does not throw. */
async function parseFailures(document: unknown) {
  const { parse } = (await import("../src/parse.ts")) as Parse;
  const { ParseError } = await import("../src/errors.ts");
  try {
    parse(JSON.stringify(document));
  } catch (error) {
    assert.ok(error instanceof ParseError);
    return error.failures;
  }
  assert.fail("parse did not throw");
}

/** The entries of the collecting validator of the catalog branch, before branch selection. */
const allEntries = (document: unknown) => validators.collect(validators.documentValidators("catalog").full, document);

test("PRS-014.01: a parameter that selects `select` gives only the failure of that branch", async () => {
  const failures = await parseFailures(catalogWith({ params: [selectParam()] }));
  assert.deepEqual(
    failures.map((f) => f.location),
    ["/catalog/params/0/select/how-many"],
  );
});

test("a union inside a selected branch also gives only the failures of its selected branch", async () => {
  const group = { id: "g-1", title: "G", controls: [{ id: "c-1", title: "C" }], params: [selectParam()] };
  const document = catalogWith({ groups: [group] });
  assert.equal(allEntries(document).length, 5);
  const failures = await parseFailures(document);
  assert.deepEqual(
    failures.map((f) => f.location),
    ["/catalog/groups/0/params/0/select/how-many"],
  );
});

test("a parameter that holds no distinguishing property gives the failures of each branch", async () => {
  const document = catalogWith({ params: [{ id: "param-1", x: 1 }] });
  const failures = await parseFailures(document);
  assert.equal(failures.length, 2);
  assert.deepEqual(failures, allEntries(document));
});

test("a parameter that holds the properties of both branches gives the failures of each branch", async () => {
  const document = catalogWith({ params: [{ ...selectParam(), values: ["a"] }] });
  const failures = await parseFailures(document);
  assert.equal(failures.length, 4);
  assert.deepEqual(failures, allEntries(document));
});

test("NAM-020.01: a catalog group that holds only a title parses", async () => {
  const { parse } = (await import("../src/parse.ts")) as Parse;
  assert.doesNotThrow(() => parse(JSON.stringify(catalogWith({ groups: [{ title: "G" }] }))));
});

test("a group that selects no branch reports the selected branch of a union inside it one time", async () => {
  const failures = await parseFailures(catalogWith({ groups: [{ title: "G", params: [selectParam()] }] }));
  assert.equal(failures.length, 2);
  const param = failures.find((f) => f.location === "/catalog/groups/0/params/0/select/how-many");
  assert.equal(param?.messages.length, 1);
  assert.ok(failures.some((f) => f.location === "/catalog/groups/0"));
});

test("validateElement gives the failures of each branch of a parameter", async () => {
  const { validateElement } = (await import("../src/validate-element.ts")) as ValidateElement;
  const result = validateElement("parameter", selectParam());
  assert.equal(result.valid, false);
  assert.equal(result.failures.length, 3);
});

test("after a failed parse, the validators of the document branch hold no errors", async () => {
  await parseFailures(catalogWith({ params: [selectParam()] }));
  const pair = validators.documentValidators("catalog");
  assert.equal(pair.failFast.errors, null);
  assert.equal(pair.full.errors, null);
});

test("collectSelected of 4000 failing parameters takes at most 5 times as long as collect", () => {
  const document = catalogWith({ params: Array.from({ length: 4000 }, (_, i) => selectParam(`param-${i}`)) });
  const full = validators.documentValidators("catalog").full;
  // The best of three runs of each function, so one slow run does not decide the result.
  const best = (run: () => unknown) =>
    Math.min(
      ...[0, 1, 2].map(() => {
        const start = performance.now();
        run();
        return performance.now() - start;
      }),
    );
  assert.equal(validators.collectSelected(full, document).length, 4000);
  const all = best(() => validators.collect(full, document));
  const selected = best(() => validators.collectSelected(full, document));
  assert.ok(selected <= 5 * all, `collectSelected took ${selected} ms, and collect took ${all} ms`);
});
