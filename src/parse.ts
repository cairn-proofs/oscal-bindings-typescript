/**
 * The parse operations (design.md D1, D4 to D7). Each operation runs the stages of one internal pipeline. A stage ends
 * the operation at its first failure, so the binding does no more work on input that is known to be invalid.
 */
import fs from "node:fs";
import { NotFoundError, ParseError, ReadError } from "./errors.ts";
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
import { decodeText } from "./text.ts";
import {
  collectSelected,
  depthLimitMessage,
  documentValidators,
  exceedsDepthLimit,
  passes,
  rootKeyOf,
} from "./validators.ts";
import { yamlToJson } from "./yaml.ts";

type Input = string | Uint8Array;

/** Stage 1 and 2: the JSON value of the input. */
function decodeJson(input: Input): unknown {
  const text = decodeText(input);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ParseError(`the input is not valid JSON: ${(error as Error).message}`);
  }
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

/** The bytes of the file at a path. Throws a `NotFoundError` and a `ReadError` as `parseFile` documents. */
function readBytes(path: string): Uint8Array {
  try {
    return fs.readFileSync(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") throw new NotFoundError(path);
    if (error instanceof TypeError) throw error;
    throw new ReadError(path, { cause: error });
  }
}

/**
 * Reads an OSCAL document from a file path (PRS-002). Throws a `NotFoundError` for a path that does not exist
 * (ERR-006). Throws a `ReadError` for a path that exists and cannot be read, for example a directory (ERR-012). Its
 * `cause` holds the Node error. A `TypeError` for an argument that is not a path passes through unchanged.
 */
export function parseFile(path: string): OscalDocument {
  return parse(readBytes(path));
}

/**
 * Reads an OSCAL document from YAML text or UTF-8 bytes (YML-005). The result is the result of `parse` for the JSON text
 * of the input, so each rule of `parse` applies. A scalar that does not match the grammar of its type gives a
 * `ParseError` with one entry for its location (YML-010). A YAML input that is not one YAML 1.2 document, or that has a
 * key that is not a scalar, a key two times, or an alias with no anchor, gives a `ParseError` with no entries (YML-002,
 * YML-003, YML-009). The message of a YAML syntax error holds lines of the input. An input over the limit
 * `nesting-depth` or `alias-expansion` gives a `ParseError` with that limit (PRS-010).
 */
export function parseYaml(input: string | Uint8Array): OscalDocument {
  return parseInput(yamlToJson(input)) as OscalDocument;
}

/**
 * Reads an OSCAL document from the YAML file at a path (YML-006). It reads the file as `parseFile` does, so it throws a
 * `NotFoundError` for a path that does not exist (ERR-006) and a `ReadError` for a path that exists and cannot be read
 * (ERR-012). It then parses the bytes as `parseYaml` does.
 */
export function parseYamlFile(path: string): OscalDocument {
  return parseYaml(readBytes(path));
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
