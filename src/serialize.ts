/**
 * The serialize operations (design.md D1, D2). A document is already the JSON value of OSCAL, so `serialize` passes it
 * to `JSON.stringify` and does no other transformation. `serializeYaml` writes the same value as YAML (design D6 of the
 * add-yaml-documents change).
 */
import type { OscalDocument } from "./generated/oscal.ts";

export interface SerializeOptions {
  /** When true, the output has no whitespace between tokens. The default is false. */
  readonly compact?: boolean;
}

/**
 * Writes an OSCAL document as OSCAL JSON text (SER-001 to SER-005). The default output has an indent of 2 spaces and no
 * trailing newline. The `compact` option gives the output without whitespace.
 *
 * The output has no null for a document that matches the generated types. The operation does not check the document.
 * A `null` that a caller puts into a document through a type cast or from JavaScript is written as is.
 */
export function serialize(document: OscalDocument, options?: SerializeOptions): string {
  return options?.compact === true ? JSON.stringify(document) : JSON.stringify(document, null, 2);
}

/** Whether a value is an object or an array that has at least one entry to write. */
function isBlock(value: unknown): value is object {
  if (value === null || typeof value !== "object") return false;
  return Array.isArray(value) ? value.length > 0 : writtenEntries(value).length > 0;
}

/** The entries of an object that `JSON.stringify` writes: it leaves out a property whose value is `undefined`. */
const writtenEntries = (object: object) => Object.entries(object).filter(([, value]) => value !== undefined);

/** One line for a value that is not a block: a scalar, an empty array, or an empty object. */
function inline(value: unknown): string {
  if (Array.isArray(value)) return "[]";
  if (value !== null && typeof value === "object") return "{}";
  // A string is also a YAML 1.2 double-quoted scalar, and a number or a boolean is also a YAML scalar.
  return JSON.stringify(value) ?? "null";
}

/** Writes a block value at an indent. Each line of the result starts with the indent. */
function writeBlock(value: object, indent: string, lines: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isBlock(item)) {
        // The first line of the item takes the place of the indent of its own level, so the `-` shares it.
        const first = lines.length;
        writeBlock(item, `${indent}  `, lines);
        lines[first] = `${indent}- ${lines[first].slice(indent.length + 2)}`;
      } else {
        lines.push(`${indent}- ${inline(item)}`);
      }
    }
    return;
  }
  for (const [key, item] of writtenEntries(value)) {
    if (isBlock(item)) {
      lines.push(`${indent}${JSON.stringify(key)}:`);
      writeBlock(item, `${indent}  `, lines);
    } else {
      lines.push(`${indent}${JSON.stringify(key)}: ${inline(item)}`);
    }
  }
}

/**
 * Writes an OSCAL document as YAML (YML-008). The output is one YAML 1.2 document in block style, with an indent of 2
 * spaces, and it ends with a line break. Each key, string, number, and boolean is written as `JSON.stringify` writes it,
 * so a string is a double-quoted scalar on one line, and a reader reads back the same value (YML-008.02). An empty
 * object is `{}`, and an empty array is `[]`. A property that is `undefined` is absent (SER-001, SER-002, SER-005).
 *
 * The output has no null for a document that matches the generated types. The operation does not check the document.
 * A `null` that a caller puts into a document through a type cast or from JavaScript is written as `null`.
 */
export function serializeYaml(document: OscalDocument): string {
  const lines: string[] = [];
  if (isBlock(document)) writeBlock(document, "", lines);
  else lines.push(inline(document));
  return `${lines.join("\n")}\n`;
}
