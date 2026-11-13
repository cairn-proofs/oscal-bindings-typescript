/**
 * The only module of the conformance harness that imports the binding. Each function is one binding operation that the
 * corpus uses. A change that adds an operation replaces the matching `notImplemented()` call with the operation. The
 * runner in runner.ts holds the rules of the corpus, so no other file changes.
 */

import { buildHash, buildResource, buildRlink, type ResourceOptions, type RlinkOptions } from "../../src/backmatter.ts";
import { OscalDoc } from "../../src/document.ts";
import { OscalError, ParseError } from "../../src/errors.ts";
import type { HashAlgorithm, OscalDocument } from "../../src/generated/oscal.ts";
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

/** FAC-002: the values that the facade reads. */
export interface FacadeView {
  wrapper: unknown;
  body: unknown;
  metadata: unknown;
  oscalVersion: string;
  uuid: string;
}

/** The five values of a facade. */
const viewOf = (doc: OscalDoc): FacadeView => ({
  wrapper: doc.wrapper,
  body: doc.body,
  metadata: doc.metadata,
  oscalVersion: doc.oscalVersion,
  uuid: doc.uuid,
});

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
  /** FAC-001: the facade of a parsed document. */
  facade(document: unknown): FacadeView;
  /** FAC-003: the facade of raw bytes. */
  facadeFromBytes(input: Uint8Array): FacadeView;
  /** FAC-003: the facade of a file path. */
  facadeFromPath(path: string): FacadeView;
  /** BMB-001: the hash builder. Returns the hash. */
  buildHash(args: { value: string; algorithm?: string }): unknown;
  /** BMB-002: the rlink builder. Returns the rlink. */
  buildRlink(args: { href: string; "media-type"?: string; hashes?: unknown[] }): unknown;
  /** BMB-004: the resource builder. The `identifier` argument is the `uuid` option. Returns the resource. */
  buildResource(args: { key?: string; title?: string; identifier?: string; "document-ids"?: unknown[] }): unknown;
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
  facade: (document) => viewOf(new OscalDoc(document as OscalDocument)),
  facadeFromBytes: (input) => viewOf(OscalDoc.fromJson(input)),
  facadeFromPath: (path) => viewOf(OscalDoc.fromFile(path)),
  buildHash: ({ value, algorithm }) => buildHash(value, algorithm as HashAlgorithm | undefined),
  buildRlink: ({ href, ...options }) => buildRlink(href, options as RlinkOptions),
  buildResource: ({ identifier, ...rest }) => buildResource({ ...(rest as ResourceOptions), uuid: identifier }),
  category: (error) => {
    if (error instanceof OscalError) return error.category;
    throw error;
  },
  failureCount: (error) => (error instanceof ParseError ? error.failures.length : 0),
};
