/**
 * Tests of the YAML operations that the conformance corpus does not cover (design.md D7 of the add-yaml-documents
 * change). A test name starts with the identifier of its scenario where the test has one.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseAllDocuments } from "yaml";
import { NotFoundError, ParseError, ReadError } from "../src/errors.ts";
import type { CatalogDocument, ComponentDefinitionDocument } from "../src/generated/oscal.ts";
import { parse, parseYaml, parseYamlFile } from "../src/parse.ts";
import { serializeYaml } from "../src/serialize.ts";
import { yamlToJson } from "../src/yaml.ts";
import { canonicalize } from "./support/canonical-json.ts";

const METADATA = `    title: t
    last-modified: 2024-01-02T03:04:05Z
    version: "1"
    oscal-version: 1.2.3`;

/** A minimal catalog. `extra` holds lines that follow the metadata, with an indent of 2 spaces. */
const catalog = (extra = "") =>
  `catalog:\n  uuid: 2f6e5c2a-6b0e-4b8e-9a3e-1c7d0b5f4a10\n  metadata:\n${METADATA}\n${extra}`;

/**
 * A minimal component definition with one port range. `ranges` holds the lines of the port ranges, `metadataExtra` the
 * lines that follow the metadata, and `componentExtra` the lines that follow the protocols of the component.
 */
const componentDefinition = (ranges: string, metadataExtra = "", componentExtra = "") => `component-definition:
  uuid: 2f6e5c2a-6b0e-4b8e-9a3e-1c7d0b5f4a11
  metadata:
${METADATA}
${metadataExtra}
  components:
    - uuid: 2f6e5c2a-6b0e-4b8e-9a3e-1c7d0b5f4a12
      type: service
      title: c
      description: d
      protocols:
        - name: https
          port-ranges:
${ranges}
${componentExtra}`;

/** The error that an action throws. Fails the test when the action does not throw. */
function thrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return assert.fail("the action did not throw");
}

/** The error of a parse, as a `ParseError`. */
function parseError(action: () => unknown): ParseError {
  const error = thrown(action);
  assert.ok(error instanceof ParseError, `expected a ParseError, got ${String(error)}`);
  return error;
}

/** The body of a catalog that `parseYaml` returns. */
const catalogOf = (input: string) => (parseYaml(input) as CatalogDocument).catalog;

const locationsOf = (error: ParseError) => error.failures.map((entry) => entry.location);

test("YML-003.01 a nested structure reads as an object with an array of objects, in order", () => {
  const body = catalogOf(catalog("  params:\n    - id: a\n      values: [x, y]\n    - id: b\n"));
  assert.deepEqual(body.params?.map((param) => param.id), ["a", "b"]);
  assert.deepEqual(body.params?.[0].values, ["x", "y"]);
});

test("YML-005.01 a valid YAML document in bytes gives the typed document value", () => {
  const document = parseYaml(new TextEncoder().encode(catalog())) as CatalogDocument;
  assert.equal(document.catalog.metadata.title, "t");
});

test("YML-005.02 a YAML input and a JSON document of the same value give equal results", () => {
  const json = JSON.stringify({
    catalog: {
      uuid: "2f6e5c2a-6b0e-4b8e-9a3e-1c7d0b5f4a10",
      metadata: { title: "t", "last-modified": "2024-01-02T03:04:05Z", version: "1", "oscal-version": "1.2.3" },
    },
  });
  assert.deepEqual(parseYaml(catalog()), parse(json));
});

test("a value that is not text or bytes gives the ParseError of the JSON parse", () => {
  const error = parseError(() => parseYaml(42 as unknown as string));
  assert.equal(error.message, parseError(() => parse(42 as unknown as string)).message);
});

test("YML-010.01 a scalar that matches no grammar gives one entry for its location", () => {
  const error = parseError(() => parseYaml(componentDefinition("            - {start: 0x1BB, end: 0x1BC}")));
  const base = "/component-definition/components/0/protocols/0/port-ranges/0";
  assert.deepEqual(locationsOf(error), [`${base}/start`, `${base}/end`]);
});

test("a number that fails its grammar and an unknown field in one document give an entry for each location", () => {
  const error = parseError(() =>
    parseYaml(componentDefinition("            - {start: 0x1BB}", "    colour: blue")),
  );
  assert.deepEqual(locationsOf(error).sort(), [
    "/component-definition/components/0/protocols/0/port-ranges/0/start",
    "/component-definition/metadata/colour",
  ]);
});

test("YML-009.01 an alias is read at its own location", () => {
  const input = componentDefinition(
    "            - {start: &n 443, end: 443}",
    "",
    "      props:\n        - {name: a, value: *n}",
  );
  const component = (parseYaml(input) as ComponentDefinitionDocument)["component-definition"].components?.[0];
  assert.equal(component?.protocols?.[0]["port-ranges"]?.[0].start, 443);
  assert.equal(component?.props?.[0].value, "443");
});

