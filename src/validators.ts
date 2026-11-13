/**
 * Runtime validators for the types of the naming manifest (design.md D1, D5).
 *
 * The complete OSCAL schema is the only source of the constraints. The validator of a type is the Ajv validate function
 * of the schema node that defines the type. The generator writes both inputs into `src/generated/`, so this module reads
 * only files of the repo.
 */
import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { type ElementType, elementTypes, type UnionSite, unionSites } from "./generated/element-types.ts";
import schema from "./generated/oscal-complete-schema.json" with { type: "json" };
import { DocumentTypeMismatchError, type FailureEntry, ParseError } from "./errors.ts";

export { type ElementType, elementTypes };

/**
 * The pattern engine of design D10. It compiles a schema pattern for the JavaScript regex engine, and it replaces the
 * three constructs whose XSD meaning differs from the JavaScript meaning (PRS-007). Outside a character class:
 *
 * 1. `.` becomes `[^\n\r]`.
 * 2. `\s` becomes `[\t\n\r ]`.
 * 3. `\S` becomes `[^\t\n\r ]`.
 *
 * The translation copies each other escape and each character class unchanged. It throws for `\s` or `\S` inside a
 * character class, because no pattern of the schema has one and the translation does not cover it.
 */
export function regExpEngine(pattern: string, flags: string): RegExp {
  let out = "";
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      const next = pattern[i + 1] ?? "";
      i++;
      if (next === "s" || next === "S") {
        if (inClass) throw new Error(`pattern ${pattern}: \\${next} inside a character class is not supported`);
        out += next === "s" ? "[\\t\\n\\r ]" : "[^\\t\\n\\r ]";
      } else {
        out += c + next;
      }
    } else if (inClass) {
      if (c === "]") inClass = false;
      out += c;
    } else if (c === "[") {
      inClass = true;
      out += c;
    } else {
      out += c === "." ? "[^\\n\\r]" : c;
    }
  }
  return new RegExp(out, flags);
}
// Ajv reads `code` only to generate standalone code, which this module does not use. A name that no generated module
// defines makes a standalone build fail, so the translation cannot be skipped by mistake.
regExpEngine.code = "regExpEngine";

/**
 * One factory sets the options of both Ajv instances, so the options cannot differ by mistake. Only `allErrors`
 * differs (design D3). `verbose` adds `parentSchema` and `data` to each error, so a parse error can find the nested
 * union site of an error and the object at the site (PRS-014). `strictTypes` is off, because the schema sets a
 * `pattern` on a number (DecimalDatatype), and the default value makes Ajv write a warning to the console. The default
 * `unicodeRegExp` passes the `u` flag to the pattern engine, so `\p{L}` and `\p{N}` keep their XSD meaning (PRS-007).
 */
function createAjv(allErrors: boolean): Ajv {
  const ajv = new Ajv({ allErrors, verbose: true, strictTypes: false, code: { regExp: regExpEngine } });
  // ajv-formats is CommonJS, so under NodeNext the callable is the `default` property of the default import.
  addFormats.default(ajv, ["date-time", "uri", "uri-reference", "email"]);
  ajv.addSchema(schema);
  return ajv;
}

// The instance that collects each error (PRS-006), and the instance that stops at the first error.
const ajv = createAjv(true);
const failFastAjv = createAjv(false);

const pointers = new Map(elementTypes.map((row) => [row.typeName, row.pointer]));

