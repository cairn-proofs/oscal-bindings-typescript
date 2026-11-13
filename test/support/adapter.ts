/**
 * The only module of the conformance harness that imports the binding. Each function is one binding operation that the
 * corpus uses. A change that adds an operation replaces the matching `notImplemented()` call with the operation. The
 * runner in runner.ts holds the rules of the corpus, so no other file changes.
 */

import { OscalError, ParseError } from "../../src/errors.ts";
import type { OscalDocument } from "../../src/generated/oscal.ts";
import {
  isValid,
  parse,
  parseAssessmentPlan,
  parseAssessmentResults,
  parseCatalog,
  parseComponentDefinition,
  parseFile,
  parseMappingCollection,
  parsePlanOfActionAndMilestones,
  parseProfile,
  parseSystemSecurityPlan,
  parseYaml,
} from "../../src/parse.ts";
import { serialize, serializeYaml } from "../../src/serialize.ts";
import { supportedElementTypes, validateElement } from "../../src/validate-element.ts";

/** The typed parser of each root key. */
const typedParsers: Record<string, (input: string | Uint8Array) => unknown> = {
  catalog: parseCatalog,
  "mapping-collection": parseMappingCollection,
  profile: parseProfile,
  "component-definition": parseComponentDefinition,
  "system-security-plan": parseSystemSecurityPlan,
  "assessment-plan": parseAssessmentPlan,
  "assessment-results": parseAssessmentResults,
  "plan-of-action-and-milestones": parsePlanOfActionAndMilestones,
};

/** Thrown by each adapter function until the binding has the operation. */
export class NotImplemented extends Error {
  constructor(operation: string) {
    super(`not implemented: ${operation}`);
    this.name = "NotImplemented";
  }
}

function notImplemented(operation: string): never {
  throw new NotImplemented(operation);
}

/** The corpus error categories (cases.json, `categories`). */
export type Category = string;

/** The operations of the binding that the corpus uses. */
export interface Adapter {
  /** PRS-001: the generic parse. */
  parse(input: string | Uint8Array): unknown;
  /** PRS-003: the typed parse for the root key `documentType`. */
  parseTyped(documentType: string, input: string | Uint8Array): unknown;
  /** PRS-002: the parse of a file path. */
  parseFile(path: string): unknown;
  /** The JSON serialization of a parsed document. */
  serialize(document: unknown): string;
  /** ERR-002: the non-raising validity check. */
  isValid(input: string | Uint8Array): boolean;
  /** ELV-001: the validation of a standalone element. Returns the validity result. */
  validateElement(elementType: string, value: unknown): boolean;
  /** ELV-002: the list of supported element-type names. */
  elementTypes(): readonly string[];
  /** FAC-004: the assessment period accessor on the facade of a parsed document. */
  assessmentPeriod(document: unknown): unknown;
  /** YML-005: the parse of YAML text or bytes. */
  parseYaml(input: string | Uint8Array): unknown;
  /** YML-008: the serialization to YAML. */
  serializeYaml(document: unknown): string;
  /** The corpus category of an error that an operation threw. */
  category(error: unknown): Category;
  /** The count of structured failure entries of a parse error. */
  failureCount(error: unknown): number;
}

export const adapter: Adapter = {
  parse,
  parseTyped: (documentType, input) => {
    const parser = typedParsers[documentType];
    if (parser === undefined) throw new Error(`${documentType} is not a document type`);
    return parser(input);
  },
  parseFile,
  serialize: (document) => serialize(document as OscalDocument),
  isValid,
  validateElement: (elementType, value) => validateElement(elementType, value).valid,
  elementTypes: supportedElementTypes,
  assessmentPeriod: () => notImplemented("assessmentPeriod"),
  parseYaml,
  serializeYaml: (document) => serializeYaml(document as OscalDocument),
  category: (error) => {
    if (error instanceof OscalError) return error.category;
    throw error;
  },
  failureCount: (error) => (error instanceof ParseError ? error.failures.length : 0),
};
