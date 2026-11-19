import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
// The public API (design D4). The entry point has a fixed statement form, so the test reads it as text.
const ENTRY = "src/v1/index.ts";
const GENERATED_STATEMENT = 'export type * from "../generated/oscal.ts"';
interface ExportStatement {
  type: boolean;
  names: string[];
  from: string;
}
function readEntryPoint(): ExportStatement[] {
  const text = fs.readFileSync(ENTRY, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const statements: ExportStatement[] = [];
  const unknown: string[] = [];
  for (const raw of text.split(";")) {
    const statement = raw.trim();
    if (statement === "" || statement === GENERATED_STATEMENT) continue;
    const match = /^export (type )?\{([^{}]*)\} from "\.\.\/([a-z-]+(?:\/[a-z-]+)*\.ts)"$/.exec(statement);
    if (!match) {
      unknown.push(statement);
      continue;
    }
    const names = match[2].split(",").map((n) => n.trim()).filter((n) => n !== "");
    statements.push({ type: match[1] !== undefined, names, from: match[3] });
  }
  assert.deepEqual(unknown, [], `${ENTRY} has a statement of a form that design D1 does not allow`);
  assert.ok(text.includes(GENERATED_STATEMENT), `${ENTRY} lacks ${GENERATED_STATEMENT}`);
  return statements;
}
test("the entry point holds only the statement forms of design D1", () => {
  assert.ok(readEntryPoint().length > 0);
});
test("the record names equal the exports of the entry point, except the generated model types", () => {
  const exported = new Set(readEntryPoint().flatMap((s) => s.names));
  const recorded = new Set(
    (JSON.parse(fs.readFileSync("openspec/traceability.json", "utf8")) as { operations: { name: string }[] }).operations.map(
      (o) => o.name,
    ),
  );
  const problems = [
    ...[...exported].filter((n) => !recorded.has(n)).map((n) => `${n} is exported and has no entry in the record`),
    ...[...recorded].filter((n) => !exported.has(n)).map((n) => `${n} is in the record and is not exported`),
  ];
  assert.deepEqual(problems, []);
});
test("a value is in an export statement, and a type is in an export type statement", async () => {
  const statements = readEntryPoint();
  const module = (await import("../src/v1/index.ts")) as Record<string, unknown>;
  const values = statements.filter((s) => !s.type).flatMap((s) => s.names);
  assert.deepEqual(Object.keys(module).sort(), [...values].sort());
  for (const statement of statements.filter((s) => s.type)) {
    const source = (await import(`../src/${statement.from}`)) as Record<string, unknown>;
    for (const name of statement.names) {
      assert.ok(!(name in source), `${name} is a value of ${statement.from}, but ${ENTRY} exports it as a type`);
    }
  }
});
test("the major version of OSCAL_RELEASE is the version of the namespace", async () => {
  const { OSCAL_RELEASE } = await import("../src/v1/index.ts");
  const namespace = /^v(\d+)$/.exec(path.basename(path.dirname(path.resolve(ENTRY))));
  assert.ok(namespace, "the directory of the entry point is not v<major>");
  assert.equal(OSCAL_RELEASE.split(".")[0], namespace[1]);
});
