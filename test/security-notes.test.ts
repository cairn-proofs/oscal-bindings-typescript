/**
 * Pins each claim of the "Security notes for consumers" section of README.md. Each test states a behavior that a note
 * relies on. A test that fails means the code changed, or the README changed, so that a note can be false. Update the
 * note in README.md first, then update the test. These tests need no spec artifact and no network.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import * as backmatter from "../src/backmatter.ts";
import * as documentModule from "../src/document.ts";
import { NotFoundError, OscalError, ParseError } from "../src/errors.ts";
import type { OscalDocument } from "../src/generated/oscal.ts";
import * as parseModule from "../src/parse.ts";
import { serialize } from "../src/serialize.ts";

const { OscalDoc } = documentModule;
const { isValid, parse, parseFile } = parseModule;
const { buildHash, buildRlink } = backmatter;

const root = path.resolve(import.meta.dirname, "..");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
  private?: boolean;
  dependencies: Record<string, string>;
};

const SECTION = "## Security notes for consumers";
const NOTES = [
  "Size and time",
  "Error text",
  "File paths",
  "A valid document is not an authentic document",
  "Files that you store and read",
  "Links in a document",
  "Check what you build or change",
  "Isolation and shared documents",
  "Audit",
  "Install the binding",
];

/** The failure message of a pinning test. It tells the author which note to revise. */
const stale = (note: string) =>
  `The behavior that the README note "${note}" describes has changed. Revise that note, then update this test.`;

const catalog = (overrides: Record<string, unknown> = {}) => ({
  catalog: {
    uuid: "5d6e1c9e-0a5f-4c0b-9d54-2f4a2f3c1b11",
    metadata: {
      title: "t",
      "last-modified": "2024-01-02T03:04:05Z",
      version: "1",
      "oscal-version": "1.2.3",
    },
    ...overrides,
  },
});

/** The code of a source file with its comments removed, so that a comment that names a function does not match. */
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

