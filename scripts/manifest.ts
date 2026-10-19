/**
 * The consumer-side validator of the naming manifest. It applies NAM-001 to NAM-004 of the oscal-bindings-specs store
 * from the spec text, with no code from the store (design.md D2). A consumer runs it before it generates code, and it
 * generates nothing when the validator reports a failure.
 *
 * Pointers resolve through own properties and array indexes only, so a key such as `__proto__` never resolves to an
 * inherited member.
 */
import { createHash } from "node:crypto";
import { Ajv } from "ajv";

/** The manifest formats that this consumer supports. */
export const SUPPORTED_FORMATS: readonly number[] = [1];

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export type Kind = "object" | "document" | "document-union" | "union" | "enum" | "single-or-many";

export interface Variant {
  type: string;
  property: string;
}

export interface Entry {
  name: string;
  kind: Kind;
  sites: string[];
  "body-field"?: string;
  members?: string[];
  variants?: Variant[];
  closed?: boolean;
  item?: string;
}

export interface Manifest {
  format: number;
  "oscal-release": string;
  schema: { file: string; sha256: string };
  types: Entry[];
}

export const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Splits a "#"-form RFC 6901 pointer into its reference tokens. Returns undefined for a malformed pointer. */
export function parsePointer(pointer: string): string[] | undefined {
  if (!pointer.startsWith("#") || pointer.includes("%")) return undefined;
  const body = pointer.slice(1);
  if (body === "") return [];
  if (!body.startsWith("/")) return undefined;
  const tokens: string[] = [];
  for (const raw of body.slice(1).split("/")) {
    if (/~(?![01])/.test(raw)) return undefined;
    tokens.push(raw.replace(/~1/g, "/").replace(/~0/g, "~"));
  }
  return tokens;
}

/** Appends one reference token to a pointer, with the RFC 6901 escapes. */
export const childPointer = (pointer: string, ...tokens: (string | number)[]) =>
  tokens.reduce<string>((p, t) => `${p}/${String(t).replace(/~/g, "~0").replace(/\//g, "~1")}`, pointer);

/** Resolves a pointer to a subschema (an object or a boolean). Returns undefined when it does not resolve. */
export function resolvePointer(root: Json, pointer: string): Json | undefined {
  const tokens = parsePointer(pointer);
  if (tokens === undefined) return undefined;
  let node: Json | undefined = root;
  for (const token of tokens) {
    if (Array.isArray(node)) {
      if (!/^(0|[1-9]\d*)$/.test(token) || Number(token) >= node.length) return undefined;
      node = node[Number(token)];
    } else if (isObject(node)) {
      if (!Object.hasOwn(node, token)) return undefined;
      node = node[token];
    } else {
      return undefined;
    }
  }
  return isObject(node) || typeof node === "boolean" ? node : undefined;
}

const hasProperty = (schema: Json, site: string, key: string) => {
  const node = resolvePointer(schema, site);
  return isObject(node) && isObject(node.properties) && Object.hasOwn(node.properties, key);
};

export interface ValidateInput {
  /** The parsed `names.json`. */
  manifest: unknown;
  /** The parsed `names.schema.json`. */
  namesSchema: object;
  /** The bytes of the complete schema that the consumer parses. */
  schemaBytes: Buffer;
  /** The OSCAL release of that schema. */
  release: string;
}

/** Returns every failure. An empty list means the manifest is valid. */
export function validateManifest({ manifest, namesSchema, schemaBytes, release }: ValidateInput): string[] {
  const failures: string[] = [];
  const fail = (message: string) => failures.push(message);

  // 1. The JSON Schema of the format (NAM-004). The structural checks below assume a conforming file.
  const ajv = new Ajv({ allErrors: true, strict: false });
  const conforms = ajv.validate(namesSchema, manifest);
  if (!conforms) {
    for (const e of ajv.errors ?? []) fail(`[json-schema] names.json${e.instancePath} ${e.message ?? ""}`.trim());
    return failures;
  }
  const m = manifest as Manifest;

  // 2. Format version and OSCAL release (NAM-003, rules 4 and 5).
  if (!SUPPORTED_FORMATS.includes(m.format)) fail(`format ${m.format} is not supported`);
  if (m["oscal-release"] !== release) fail(`oscal-release ${m["oscal-release"]} is not ${release}`);

  // 3. The schema hash (NAM-002.03). It is the hash of the bytes that the consumer parses.
  const actual = createHash("sha256").update(schemaBytes).digest("hex");
  if (m.schema.sha256 !== actual) fail(`schema.sha256 ${m.schema.sha256} is not the sha256 ${actual} of the schema`);

  // 4. Unique names, unique and resolvable pointers, references to entries (NAM-001, NAM-003).
  const schema = JSON.parse(schemaBytes.toString("utf8")) as Json;
  const byName = new Map<string, Entry>();
  const siteOwner = new Map<string, string>();
  for (const entry of m.types) {
    if (byName.has(entry.name)) fail(`the name ${entry.name} occurs more than once`);
    byName.set(entry.name, entry);
    for (const site of entry.sites) {
      const owner = siteOwner.get(site);
      if (owner !== undefined) fail(`the pointer ${site} occurs in ${owner} and in ${entry.name}`);
      siteOwner.set(site, entry.name);
      if (resolvePointer(schema, site) === undefined) fail(`${entry.name}: the pointer ${site} does not resolve`);
    }
  }
  for (const entry of m.types) {
    const refs = [...(entry.members ?? []), ...(entry.item ? [entry.item] : []), ...(entry.variants ?? []).map((v) => v.type)];
    for (const ref of refs) if (!byName.has(ref)) fail(`${entry.name}: the reference ${ref} names no entry`);

    // 5. Variant properties and body fields are keys at their pointers (NAM-004).
    for (const variant of entry.variants ?? []) {
      const branch = byName.get(variant.type);
      if (branch && !branch.sites.every((site) => hasProperty(schema, site, variant.property))) {
        fail(`${entry.name}: ${variant.property} is not a property of the branch ${variant.type}`);
      }
    }
    const bodyField = entry["body-field"];
    if (bodyField !== undefined && !entry.sites.every((site) => hasProperty(schema, site, bodyField))) {
      fail(`${entry.name}: ${bodyField} is not a property of the wrapper`);
    }
  }
  return failures;
}
