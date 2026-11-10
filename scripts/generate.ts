/**
 * Generates TypeScript type declarations from the complete OSCAL schema and the naming manifest (design.md D3, D4).
 *
 * The generator holds no naming rule. Every exported name is the name of a manifest entry. To type a place in the
 * schema, it looks up the pointer of the place in the manifest first. A non-scalar place that has no entry is a gap,
 * and the generator fails with the list of every gap.
 *
 * It also writes the runtime inputs of the validators (design.md D2): a copy of the schema, and the table of element
 * types.
 *
 * Usage: `tsx scripts/generate.ts` checks that each generated file is the current output.
 *        `tsx scripts/generate.ts --write` writes them.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  childPointer,
  type Entry,
  isObject,
  type Json,
  type JsonObject,
  type Manifest,
  resolvePointer,
  validateManifest,
} from "./manifest.ts";
import { artifactPaths, ensureSpecArtifact, OSCAL_RELEASE, SPEC_ARTIFACT_VERSION } from "./spec-artifact.ts";

export const OUTPUT = path.resolve("src/generated/oscal.ts");
export const SCHEMA_OUTPUT = path.resolve("src/generated/oscal-complete-schema.json");
export const ELEMENT_TYPES_OUTPUT = path.resolve("src/generated/element-types.ts");

const PRIMITIVES: Record<string, string> = {
  string: "string",
  number: "number",
  integer: "number",
  boolean: "boolean",
};

/**
 * The element-type name of a canonical type name (design.md D4): a hyphen before each uppercase letter except the
 * first, in lower case. A digit stays in the word before it.
 */
export const elementTypeName = (typeName: string) => typeName.replace(/(?<=.)[A-Z]/g, (c) => `-${c}`).toLowerCase();

/**
 * The pointer that the validator of an entry uses (design.md D3). For an enum, it is the parent of the `anyOf` or
 * `allOf` node that holds the enum site, because that node also holds the base datatype. Returns undefined for an enum
 * site of another shape.
 */
export function validationPointer(entry: Entry): string | undefined {
  const site = entry.sites[0];
  if (entry.kind !== "enum") return site;
  const match = /^(.*)\/(?:anyOf|allOf)\/\d+$/.exec(site);
  return match ? match[1] : undefined;
}

export interface GenerateResult {
  /** The text of the generated module. Empty when `gaps` or `problems` is not empty. */
  output: string;
  /** The text of `src/generated/element-types.ts`. Empty when `gaps` or `problems` is not empty. */
  elementTypes: string;
  /** Pointers of non-scalar places that have no manifest entry. */
  gaps: string[];
  /** Places where the schema and the manifest data disagree. */
  problems: string[];
  /** Manifest entries that no property, branch, or member refers to. The document union is a root, not an orphan. */
  orphans: string[];
}

/** A type expression, and whether it is a scalar primitive. */
interface Typed {
  ts: string;
  primitive: boolean;
  /** The manifest entry, when the place is a site of one. */
  entry?: Entry;
}

