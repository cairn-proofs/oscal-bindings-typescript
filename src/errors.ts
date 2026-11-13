/**
 * The error model of the binding (design.md D2, D5). Each failure of an operation is an `OscalError` with one of the
 * categories of ERR-001.
 */

/** The error categories of the corpus (ERR-001). */
export type ErrorCategory =
  | "parse-error"
  | "document-type-mismatch"
  | "not-found"
  | "read-error"
  | "access-error"
  | "unknown-element-type"
  | "limit-exceeded"
  | "builder-error";

/** The documented limits of the binding (ERR-010). */
export type Limit = "nesting-depth" | "alias-expansion";

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
  /** The documented limit that stopped the operation, or `undefined` when no limit stopped it (ERR-010). */
  readonly limit: Limit | undefined;

  constructor(category: ErrorCategory, message: string, limit?: Limit) {
    super(message);
    this.name = new.target.name;
    this.category = category;
    this.limit = limit;
  }
}

/**
 * The input is not an OSCAL document or an OSCAL element: it is not text, not JSON, too deep, or not valid against the
 * schema.
 */
export class ParseError extends OscalError {
  /** One entry for each failing location. The array is empty when the failure has no schema location. */
  readonly failures: readonly FailureEntry[];

  constructor(
    message: string,
    failures: readonly FailureEntry[] = [],
    options: { category?: ErrorCategory; limit?: Limit } = {},
  ) {
    super(options.category ?? "parse-error", message, options.limit);
    this.failures = failures;
  }
}

/** A typed parser read a document of another type (ERR-005). A caller that catches `ParseError` also catches it. */
export class DocumentTypeMismatchError extends ParseError {
  constructor(expectedRootKey: string, actualRootKey: string) {
    super(`expected a ${expectedRootKey} document, but the root key is ${actualRootKey}`, [], {
      category: "document-type-mismatch",
    });
  }
}

/** Element validation stopped at a documented limit (ERR-011). It is not a parse error. */
export class LimitExceededError extends OscalError {
  declare readonly limit: Limit;

  constructor(limit: Limit, message: string) {
    super("limit-exceeded", message, limit);
  }
}

/** A back-matter builder received invalid input (ERR-013). It is not a parse error. */
export class BuilderError extends OscalError {
  /** One entry for each failing location. The array is empty when the failure has no schema location. */
  readonly failures: readonly FailureEntry[];

  constructor(message: string, failures: readonly FailureEntry[] = []) {
    super("builder-error", message);
    this.failures = failures;
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

/** A file-path parse cannot read a path that exists (ERR-012). It is not a parse error and not a not-found error. */
export class ReadError extends OscalError {
  readonly path: string;

  constructor(path: string, options: { cause: unknown }) {
    super("read-error", `cannot read the file: ${path}`);
    this.path = path;
    this.cause = options.cause;
  }
}

/** An element-validation call names an element type that the binding does not recognize (ERR-008). */
export class UnknownElementTypeError extends OscalError {
  readonly elementType: string;

  constructor(elementType: string) {
    super("unknown-element-type", `unknown element type: ${elementType}`);
    this.elementType = elementType;
  }
}