/** The schema node at a JSON pointer of the imported schema. Throws when there is no node. */
function nodeAt(pointer: string): unknown {
  let node: unknown = schema;
  for (const segment of pointer.split("/").slice(1)) {
    const key = segment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (node === null || typeof node !== "object" || !Object.hasOwn(node, key)) {
      throw new Error(`no schema node at ${pointer}`);
    }
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/**
 * The variants of each nested union site, by the site node of the imported schema. The `parentSchema` of the `anyOf`
 * error of a site is the site node, so the map finds the site of an error by identity.
 */
const siteVariants = new Map<unknown, UnionSite["variants"]>(
  unionSites.map((site) => [nodeAt(site.pointer), site.variants]),
);
const elementPointers = new Map(elementTypes.map((row) => [row.elementType, row.pointer]));

/**
 * The Ajv validate function of a canonical type name. The function holds the errors of its last call in its `errors`
 * property. Throws for a name that is not in the manifest.
 */
export function validatorFor(typeName: string): ValidateFunction {
  const pointer = pointers.get(typeName);
  if (pointer === undefined) throw new Error(`${typeName} is not a type of the naming manifest`);
  const validate = ajv.getSchema(`${schema.$id}${pointer}`);
  if (validate === undefined) throw new Error(`${typeName}: no schema at ${pointer}`);
  return validate;
}

/** The two validators of one document branch or one element type (design D3). */
export interface Validators {
  /** Stops at the first error. Checks each input first. */
  readonly failFast: ValidateFunction;
  /** Collects each error. Runs after a failed fail-fast check. */
  readonly full: ValidateFunction;
}

/** The fail-fast and collecting validate functions of the schema node at a pointer. Throws when there is no node. */
function validatorsAt(label: string, pointer: string): Validators {
  const get = (instance: Ajv) => {
    const validate = instance.getSchema(`${schema.$id}${pointer}`);
    if (validate === undefined) throw new Error(`${label}: no schema at ${pointer}`);
    return validate;
  };
  return { failFast: get(failFastAjv), full: get(ajv) };
}

/** The pointer of the root `oneOf` branch for each root key. A branch requires its root key. */
const branchPointers = new Map<string, string>(
  (schema.oneOf as Array<{ required: string[] }>).map((branch, n) => [branch.required[0], `#/oneOf/${n}`]),
);

/** The root keys of the eight document types. */
export const rootKeys: readonly string[] = [...branchPointers.keys()];

/**
 * The validators of the document branch of a root key. Each instance compiles a branch on its first request. Throws
 * for a key that is not a root key.
 */
export function documentValidators(rootKey: string): Validators {
  const pointer = branchPointers.get(rootKey);
  if (pointer === undefined) throw new Error(`${rootKey} is not a root key`);
  return validatorsAt(rootKey, pointer);
}

/**
 * The one root key of the input (stage 4 of a parse). Throws for no root key, for two or more, and for a typed
 * mismatch.
 */
export function rootKeyOf(value: unknown, expected?: string): string {
  const found =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value).filter((key) => rootKeys.includes(key))
      : [];
  if (found.length === 0) throw new ParseError("the input names no OSCAL document type");
  if (found.length > 1) {
    const message = `the input names more than one document type: ${found.join(", ")}`;
    throw new ParseError(message, [{ location: "", messages: [message] }]);
  }
  if (expected !== undefined && found[0] !== expected) throw new DocumentTypeMismatchError(expected, found[0]);
  return found[0];
}

/**
 * The validators of an element type, by its kebab-case element-type name (design D4). Returns `undefined` for a name that
 * is not in the registry, so the caller owns the error.
 */
export function elementValidators(elementType: string): Validators | undefined {
  const pointer = elementPointers.get(elementType);
  return pointer === undefined ? undefined : validatorsAt(elementType, pointer);
}

/** The deepest nesting that a parse or an element validation accepts. An object or an array is one level. */
export const MAX_NESTING_DEPTH = 250;

/** The child values of an object or an array. */
const childrenOf = (node: object): unknown[] => (Array.isArray(node) ? node : Object.values(node));

/**
 * Whether the nesting depth of a JSON value is over the limit. The walk keeps one cursor for each open object or array,
 * so it does not recurse, and its stack grows only with the depth.
 */
export function exceedsDepthLimit(root: unknown): boolean {
  if (root === null || typeof root !== "object") return false;
  const stack = [{ values: childrenOf(root), next: 0 }];
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (top.next === top.values.length) {
      stack.pop();
      continue;
    }
    const value = top.values[top.next++];
    if (value !== null && typeof value === "object") {
      if (stack.length >= MAX_NESTING_DEPTH) return true;
      stack.push({ values: childrenOf(value), next: 0 });
    }
  }
  return false;
}

/** The message of the error that each operation throws when the nesting depth is over the limit. */
export const depthLimitMessage = `the nesting depth of the input is over the limit of ${MAX_NESTING_DEPTH} levels`;

/**
 * Runs a validate function on a value, and returns the result. The function then holds no errors, because a verbose
 * error can hold the whole input.
 */
export function passes(validate: ValidateFunction, value: unknown): boolean {
  const valid = validate(value) === true;
  validate.errors = null;
  return valid;
}

