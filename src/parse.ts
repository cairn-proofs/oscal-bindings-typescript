/**
 * The parse operations (design.md D1, D4 to D7). Each operation runs the stages of one internal pipeline. A stage ends
 * the operation at its first failure, so the binding does no more work on input that is known to be invalid.
 */
import fs from "node:fs";
import { DocumentTypeMismatchError, NotFoundError, ParseError, ReadError } from "./errors.ts";
import type {
  AssessmentPlanDocument,
  AssessmentResultsDocument,
  CatalogDocument,
  ComponentDefinitionDocument,
  MappingCollectionDocument,
  OscalDocument,
  PlanOfActionAndMilestonesDocument,
  ProfileDocument,
  SystemSecurityPlanDocument,
} from "./generated/oscal.ts";
import {
  collectSelected,
  depthLimitMessage,
  documentValidators,
  exceedsDepthLimit,
  passes,
  rootKeys,
} from "./validators.ts";

type Input = string | Uint8Array;

const utf8 = new TextDecoder("utf-8", { fatal: true });

/** Stage 1 and 2: the JSON value of the input. */
function decodeJson(input: Input): unknown {
  let text: string;
  if (typeof input === "string") {
    text = input;
  } else if (input instanceof Uint8Array) {
    try {
      text = utf8.decode(input);
    } catch {
      throw new ParseError("the input is not valid UTF-8");
    }
  } else {
    throw new ParseError("the input is not text or bytes");
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ParseError(`the input is not valid JSON: ${(error as Error).message}`);
  }
}

/** Stage 4: the one root key of the input. Throws for no root key, for two or more, and for a typed mismatch. */
function rootKeyOf(value: unknown, expected?: string): string {
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

/** Stages 1 to 4. Returns the parsed value and its root key. */
function read(input: Input, expected?: string): { value: unknown; rootKey: string } {
  const value = decodeJson(input);
  if (exceedsDepthLimit(value)) throw new ParseError(depthLimitMessage, [], { limit: "nesting-depth" });
  return { value, rootKey: rootKeyOf(value, expected) };
}

/** The pipeline of every parse operation. The typed parsers pass the expected root key. */
function parseInput(input: Input, expected?: string): unknown {
  const { value, rootKey } = read(input, expected);
  if (passes(documentValidators(rootKey).failFast, value)) return value;
  const failures = collectSelected(documentValidators(rootKey).full, value);
  throw new ParseError(`the ${rootKey} document is not valid at ${failures.length} location(s)`, failures);
}

/** Reads an OSCAL document of any type from JSON text or UTF-8 bytes (PRS-001). Throws a `ParseError`. */
export function parse(input: string | Uint8Array): OscalDocument {
  return parseInput(input) as OscalDocument;
}

/**
 * Reads an OSCAL document from a file path (PRS-002). Throws a `NotFoundError` for a path that does not exist
 * (ERR-006). Throws a `ReadError` for a path that exists and cannot be read, for example a directory (ERR-012). Its
 * `cause` holds the Node error. A `TypeError` for an argument that is not a path passes through unchanged.
 */
export function parseFile(path: string): OscalDocument {
  let bytes: Uint8Array;
  try {
    bytes = fs.readFileSync(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") throw new NotFoundError(path);
    if (error instanceof TypeError) throw error;
    throw new ReadError(path, { cause: error });
  }
  return parse(bytes);
}

/** Whether the input is a valid OSCAL document. Never throws (ERR-002). */
export function isValid(input: string | Uint8Array): boolean {
  try {
    const { value, rootKey } = read(input);
    return passes(documentValidators(rootKey).failFast, value);
  } catch {
    return false;
  }
}

const typed =
  <T extends OscalDocument>(rootKey: string) =>
  (input: string | Uint8Array): T =>
    parseInput(input, rootKey) as T;

/** Typed parsers (PRS-003). Each throws a `DocumentTypeMismatchError` for a document of another type. */
export const parseCatalog = typed<CatalogDocument>("catalog");
export const parseMappingCollection = typed<MappingCollectionDocument>("mapping-collection");
export const parseProfile = typed<ProfileDocument>("profile");
export const parseComponentDefinition = typed<ComponentDefinitionDocument>("component-definition");
export const parseSystemSecurityPlan = typed<SystemSecurityPlanDocument>("system-security-plan");
export const parseAssessmentPlan = typed<AssessmentPlanDocument>("assessment-plan");
export const parseAssessmentResults = typed<AssessmentResultsDocument>("assessment-results");
export const parsePlanOfActionAndMilestones = typed<PlanOfActionAndMilestonesDocument>(
  "plan-of-action-and-milestones",
);