/** The files of the library source that are not generated. */
const sourceFiles = fs
  .readdirSync(path.join(root, "src"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
  .map((entry) => ({
    name: entry.name,
    text: withoutComments(fs.readFileSync(path.join(root, "src", entry.name), "utf8")),
  }));

test("the README holds the security notes section and each of its notes", () => {
  assert.ok(readme.includes(`\n${SECTION}\n`), `README.md has no "${SECTION}" section.`);
  for (const note of NOTES) {
    assert.ok(readme.includes(`\n#### ${note}\n`), `README.md has no "${note}" note. Update NOTES in this test.`);
  }
});

test("each operation that the notes name exists", () => {
  const exported: Record<string, unknown> = {
    ...parseModule,
    ...backmatter,
    ...documentModule,
    serialize,
    NotFoundError,
    ParseError,
  };
  const names = [
    "parse",
    "parseFile",
    "isValid",
    "serialize",
    "OscalDoc",
    "buildHash",
    "buildRlink",
    "buildResource",
    "ParseError",
    "NotFoundError",
  ];
  const section = readme.slice(readme.indexOf(SECTION));
  for (const name of names) {
    assert.ok(name in exported, `${name} is not exported. Revise the README notes that name it.`);
    assert.ok(section.includes(`\`${name}`), `The security notes no longer name ${name}. Update the names in this test.`);
  }
  assert.equal(typeof OscalDoc.fromJson, "function");
  assert.equal(typeof OscalDoc.fromFile, "function");
});

test('security note "Size and time": the binding sets no limit on the size of the input', () => {
  const padded = `${JSON.stringify(catalog())}${" ".repeat(16 * 1024 * 1024)}`;
  assert.equal(isValid(padded), true, stale("Size and time"));
  assert.ok(parse(padded).catalog, stale("Size and time"));
});

test('security note "Size and time": a ParseError has no limit on its entries', () => {
  const groups = Array.from({ length: 500 }, () => ({}));
  const input = JSON.stringify(catalog({ groups }));
  assert.throws(
    () => parse(input),
    (error) => error instanceof ParseError && error.failures.length >= 500,
    stale("Size and time"),
  );
});

test('security note "Error text": a ParseError carries text of the input document', () => {
  const key = "evil\nFAKE LOG LINE";
  const input = JSON.stringify(catalog({ [key]: 1 }));
  assert.throws(
    () => parse(input),
    (error) => error instanceof ParseError && JSON.stringify(error.failures).includes("FAKE LOG LINE"),
    stale("Error text"),
  );
  assert.throws(
    () => parse("SECRET-MARKER-123 is not json"),
    (error) => error instanceof ParseError && error.message.includes("SECRET-MAR"),
    stale("Error text"),
  );
});

test('security note "Error text": NotFoundError names the path, and other file system errors pass through', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oscal-notes-"));
  try {
    const missing = path.join(dir, "missing.json");
    assert.throws(() => parseFile(missing), (e) => e instanceof NotFoundError && e.path === missing, stale("Error text"));
    assert.throws(
      () => parseFile(dir),
      (e) => !(e instanceof OscalError) && (e as NodeJS.ErrnoException).code === "EISDIR",
      stale("Error text"),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('security note "File paths": parseFile follows a symbolic link out of the folder, and the error shows content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oscal-notes-"));
  try {
    const inside = path.join(dir, "inside");
    const outside = path.join(dir, "outside");
    fs.mkdirSync(inside);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "doc.json"), JSON.stringify(catalog()));
    fs.writeFileSync(path.join(outside, "secret.txt"), "TOPSECRET-VALUE");
    fs.symlinkSync(path.join(outside, "doc.json"), path.join(inside, "doc.json"));
    fs.symlinkSync(path.join(outside, "secret.txt"), path.join(inside, "secret.txt"));
    assert.deepEqual(parseFile(path.join(inside, "doc.json")), catalog(), stale("File paths"));
    assert.deepEqual(parseFile(path.join(inside, "..", "outside", "doc.json")), catalog(), stale("File paths"));
    assert.throws(
      () => parseFile(path.join(inside, "secret.txt")),
      (error) => error instanceof ParseError && error.message.includes("TOPSECRET-VALUE"),
      stale("File paths"),
    );
    assert.equal(parseFile.length, 1, "parseFile takes only a path, so it has no integrity check.");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('security note "A valid document is not an authentic document": a valid document can hold false claims', () => {
  const forged = catalog();
  forged.catalog.metadata["oscal-version"] = "0.0.1-forged";
  forged.catalog.metadata.title = "Signed by someone else";
  assert.equal(isValid(JSON.stringify(forged)), true, stale("A valid document is not an authentic document"));
});

test('security note "Links in a document": the schema accepts any URI, and the builder keeps it as given', () => {
  for (const href of ["file:///etc/passwd", "javascript:alert(1)", "http://169.254.169.254/latest/meta-data/"]) {
    assert.equal(buildRlink(href).href, href, stale("Links in a document"));
  }
});

test('security note "Links in a document": the library source does not use the network', () => {
  const patterns = [
    /from\s+["']node:(http|https|http2|net|tls|dgram|dns)["']/,
    /require\(["'](node:)?(http|https|http2|net|tls|dgram|dns)["']\)/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bEventSource\b/,
  ];
  for (const { name, text } of sourceFiles) {
    for (const pattern of patterns) {
      assert.doesNotMatch(text, pattern, `src/${name} uses the network. ${stale("Links in a document")}`);
    }
  }
});

test('security note "Check what you build or change": serialize and the constructor do not check the schema', () => {
  const invalid = { catalog: { uuid: "x", metadata: null } } as unknown as OscalDocument;
  const note = "Check what you build or change";
  assert.equal(serialize(invalid, { compact: true }), '{"catalog":{"uuid":"x","metadata":null}}', stale(note));
  assert.equal(isValid(serialize(invalid)), false, stale(note));
  const withoutMetadata = { catalog: { uuid: "x" } } as unknown as OscalDocument;
  const doc = new OscalDoc(withoutMetadata);
  assert.equal(doc.metadata, undefined, stale(note));
  assert.throws(() => doc.oscalVersion, TypeError, stale(note));
  assert.throws(() => new OscalDoc({} as OscalDocument), TypeError, stale(note));
});

test('security note "Check what you build or change": the back-matter builders check their result', () => {
  assert.throws(() => buildHash("abc", " SHA-256"), ParseError, stale("Check what you build or change"));
});

test('security note "Isolation and shared documents": a parsed document is not frozen and a change goes unseen', () => {
  const note = "Isolation and shared documents";
  const doc = OscalDoc.fromJson(JSON.stringify(catalog()));
  assert.equal(Object.isFrozen(doc.wrapper), false, stale(note));
  assert.equal(Object.isFrozen(doc.body), false, stale(note));
  (doc.body as unknown as Record<string, unknown>).metadata = null;
  assert.equal(isValid(serialize(doc.wrapper)), false, stale(note));
  assert.equal(doc.metadata, null, stale(note));
});

test('security note "Audit": the library source writes no log and no file', () => {
  const patterns = [
    /\bconsole\./,
    /process\.(stdout|stderr)/,
    /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\b/,
  ];
  for (const { name, text } of sourceFiles) {
    for (const pattern of patterns) {
      assert.doesNotMatch(text, pattern, `src/${name} writes output. ${stale("Audit")}`);
    }
  }
});

test('security note "Install the binding": the package is private and has two runtime dependencies', () => {
  assert.equal(packageJson.private, true, `The package is no longer private. ${stale("Install the binding")}`);
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), ["ajv", "ajv-formats"], stale("Isolation and shared documents"));
});
