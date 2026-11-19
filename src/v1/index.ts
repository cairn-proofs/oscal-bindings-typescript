/**
 * The public API of the binding for OSCAL major version 1 (VER-001, design D1). This file only re-exports. Each
 * statement has one of three forms, and test/traceability.test.ts reads them from the text of this file.
 */
export { OSCAL_RELEASE } from "../generated/release.ts";
export { buildHash, buildRlink, buildResource } from "../backmatter.ts";
export type { RlinkOptions, ResourceOptions } from "../backmatter.ts";
export { OscalDoc } from "../document.ts";
export type { AssessmentPeriod, OscalBody } from "../document.ts";
export {
  OscalError,
  ParseError,
  DocumentTypeMismatchError,
  LimitExceededError,
  BuilderError,
  NotFoundError,
  ReadError,
  UnknownElementTypeError,
  AccessError,
} from "../errors.ts";
export type { ErrorCategory, Limit, FailureEntry } from "../errors.ts";
export {
  parse,
  parseFile,
  parseYaml,
  parseYamlFile,
  isValid,
  parseCatalog,
  parseMappingCollection,
  parseProfile,
  parseComponentDefinition,
  parseSystemSecurityPlan,
  parseAssessmentPlan,
  parseAssessmentResults,
  parsePlanOfActionAndMilestones,
} from "../parse.ts";
export { serialize, serializeYaml } from "../serialize.ts";
export type { SerializeOptions } from "../serialize.ts";
export { validateElement, supportedElementTypes } from "../validate-element.ts";
export type { ElementValidationResult } from "../validate-element.ts";
export type * from "../generated/oscal.ts";
