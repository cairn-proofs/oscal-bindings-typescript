/**
 * Runtime validators for the types of the naming manifest (design.md D1, D5).
 *
 * The complete OSCAL schema is the only source of the constraints. The validator of a type is the Ajv validate function
 * of the schema node that defines the type. The generator writes both inputs into `src/generated/`, so this module reads
 * only files of the repo.
 */
import { Ajv, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { type ElementType, elementTypes } from "./generated/element-types.ts";
import schema from "./generated/oscal-complete-schema.json" with { type: "json" };
import type { FailureEntry } from "./errors.ts";

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
 * differs (design D3). `strictTypes` is off, because the schema sets a `pattern` on a number (DecimalDatatype), and the
 * default value makes Ajv write a warning to the console. The default `unicodeRegExp` passes the `u` flag to the
 * pattern engine, so `\p{L}` and `\p{N}` keep their XSD meaning (PRS-007).
 */
function createAjv(allErrors: boolean): Ajv {
  const ajv = new Ajv({ allErrors, strictTypes: false, code: { regExp: regExpEngine } });
  // ajv-formats is CommonJS, so under NodeNext the callable is the `default` property of the default import.
  addFormats.default(ajv, ["date-time", "uri", "uri-reference", "email"]);
  ajv.addSchema(schema);
  return ajv;
}

// The instance that collects each error (PRS-006), and the instance that stops at the first error.
const ajv = createAjv(true);
const failFastAjv = createAjv(false);

const pointers = new Map(elementTypes.map((row) => [row.typeName, row.pointer]));
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
 * The validators of an element type, by its kebab-case element-type name (design D4). Returns `undefined` for a name that
 * is not in the registry, so the caller owns the error.
 */
export function elementValidators(elementType: string): Validators | undefined {
  const pointer = elementPointers.get(elementType);
  return pointer === undefined ? undefined : validatorsAt(elementType, pointer);
}

/** The deepest nesting that a parse or an element validation accepts. An object or an array is one level. */
const MAX_NESTING_DEPTH = 250;

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

const escapeSegment = (segment: string) => segment.replaceAll("~", "~0").replaceAll("/", "~1");

/**
 * One entry for each failing location (design D6). Runs the collecting validate function on the value, and reads its
 * errors.
 */
export function collect(full: ValidateFunction, value: unknown): FailureEntry[] {
  full(value);
  const byLocation = new Map<string, string[]>();
  for (const error of full.errors ?? []) {
    let location = error.instancePath;
    if (error.keyword === "required") location += `/${escapeSegment(error.params.missingProperty)}`;
    if (error.keyword === "additionalProperties") location += `/${escapeSegment(error.params.additionalProperty)}`;
    const messages = byLocation.get(location);
    if (messages === undefined) byLocation.set(location, [error.message ?? error.keyword]);
    else messages.push(error.message ?? error.keyword);
  }
  return [...byLocation].map(([location, messages]) => ({ location, messages }));
}
