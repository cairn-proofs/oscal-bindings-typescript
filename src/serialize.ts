/**
 * The serialize operation (design.md D1, D2). A document is already the JSON value of OSCAL, so `serialize` passes it
 * to `JSON.stringify` and does no other transformation.
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