const comment = (text: unknown, indent = "") => {
  if (typeof text !== "string" || text.trim() === "") return "";
  // A description must not end the comment early.
  const lines = text.replace(/\*\//g, "*\\/").trim().split("\n");
  return `${indent}/**\n${lines.map((l) => `${indent} * ${l}`.trimEnd()).join("\n")}\n${indent} */\n`;
};

/**
 * Generates the module. The caller validates the manifest first. This function trusts the names and the pointers,
 * and writes every other string (property keys, enum values) as a JSON string literal.
 */
export function generate(schema: Json, manifest: Manifest): GenerateResult {
  const gaps = new Set<string>();
  const problems: string[] = [];
  const referenced = new Set<string>();

  const bySite = new Map<string, Entry>();
  for (const entry of manifest.types) for (const site of entry.sites) bySite.set(site, entry);

  // For each union variant, the distinguishing properties of the other variants (D4). Document members likewise.
  const excluded = new Map<string, string[]>();
  for (const entry of manifest.types) {
    const choices =
      entry.kind === "union"
        ? entry.variants!.map((v) => ({ type: v.type, key: v.property }))
        : entry.kind === "document-union"
          ? entry.members!.map((name) => {
              const member = manifest.types.find((e) => e.name === name)!;
              return { type: name, key: member["body-field"]! };
            })
          : [];
    for (const choice of choices) {
      const others = choices.filter((c) => c.type !== choice.type).map((c) => c.key);
      excluded.set(choice.type, [...(excluded.get(choice.type) ?? []), ...others]);
    }
  }

  const node = (pointer: string) => resolvePointer(schema, pointer);

  function typeOf(pointer: string, seen: Set<string> = new Set()): Typed {
    const entry = bySite.get(pointer);
    if (entry) {
      referenced.add(entry.name);
      return { ts: entry.name, primitive: false, entry };
    }
    const n = node(pointer);
    if (n === true) return { ts: "unknown", primitive: false };
    if (!isObject(n)) {
      gaps.add(pointer);
      return { ts: "never", primitive: false };
    }
    if (typeof n.$ref === "string") {
      // A $ref names a definition. A scalar definition has no entry, so the walk follows it to its datatype. A
      // definition with an entry stops at step 1, so a recursive type cannot loop. `seen` guards a scalar cycle.
      if (seen.has(n.$ref)) {
        problems.push(`${pointer}: $ref cycle through ${n.$ref} without an entry`);
        return { ts: "never", primitive: false };
      }
      return typeOf(n.$ref, new Set([...seen, n.$ref]));
    }
    if (n.type === "array") return { ts: `${wrap(typeOf(childPointer(pointer, "items"), seen).ts)}[]`, primitive: false };
    if (typeof n.type === "string" && PRIMITIVES[n.type] && !("properties" in n)) {
      return { ts: PRIMITIVES[n.type], primitive: true };
    }
    for (const keyword of ["anyOf", "allOf"] as const) {
      const branches = n[keyword];
      if (!Array.isArray(branches)) continue;
      const typed = branches.map((_, i) => typeOf(childPointer(pointer, keyword, i), seen));
      const enums = typed.filter((t) => t.entry?.kind === "enum");
      const rest = typed.filter((t) => t.entry?.kind !== "enum");
      // An enum with its base datatype: the enum type already holds the base for an open enum (anyOf) and
      // narrows it for a closed enum (allOf).
      if (enums.length === 1 && rest.every((t) => t.primitive)) return { ts: enums[0].ts, primitive: false };
      if (typed.every((t) => t.primitive)) {
        const unique = [...new Set(typed.map((t) => t.ts))];
        if (keyword === "anyOf" || unique.length === 1) return { ts: unique.join(" | "), primitive: true };
      }
      gaps.add(pointer);
      return { ts: "never", primitive: false };
    }
    gaps.add(pointer);
    return { ts: "never", primitive: false };
  }

  const wrap = (ts: string) => (ts.includes(" ") ? `(${ts})` : ts);

  function objectBody(entry: Entry): string {
    const site = entry.sites[0];
    const n = node(site) as JsonObject;
    const properties = isObject(n.properties) ? n.properties : {};
    const required = new Set(Array.isArray(n.required) ? n.required : []);
    const lines: string[] = [];
    for (const key of Object.keys(properties)) {
      const p = properties[key];
      const t = typeOf(childPointer(site, "properties", key));
      const description = isObject(p) ? p.description : undefined;
      lines.push(`${comment(description, "  ")}  ${JSON.stringify(key)}${required.has(key) ? "" : "?"}: ${t.ts};`);
    }
    for (const key of excluded.get(entry.name) ?? []) {
      if (Object.hasOwn(properties, key)) {
        problems.push(`${entry.name}: the distinguishing property ${key} of another variant is also its own`);
        continue;
      }
      lines.push(`  ${JSON.stringify(key)}?: never;`);
    }
    if (lines.length === 0) {
      // An object with no properties. `{}` would accept any non-null value, so forbid every key instead.
      lines.push("  [key: string]: never;");
    }
    return `{\n${lines.join("\n")}\n}`;
  }

  function declaration(entry: Entry): string {
    const site = entry.sites[0];
    const n = node(site);
    const doc = comment(isObject(n) ? (n.description ?? n.title) : undefined);
    switch (entry.kind) {
      case "object":
      case "document":
        return `${doc}export interface ${entry.name} ${objectBody(entry)}\n`;
      case "enum": {
        const values = isObject(n) && Array.isArray(n.enum) ? n.enum : [];
        if (values.length === 0) problems.push(`${entry.name}: the enum site ${site} holds no values`);
        const literals = values.map((v) => JSON.stringify(v));
        if (!entry.closed) literals.push("(string & {})");
        return `${doc}export type ${entry.name} =\n${literals.map((l) => `  | ${l}`).join("\n")};\n`;
      }
      case "union":
        for (const v of entry.variants!) referenced.add(v.type);
        return `${doc}export type ${entry.name} =\n${entry.variants!.map((v) => `  | ${v.type}`).join("\n")};\n`;
      case "document-union":
        for (const m of entry.members!) referenced.add(m);
        return `${doc}export type ${entry.name} =\n${entry.members!.map((m) => `  | ${m}`).join("\n")};\n`;
      case "single-or-many": {
        // Cross-check the manifest item against the schema: one branch is the item, the other a list of it.
        const branches = isObject(n) && Array.isArray(n.anyOf) ? n.anyOf : [];
        const typed = branches.map((_, i) => typeOf(childPointer(site, "anyOf", i)).ts).sort();
        const expected = [entry.item!, `${entry.item!}[]`].sort();
        if (JSON.stringify(typed) !== JSON.stringify(expected)) {
          problems.push(`${entry.name}: the schema branches are ${typed.join(", ")}, not ${expected.join(", ")}`);
        }
        referenced.add(entry.item!);
        return `${doc}export type ${entry.name} = ${entry.item} | ${entry.item}[];\n`;
      }
    }
  }

  const declarations = manifest.types.map(declaration);
  const orphans = manifest.types
    .filter((e) => e.kind !== "document-union" && !referenced.has(e.name))
    .map((e) => e.name);

  // The table of element types (design.md D3, D4).
  const rows = manifest.types.map((entry) => ({
    elementType: elementTypeName(entry.name),
    typeName: entry.name,
    pointer: validationPointer(entry),
    site: entry.sites[0],
  }));
  for (const row of rows) {
    if (row.pointer === undefined) {
      problems.push(`${row.typeName}: the enum site ${row.site} does not end in /anyOf/<n> or /allOf/<n>`);
    }
  }
  const byElementType = new Map<string, string[]>();
  for (const row of rows) byElementType.set(row.elementType, [...(byElementType.get(row.elementType) ?? []), row.typeName]);
  for (const [elementType, names] of byElementType) {
    if (names.length > 1) problems.push(`the types ${names.join(" and ")} have the same element-type name ${elementType}`);
  }

  const failed = () => ({ output: "", elementTypes: "", gaps: [...gaps].sort(), problems, orphans });
  if (gaps.size || problems.length) return failed();
  const header = [
    "// Generated by scripts/generate.ts. Do not edit.",
    `// Inputs: oscal-bindings-specs ${SPEC_ARTIFACT_VERSION}, schemas/${manifest["oscal-release"]}/${manifest.schema.file}`,
    `// (sha256 ${manifest.schema.sha256}) and manifest/${manifest["oscal-release"]}/names.json.`,
    "",
    "",
  ].join("\n");
  const table = rows
    .sort((a, b) => (a.elementType < b.elementType ? -1 : a.elementType > b.elementType ? 1 : 0))
    .map(
      (r) =>
        `  { elementType: ${JSON.stringify(r.elementType)}, typeName: ${JSON.stringify(r.typeName)}, ` +
        `pointer: ${JSON.stringify(r.pointer)} },`,
    );
  const elementTypes = [
    header.trimEnd(),
    "",
    "/** The row of a manifest type in the element-type registry. */",
    "export interface ElementType {",
    "  /** The kebab-case element-type name. */",
    "  readonly elementType: string;",
    "  /** The canonical type name of the manifest. */",
    "  readonly typeName: string;",
    "  /** The JSON pointer of the schema node that the validator of the type uses. */",
    "  readonly pointer: string;",
    "}",
    "",
    "/** One row for each manifest type, sorted by element-type name. */",
    "export const elementTypes: readonly ElementType[] = [",
    ...table,
    "];",
    "",
  ].join("\n");
  return { output: header + declarations.join("\n"), elementTypes, gaps: [], problems: [], orphans };
}

/** Reads the pinned artifact, validates the manifest, and generates. Throws with every failure. */
export async function generateFromArtifact(): Promise<GenerateResult & { schemaBytes: Buffer }> {
  const paths = artifactPaths(await ensureSpecArtifact());
  const schemaBytes = fs.readFileSync(paths.schema);
  const manifest = JSON.parse(fs.readFileSync(paths.names, "utf8")) as unknown;
  const namesSchema = JSON.parse(fs.readFileSync(paths.namesSchema, "utf8")) as object;
  const failures = validateManifest({ manifest, namesSchema, schemaBytes, release: OSCAL_RELEASE });
  if (failures.length) throw new Error(`names.json is invalid. No code generated.\n${failures.join("\n")}`);
  return { ...generate(JSON.parse(schemaBytes.toString("utf8")) as Json, manifest as Manifest), schemaBytes };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const write = process.argv.includes("--write");
  const result = await generateFromArtifact();
  if (result.gaps.length || result.problems.length) {
    console.error(`${result.gaps.length} gap(s), ${result.problems.length} problem(s). No code generated.`);
    for (const gap of result.gaps) console.error(`gap: ${gap}`);
    for (const problem of result.problems) console.error(`problem: ${problem}`);
    process.exit(1);
  }
  if (result.orphans.length) console.log(`orphan entries (no reference): ${result.orphans.join(", ")}`);
  const files: { path: string; content: string | Buffer }[] = [
    { path: OUTPUT, content: result.output },
    { path: SCHEMA_OUTPUT, content: result.schemaBytes },
    { path: ELEMENT_TYPES_OUTPUT, content: result.elementTypes },
  ];
  const shown = (file: string) => path.relative(process.cwd(), file);
  if (write) {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    for (const file of files) {
      fs.writeFileSync(file.path, file.content);
      console.log(`wrote ${shown(file.path)}`);
    }
  } else {
    const stale = files.filter((file) => {
      if (!fs.existsSync(file.path)) return true;
      return !Buffer.from(file.content).equals(fs.readFileSync(file.path));
    });
    if (stale.length) {
      for (const file of stale) console.error(`${shown(file.path)} is not the generator output.`);
      console.error("Run: npm run generate");
      process.exit(1);
    }
    for (const file of files) console.log(`${shown(file.path)} is current`);
    console.log("0 gaps");
  }
}
