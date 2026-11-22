// The cases are a copy of scripts/check-canonical-json.ts of cairn-proofs/oscal-bindings-specs at the tag
// v0.9.0+oscal.1.2.3.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import { canonicalize, normalizeDatetime } from "./support/canonical-json.ts";

const cases: Array<[string, () => string, string]> = [
  // RFC 8785, section 3.2.2.3 and appendix B: ECMAScript number serialization.
  ["integer from exponent", () => canonicalize("1E2"), "100"],
  ["negative zero", () => canonicalize("-0"), "0"],
  ["large exponent", () => canonicalize("1e21"), "1e+21"],
  ["small exponent", () => canonicalize("0.0000001"), "1e-7"],
  ["trailing fraction zero", () => canonicalize("0.50"), "0.5"],
  ["shortest round trip", () => canonicalize("0.1"), "0.1"],
  // RFC 8785, section 3.2.3: sort by UTF-16 code units, not by code points.
  [
    "key order by UTF-16 code units",
    () => canonicalize('{"\\ud83d\\ude00":1,"\\ufb33":2,"a":3,"B":4}'),
    '{"B":4,"a":3,"😀":1,"דּ":2}',
  ],
  [
    "nested objects sorted, arrays kept",
    () => canonicalize('{"b":[3,1,2],"a":{"d":1,"c":2}}'),
    '{"a":{"c":2,"d":1},"b":[3,1,2]}',
  ],
  ["no whitespace", () => canonicalize('{ "a" : [ 1 , 2 ] }'), '{"a":[1,2]}'],
  ["string escapes", () => canonicalize('"\\u0041\\u000a\\u001f\\""'), '"A\\n\\u001f\\""'],
  // docs/canonical-json.md, Datetimes.
  ["zero offset to Z", () => normalizeDatetime("2024-01-02T03:04:05+00:00"), "2024-01-02T03:04:05Z"],
  ["negative zero offset to Z", () => normalizeDatetime("2024-01-02T03:04:05.00000-00:00"), "2024-01-02T03:04:05Z"],
  ["trailing fraction zeros", () => normalizeDatetime("2024-01-02T03:04:05.120000Z"), "2024-01-02T03:04:05.12Z"],
  ["other offset kept", () => normalizeDatetime("2024-01-02T03:04:05.000-05:00"), "2024-01-02T03:04:05-05:00"],
  ["fraction digits kept", () => normalizeDatetime("2024-01-02T03:04:05.1234567Z"), "2024-01-02T03:04:05.1234567Z"],
  ["not a datetime", () => normalizeDatetime("private-cloud"), "private-cloud"],
  [
    "datetime key normalized",
    () => canonicalize('{"published":"2024-01-02T03:04:05.10+00:00"}'),
    '{"published":"2024-01-02T03:04:05.1Z"}',
  ],
  [
    "other key not normalized",
    () => canonicalize('{"value":"2024-01-02T03:04:05.10+00:00"}'),
    '{"value":"2024-01-02T03:04:05.10+00:00"}',
  ],
  ["port-range end is a number", () => canonicalize('{"end":443}'), '{"end":443}'],
  // SER-004: two outputs of the same document are equivalent when their canonical forms are the same bytes.
  [
    "SER-004.02: a different key order gives the same canonical form",
    () =>
      canonicalize('{"b":1,"a":{"d":2,"c":[3,{"f":4,"e":5}]}}') ===
      canonicalize('{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}')
        ? "equivalent"
        : "different",
    "equivalent",
  ],
  [
    "SER-004.02: a different array order gives another canonical form",
    () => (canonicalize('{"a":[1,2]}') === canonicalize('{"a":[2,1]}') ? "equivalent" : "different"),
    "different",
  ],
  [
    "SER-004.03: different whitespace gives the same canonical form",
    () =>
      canonicalize('{"a":[1,2],"b":{"c":"d e"}}') ===
      canonicalize('{\n\t"a" : [ 1,\r\n 2 ] ,\n  "b": { "c" : "d e" }\n}\n')
        ? "equivalent"
        : "different",
    "equivalent",
  ],
  [
    "SER-004.03: whitespace inside a string value is kept",
    () => (canonicalize('{"a":"d e"}') === canonicalize('{"a":"d  e"}') ? "equivalent" : "different"),
    "different",
  ],
];

for (const [name, run, want] of cases) {
  test(name, () => assert.equal(run(), want));
}

for (const [name, text] of [
  ["duplicate key", '{"a":1,"a":2}'],
  ["nested duplicate key", '{"a":{"b":1,"c":{"d":1,"d":2}}}'],
  ["not JSON", '{"a":'],
] as const) {
  test(`${name} is rejected`, () => assert.throws(() => canonicalize(text)));
}

// Duplicate-looking keys in different objects, and a key-like string value, are not duplicates.
for (const [name, text] of [
  ["same key in sibling objects", '[{"a":1},{"a":2}]'],
  ["string value equal to a key", '{"a":"a","b":"a"}'],
  ["escaped quote in a key", '{"a\\"b":1,"a":2}'],
] as const) {
  test(`${name} is accepted`, () => assert.doesNotThrow(() => canonicalize(text)));
}

const corpus = artifactPaths(await ensureSpecArtifact()).corpus;
const expectedDir = path.join(corpus, "expected");
for (const file of fs.readdirSync(expectedDir).sort()) {
  test(`corpus expected/${file} is its own canonical form`, () => {
    const bytes = fs.readFileSync(path.join(expectedDir, file));
    assert.equal(Buffer.from(canonicalize(bytes.toString("utf8")), "utf8").equals(bytes), true);
  });
}