/** Runs a validate function on a value, and returns its errors. The function then holds no errors. */
function errorsOf(validate: ValidateFunction, value: unknown): ErrorObject[] {
  validate(value);
  const errors = validate.errors ?? [];
  validate.errors = null;
  return errors;
}

const escapeSegment = (segment: string) => segment.replaceAll("~", "~0").replaceAll("/", "~1");

/** One entry for each failing location (design D6). This function is the only owner of the location rules. */
function toEntries(errors: readonly ErrorObject[]): FailureEntry[] {
  const byLocation = new Map<string, string[]>();
  for (const error of errors) {
    let location = error.instancePath;
    if (error.keyword === "required") location += `/${escapeSegment(error.params.missingProperty)}`;
    if (error.keyword === "additionalProperties") location += `/${escapeSegment(error.params.additionalProperty)}`;
    const messages = byLocation.get(location);
    if (messages === undefined) byLocation.set(location, [error.message ?? error.keyword]);
    else messages.push(error.message ?? error.keyword);
  }
  return [...byLocation].map(([location, messages]) => ({ location, messages }));
}

/** One entry for each failing location of each error of the collecting validate function. */
export function collect(full: ValidateFunction, value: unknown): FailureEntry[] {
  return toEntries(errorsOf(full, value));
}

/** A location of a value, and the types that the `type` errors of the location name (design D4 of the YAML change). */
export interface TypeLocation {
  /** A JSON Pointer from the root of the value. */
  readonly location: string;
  /** The types of the `type` errors at the location, in the order of the errors. */
  readonly types: readonly string[];
}

/**
 * The locations of a value at which the collecting validator of the document branch of a root key reports a `type`
 * error, each with the types that the errors name. The YAML reader converts the text at each location by the grammar of
 * these types (YML-004).
 */
export function typeErrors(rootKey: string, value: unknown): TypeLocation[] {
  const byLocation = new Map<string, string[]>();
  for (const error of errorsOf(documentValidators(rootKey).full, value)) {
    if (error.keyword !== "type") continue;
    const types = byLocation.get(error.instancePath) ?? [];
    for (const type of String(error.params.type).split(",")) if (!types.includes(type)) types.push(type);
    byLocation.set(error.instancePath, types);
  }
  return [...byLocation].map(([location, types]) => ({ location, types }));
}

/** The selection that owns a location: the shortest prefix of the location that the map holds, at a segment boundary. */
function ownerOf(location: string, selections: ReadonlyMap<string, unknown>): string | undefined {
  for (let i = 0; i <= location.length; i++) {
    if (i < location.length && location[i] !== "/") continue;
    const prefix = location.slice(0, i);
    if (selections.has(prefix)) return prefix;
  }
  return undefined;
}

/**
 * The errors of a value, with only the errors of the selected branch for an object that selects a nested-union branch
 * (PRS-014). An object selects a branch when it holds the distinguishing property of exactly one variant (NAM-020).
 */
function selectedErrors(full: ValidateFunction, value: unknown): ErrorObject[] {
  const errors = errorsOf(full, value);
  const selections = new Map<string, { typeName: string; data: object }>();
  for (const error of errors) {
    if (error.keyword !== "anyOf") continue;
    const variants = siteVariants.get(error.parentSchema);
    const data: unknown = error.data;
    if (variants === undefined || data === null || typeof data !== "object" || Array.isArray(data)) continue;
    const held = variants.filter((variant) => Object.hasOwn(data, variant.property));
    if (held.length === 1) selections.set(error.instancePath, { typeName: held[0].typeName, data });
  }
  if (selections.size === 0) return errors;
  const result: ErrorObject[] = [];
  const done = new Set<string>();
  for (const error of errors) {
    const owner = ownerOf(error.instancePath, selections);
    if (owner === undefined) {
      result.push(error);
    } else if (!done.has(owner)) {
      done.add(owner);
      const { typeName, data } = selections.get(owner)!;
      for (const inner of selectedErrors(validatorFor(typeName), data)) {
        result.push({ ...inner, instancePath: owner + inner.instancePath });
      }
    }
  }
  return result;
}

/** One entry for each failing location of a parse error, with the failures of the selected branches only (PRS-014). */
export function collectSelected(full: ValidateFunction, value: unknown): FailureEntry[] {
  return toEntries(selectedErrors(full, value));
}