test("an alias in an anchored node binds to the anchor before it, also when a later anchor has the same name", () => {
  const resource = [
    "      - uuid: 2f6e5c2a-6b0e-4b8e-9a3e-1c7d0b5f4a14",
    "        title: &x one",
    "        description: &y [*x]",
    "        remarks: &x two",
    "        citation: *y",
  ].join("\n");
  const json = yamlToJson(catalog(`  back-matter:\n    resources:\n${resource}\n`));
  const value = JSON.parse(json) as { catalog: { "back-matter": { resources: Record<string, unknown>[] } } };
  assert.deepEqual(value.catalog["back-matter"].resources[0].citation, ["one"]);
});

test("YML-009.02 an alias with no anchor before it gives a ParseError with no entries", () => {
  const error = parseError(() => parseYaml(catalog("  params:\n    - id: *missing\n")));
  assert.deepEqual(error.failures, []);
  const later = parseError(() => parseYaml(catalog("  params:\n    - id: *later\n    - id: &later a\n")));
  assert.deepEqual(later.failures, []);
});

test("an alias key that resolves to a scalar reads as that key", () => {
  const input = catalog("  params:\n    - id: p\n      *k : text\n").replace("    title: t\n", "    title: t\n    &k remarks: r\n");
  const body = catalogOf(input);
  assert.equal(body.metadata.remarks, "r");
  assert.equal(body.params?.[0].remarks, "text");
});

test("a key __proto__ is an own property, so the JSON pipeline rejects it as an unknown field", () => {
  const error = parseError(() => parseYaml(catalog().replace("    title: t\n", "    title: t\n    __proto__: x\n")));
  assert.deepEqual(locationsOf(error), ["/catalog/metadata/__proto__"]);
  const twice = parseError(() => parseYaml(catalog().replace("    title: t\n", "    __proto__: x\n    __proto__: y\n    title: t\n")));
  assert.deepEqual(twice.failures, []);
});

test("an input of 10,000 aliases to one scalar parses in less than one second", () => {
  const aliases = Array.from({ length: 10_000 }, () => "*s").join(", ");
  const input = catalog(`  params:\n    - id: p\n      remarks: &s x\n      values: [${aliases}]\n`);
  const started = performance.now();
  const body = catalogOf(input);
  assert.ok(performance.now() - started < 1000, "the parse took one second or more");
  assert.equal(body.params?.[0].values?.length, 10_000);
});

/** A catalog with two parameters. The first holds an anchored array of `count` strings, the second reads it by alias. */
const arrayByAlias = (count: number) =>
  catalog(`  params:\n    - id: a\n      values: &v [${Array.from({ length: count }, () => "x").join(", ")}]\n    - id: b\n      values: *v\n`);

test("an alias that gives 100,000 nodes parses, and an alias that gives 100,001 nodes is over the limit", () => {
  assert.equal(catalogOf(arrayByAlias(99_999)).params?.[1].values?.length, 99_999);
  const error = parseError(() => parseYaml(arrayByAlias(100_000)));
  assert.equal(error.limit, "alias-expansion");
  assert.equal(error.category, "parse-error");
  assert.deepEqual(error.failures, []);
});

test("nested aliases that double the nodes at each level stop at the limit", () => {
  const levels = ["  x0: &a0 [x, x]"];
  for (let level = 1; level <= 40; level++) levels.push(`  x${level}: &a${level} [*a${level - 1}, *a${level - 1}]`);
  const started = performance.now();
  const error = parseError(() => parseYaml(catalog(`${levels.join("\n")}\n`)));
  assert.equal(error.limit, "alias-expansion");
  assert.ok(performance.now() - started < 1000, "the parse took one second or more");
});

/** A catalog with parameters whose `remarks` read the anchored scalar of 5,000,000 characters, then one short scalar. */
const textByAlias = (extraAliases: number) => {
  const long = "x".repeat(5_000_000);
  const reads = Array.from({ length: 2 + extraAliases }, (_, i) => `    - id: r${i}\n      remarks: ${i < 2 ? "*long" : "*short"}`);
  return catalog(`  params:\n    - id: first\n      remarks: &long ${long}\n      values: [&short y]\n${reads.join("\n")}\n`);
};

test("aliases that give 10,000,000 characters parse, and aliases that give 10,000,001 characters are over the limit", () => {
  assert.equal(catalogOf(textByAlias(0)).params?.[1].remarks?.length, 5_000_000);
  const error = parseError(() => parseYaml(textByAlias(1)));
  assert.equal(error.limit, "alias-expansion");
  assert.deepEqual(error.failures, []);
});

const flow = (levels: number) => "[".repeat(levels) + "]".repeat(levels);

test("a tree at 251 levels gives a ParseError with the limit nesting-depth, as the JSON parse does", () => {
  assert.equal(parseError(() => parseYaml(flow(251))).limit, "nesting-depth");
  assert.equal(parseError(() => parse(flow(251))).limit, "nesting-depth");
  assert.equal(parseError(() => parseYaml(flow(250))).limit, undefined);
});

