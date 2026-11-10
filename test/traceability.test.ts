import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { artifactPaths, ensureSpecArtifact } from "../scripts/spec-artifact.ts";
import { checkRecord } from "./support/traceability.ts";

const paths = artifactPaths(await ensureSpecArtifact());
const schema = JSON.parse(fs.readFileSync(paths.traceabilitySchema, "utf8")) as object;
const index = JSON.parse(fs.readFileSync(paths.requirements, "utf8")) as { requirements: Array<{ id: string }> };
const ids = new Set(index.requirements.map((r) => r.id));

test("the traceability record is valid, resolves in the requirement index, and names each operation once", () => {
  const record: unknown = JSON.parse(fs.readFileSync("openspec/traceability.json", "utf8"));
  assert.deepEqual(checkRecord(record, schema, ids), []);
});

const record = (...operations: object[]) => ({ format: 1, operations });

test("a good record has no problem", () => {
  assert.deepEqual(checkRecord(record({ name: "parse", requirements: ["PRS-001"] }, { name: "x", "binding-local": "ABC-001" }), schema, ids), []);
});

test("a scenario identifier breaks the schema check", () => {
  const problems = checkRecord(record({ name: "parse", requirements: ["PRS-001.01"] }), schema, ids);
  assert.ok(problems.some((p) => p.startsWith("[schema]")));
});

test("an identifier that is not in the index breaks the index check", () => {
  assert.deepEqual(checkRecord(record({ name: "parse", requirements: ["ZZZ-999"] }), schema, ids), [
    "[index] parse: ZZZ-999 is not in the requirement index",
  ]);
});

test("an entry with both fields breaks the schema check", () => {
  const problems = checkRecord(record({ name: "parse", requirements: ["PRS-001"], "binding-local": "ABC-001" }), schema, ids);
  assert.ok(problems.some((p) => p.startsWith("[schema]")));
});

test("a name in two entries breaks the duplicate check", () => {
  assert.deepEqual(
    checkRecord(record({ name: "parse", requirements: ["PRS-001"] }, { name: "parse", requirements: ["PRS-002"] }), schema, ids),
    ["[duplicate] parse is in more than one entry"],
  );
});
