/**
 * The YAML reader (design.md D2 to D4 of the add-yaml-documents change). `yamlToJson` reads one YAML 1.2 document and
 * returns the JSON text of the document (YML-005). The JSON pipeline of `src/parse.ts` does the rest.
 *
 * 1. Parse the text with the `yaml` package, failsafe schema. Each scalar keeps its text, and a tag does not change a
 *    node (YML-009).
 * 2. Build a tree of objects, arrays, and strings. A mapping key is the text of a scalar (YML-003). An alias reads the
 *    node of its anchor again (YML-009).
 * 3. Convert the text at each location that the schema types as a number, an integer, or a boolean (YML-004).
 * 4. Write the JSON text. A converted number keeps the text of its scalar (YML-005).
 */
import { isAlias, isMap, isScalar, isSeq, parseAllDocuments, type Alias, type Node, type Scalar } from "yaml";
import { ParseError } from "./errors.ts";
import { decodeText } from "./text.ts";
import {
  depthLimitMessage,
  documentValidators,
  MAX_NESTING_DEPTH,
  passes,
  rootKeyOf,
  typeErrors,
} from "./validators.ts";

/** The most nodes that the aliases of an input can give. The count includes nodes that a nested alias gives. */
export const MAX_ALIAS_NODES = 100_000;
/** The most characters of scalar text that the aliases of an input can give. */
export const MAX_ALIAS_CHARACTERS = 10_000_000;

/** The number grammar of RFC 8259, section 6 (YML-004). */
const JSON_NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
const JSON_BOOLEAN = /^(?:true|false)$/;

/** An object of the tree. It has no prototype, so a key `__proto__` is an own property. */
type TextObject = { [key: string]: Tree };
type Tree = string | number | boolean | Tree[] | TextObject;

/** The error of an alias or a mapping that YML-003 and YML-009 reject. It has no schema location. */
const reject = (message: string) => new ParseError(message);

/** The error of a stack overflow of the `yaml` package, and of a tree that is too deep (design D2, D3). */
const tooDeep = () => new ParseError(depthLimitMessage, [], { limit: "nesting-depth" });

/** Step 1: the one document of the text. Throws a `ParseError` with no entries for a text that is not one document. */
function oneDocument(text: string) {
  const documents = parseAllDocuments(text, { schema: "failsafe", resolveKnownTags: false, uniqueKeys: false });
  const list = Array.isArray(documents) ? documents : [];
  const errors = list.flatMap((document) => document.errors);
  // The package catches a stack overflow of its own recursion and reports it as a document error (design D2).
  const overflow = errors.find(
    (error) => error.code === "RESOURCE_EXHAUSTION" && error.message.startsWith("Maximum call stack size exceeded"),
  );
  if (overflow !== undefined) throw tooDeep();
  if (errors.length > 0) throw reject(`the input is not valid YAML: ${errors[0].message}`);
  if (list.length === 0) throw reject("the input holds no YAML document");
  if (list.length > 1) throw reject("the input holds more than one YAML document");
  return list[0];
}

/** Step 2: the tree of text. */
function textTree(contents: Node | null): Tree {
  /** The node of each anchor name, as of the last node of that name that the walk entered in document order. */
  const anchors = new Map<string, Node>();
  /** The node of each alias, resolved where the walk first reaches the alias. */
  const resolved = new Map<Alias, Node>();
  /** The nodes that the walk has entered and not left. */
  const open = new Set<Node>();
  /** The count of aliases that the walk is inside. Each node that the walk reads in an alias counts against the limits. */
  let expanding = 0;
  let nodes = 0;
  let characters = 0;

  const count = (text: string | undefined) => {
    nodes++;
    characters += text?.length ?? 0;
    if (nodes > MAX_ALIAS_NODES || characters > MAX_ALIAS_CHARACTERS) {
      throw new ParseError(
        `the aliases of the input give more than ${MAX_ALIAS_NODES} nodes or ${MAX_ALIAS_CHARACTERS} characters of text`,
        [],
        { limit: "alias-expansion" },
      );
    }
  };

  /** The node that an alias names. The anchor is the most recent one before the alias. */
  const target = (alias: Alias): Node => {
    let node = resolved.get(alias);
    if (node === undefined) {
      node = anchors.get(alias.source);
      if (node === undefined) throw reject("an alias has no anchor before it");
      resolved.set(alias, node);
    }
    if (open.has(node)) throw reject("an alias is inside its own anchored node");
    return node;
  };

  const textOf = (scalar: Scalar): string => String(scalar.source ?? "");

  /** The text of a mapping key. Throws when the key is not a scalar. */
  const keyText = (key: unknown): string => {
    if (key === null || key === undefined) return "";
    let node = key as Node;
    if (isAlias(node)) {
      node = target(node);
      if (!isScalar(node)) throw reject("a mapping key is not a scalar");
      count(textOf(node));
      return textOf(node);
    }
    if (!isScalar(node)) throw reject("a mapping key is not a scalar");
    if (expanding > 0) count(textOf(node));
    else if (node.anchor !== undefined) anchors.set(node.anchor, node);
    return textOf(node);
  };

  const read = (node: Node | null | undefined, level: number): Tree => {
    if (node === null || node === undefined) return "";
    if (isAlias(node)) {
      const source = target(node);
      expanding++;
      try {
        return read(source, level);
      } finally {
        expanding--;
      }
    }
    if (expanding > 0) count(isScalar(node) ? textOf(node) : undefined);
    else if (node.anchor !== undefined) anchors.set(node.anchor, node);
    if (isScalar(node)) return textOf(node);
    if (level > MAX_NESTING_DEPTH) throw tooDeep();
    open.add(node);
    try {
      if (isSeq(node)) return node.items.map((item) => read(item as Node | null, level + 1));
      if (isMap(node)) {
        const out: TextObject = Object.create(null) as TextObject;
        for (const pair of node.items) {
          const key = keyText(pair.key);
          if (Object.hasOwn(out, key)) throw reject("a mapping holds the same key two times");
          out[key] = read(pair.value as Node | null, level + 1);
        }
        return out;
      }
    } finally {
      open.delete(node);
    }
    throw reject("the input holds a YAML node that the reader does not support");
  };

  return read(contents, 1);
}