test("an input that overflows the stack of the yaml package gives the limit nesting-depth", () => {
  const input = flow(10_000);
  // The package reports the overflow as a document error. Thus the limit of the walk cannot give this result.
  const documents = parseAllDocuments(input, { schema: "failsafe", resolveKnownTags: false, uniqueKeys: false });
  assert.ok(Array.isArray(documents));
  assert.equal(documents[0].errors[0].code, "RESOURCE_EXHAUSTION");
  const error = parseError(() => parseYaml(input));
  assert.equal(error.limit, "nesting-depth");
  assert.deepEqual(error.failures, []);
  const block = Array.from({ length: 20_000 }, (_, i) => `${" ".repeat(i)}a:`).join("\n");
  assert.equal(parseError(() => parseYaml(block)).limit, "nesting-depth");
});

test("a syntax error is not a limit, and its message holds lines of the input", () => {
  const error = parseError(() => parseYaml(catalog("  params: [SECRET-MARKER-123\n")));
  assert.equal(error.limit, undefined);
  assert.ok(error.message.includes("SECRET-MARKER-123"));
});

test("YML-006.01 parseYamlFile reads a valid YAML file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oscal-yaml-"));
  try {
    const file = path.join(dir, "catalog.yaml");
    fs.writeFileSync(file, catalog());
    assert.deepEqual(parseYamlFile(file), parseYaml(catalog()));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("YML-006.02 parseYamlFile of a missing path throws a NotFoundError, and of a directory a ReadError", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oscal-yaml-"));
  try {
    const missing = path.join(dir, "missing.yaml");
    const notFound = thrown(() => parseYamlFile(missing));
    assert.ok(notFound instanceof NotFoundError && notFound.path === missing);
    const unreadable = thrown(() => parseYamlFile(dir));
    assert.ok(unreadable instanceof ReadError && unreadable.path === dir);
    assert.ok(thrown(() => parseYamlFile(undefined as unknown as string)) instanceof TypeError);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A seeded generator, so a failure repeats. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The pieces that make a string hard to write as YAML. */
const PIECES = [
  " ", "  ", "\t", "\n", "\r\n", " \n", "\n\n", "\\", '"', "'", "#", " #", ": ", ":", "- ", "-", "?", "{", "}", "[", "]", ",",
  "&", "*", "!", "|", ">", "%", "@", "`", "~", "---", "...", "\u0085", "\u2028", "\u2029", "\u007f", "\ufeff", "\u00e9",
  "\u{1f600}", "null", "true", "1.0", "0x1F", "a", "b",
];

/** A random tree of objects, arrays, and strings. Empty objects and empty arrays occur. */
function randomTree(next: () => number, depth: number): unknown {
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const text = () => Array.from({ length: Math.floor(next() * 7) }, () => pick(PIECES)).join("");
  const kind = depth >= 4 ? 0 : Math.floor(next() * 3);
  if (kind === 0) return text();
  const size = Math.floor(next() * 4);
  if (kind === 1) return Array.from({ length: size }, () => randomTree(next, depth + 1));
  return Object.fromEntries(Array.from({ length: size }, () => [text(), randomTree(next, depth + 1)]));
}

test("serializeYaml then parse gives the same canonical form for 1,000 random documents", () => {
  const next = random(20260101);
  for (let n = 0; n < 1000; n++) {
    const tree = { [`k${n}`]: randomTree(next, 0), "": randomTree(next, 1) };
    const yaml = serializeYaml(tree as never);
    // The tree has no root key, so the reader keeps each scalar as a string.
    assert.equal(canonicalize(yamlToJson(yaml)), canonicalize(JSON.stringify(tree)), `document ${n}:\n${yaml}`);
  }
});

test("serializeYaml writes block style with an indent of 2 spaces, and each key and string in JSON form", () => {
  const document = {
    catalog: {
      uuid: "u",
      metadata: { title: "a: b", version: "1.0", props: [{ name: "n", value: "x" }, { name: "m" }], skip: undefined },
      groups: [],
      "back-matter": {},
      nested: [["a", "b"], []],
    },
  };
  assert.equal(
    serializeYaml(document as never),
    [
      '"catalog":',
      '  "uuid": "u"',
      '  "metadata":',
      '    "title": "a: b"',
      '    "version": "1.0"',
      '    "props":',
      '      - "name": "n"',
      '        "value": "x"',
      '      - "name": "m"',
      '  "groups": []',
      '  "back-matter": {}',
      '  "nested":',
      '    - - "a"',
      '      - "b"',
      "    - []",
      "",
    ].join("\n"),
  );
});

test("YML-008.02 the number form of a string is kept, and a number and a boolean are written as JSON writes them", () => {
  const yaml = serializeYaml({ x: { version: "1.0", start: 443, "as-is": true } } as never);
  assert.ok(yaml.includes('"version": "1.0"'));
  assert.ok(yaml.includes('"start": 443'));
  assert.ok(yaml.includes('"as-is": true'));
});

test("YML-008.03 an optional field that the document lacks is absent from the output", () => {
  const document = parseYaml(catalog());
  const yaml = serializeYaml(document);
  assert.ok(!yaml.includes("remarks") && !yaml.includes("null"), yaml);
  assert.deepEqual(parseYaml(yaml), document);
});
