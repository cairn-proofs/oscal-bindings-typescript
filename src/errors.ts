/**
 * The error model of the binding (design.md D2, D5). Each failure of an operation is an `OscalError` with one of the
 * categories of ERR-001, except a file read error that the contract does not define (design.md D7).
 */

/** The error categories of the corpus (ERR-001). */
export type ErrorCategory =
  | "parse-error"
  | "document-type-mismatch"
  | "not-found"
  | "access-error"
  | "unknown-element-type";

/** One failing location of a schema failure (PRS-006, design.md D5). */
export interface FailureEntry {
  /** A JSON Pointer from the root of the input. */
  readonly location: string;
  /** The messages of that location, in the order of the validator errors. */
  readonly messages: readonly string[];
}

/** The base class of each error that an operation of the binding throws on purpose. */
export class OscalError extends Error {
  readonly category: ErrorCategory;

  constructor(category: ErrorCategory, message: string) {
    super(message);
    this.name = new.target.name;
    this.category = category;
  }
}

/** The input is not an OSCAL document: it is not text, not JSON, too deep, or not valid against the schema. */
export class ParseError extends OscalError {
  /** One entry for each failing location. The array is empty when the failure has no schema location. */
  readonly failures: readonly FailureEntry[];

  constructor(message: string, failures: readonly FailureEntry[] = [], category: ErrorCategory = "parse-error") {
    super(category, message);
    this.failures = failures;
  }
}

/** A typed parser read a document of another type (ERR-005). A caller that catches `ParseError` also catches it. */
export class DocumentTypeMismatchError extends ParseError {
  constructor(expectedRootKey: string, actualRootKey: string) {
    super(`expected a ${expectedRootKey} document, but the root key is ${actualRootKey}`, [], "document-type-mismatch");
  }
}

/** A path does not exist (ERR-006). */
export class NotFoundError extends OscalError {
  readonly path: string;

  constructor(path: string) {
    super("not-found", `file not found: ${path}`);
    this.path = path;
  }
}