/** The text that each converted number had, by the object or the array that holds it, then by key or index. */
type NumberTexts = Map<object, Map<string, string>>;

/** The segments of a JSON Pointer. */
const segmentsOf = (pointer: string): string[] =>
  pointer
    .split("/")
    .slice(1)
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));

/**
 * Step 3: converts the text at each location that the schema types as a number, an integer, or a boolean (YML-004).
 * Each pass takes the types that the `type` errors of a location name, in the order number, integer, boolean, and
 * converts the text by the grammar of the first type that it matches. A text that matches no grammar stays a string,
 * so the JSON pipeline reports it as a `type` failure (YML-010). The loop ends when the fail-fast check passes or a
 * pass converts no text.
 */
function convert(tree: Tree, rootKey: string): NumberTexts {
  const numbers: NumberTexts = new Map();
  for (;;) {
    if (passes(documentValidators(rootKey).failFast, tree)) return numbers;
    let converted = 0;
    for (const { location, types } of typeErrors(rootKey, tree)) {
      const segments = segmentsOf(location);
      if (segments.length === 0) continue;
      let parent = tree as unknown as Record<string, Tree>;
      for (const segment of segments.slice(0, -1)) parent = parent[segment] as unknown as Record<string, Tree>;
      const key = segments[segments.length - 1];
      const text = parent[key];
      if (typeof text !== "string") continue;
      const type = (["number", "integer", "boolean"] as const).find(
        (candidate) => types.includes(candidate) && (candidate === "boolean" ? JSON_BOOLEAN : JSON_NUMBER).test(text),
      );
      if (type === undefined) continue;
      if (type === "boolean") {
        parent[key] = text === "true";
      } else {
        parent[key] = Number(text);
        const held = numbers.get(parent) ?? new Map<string, string>();
        held.set(key, text);
        numbers.set(parent, held);
      }
      converted++;
    }
    if (converted === 0) return numbers;
  }
}

/** Step 4: the JSON text of the tree. A converted number is the text of its scalar. */
function jsonText(value: Tree, numbers: NumberTexts, parts: string[], holder?: object, key?: string): void {
  if (typeof value === "number") {
    parts.push(holder === undefined ? String(value) : (numbers.get(holder)?.get(key as string) ?? String(value)));
  } else if (typeof value === "string" || typeof value === "boolean") {
    parts.push(JSON.stringify(value));
  } else if (Array.isArray(value)) {
    parts.push("[");
    value.forEach((item, index) => {
      if (index > 0) parts.push(",");
      jsonText(item, numbers, parts, value, String(index));
    });
    parts.push("]");
  } else {
    parts.push("{");
    let first = true;
    for (const [name, item] of Object.entries(value)) {
      if (!first) parts.push(",");
      first = false;
      parts.push(JSON.stringify(name), ":");
      jsonText(item, numbers, parts, value, name);
    }
    parts.push("}");
  }
}

/**
 * Reads YAML text or UTF-8 bytes, and returns the JSON text of the document (YML-005). Throws a `ParseError` with no
 * entries for an input that is not one YAML 1.2 document in UTF-8 (YML-002), for a mapping key that is not a scalar or
 * that occurs two times (YML-003), for an alias with no anchor or an alias inside its own anchored node (YML-009), and
 * for an input over the limit `nesting-depth` or `alias-expansion` (PRS-010).
 */
export function yamlToJson(input: string | Uint8Array): string {
  const document = oneDocument(decodeText(input));
  const tree = textTree(document.contents as Node | null);
  // A tree with no root key, or with more than one, has no type to convert by. The JSON pipeline reports the error.
  let rootKey: string | undefined;
  try {
    rootKey = rootKeyOf(tree);
  } catch (error) {
    if (!(error instanceof ParseError)) throw error;
  }
  const numbers = rootKey === undefined ? new Map() : convert(tree, rootKey);
  const parts: string[] = [];
  jsonText(tree, numbers, parts);
  return parts.join("");
}
