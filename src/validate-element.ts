/**
 * Element validation (design.md D1, D2). `validateElement` runs the stages of one pipeline. A stage ends the operation at
 * its first failure, so the binding does no schema work on input that an earlier stage already rejects.
 */
import { type FailureEntry, LimitExceededError, UnknownElementTypeError } from "./errors.ts";
import {
  collect,
  depthLimitMessage,
  elementTypes,
  elementValidators,
  exceedsDepthLimit,
  passes,
} from "./validators.ts";

/** The result of `validateElement`. */
export interface ElementValidationResult {
  /** True when the element conforms to the constraints of the element type. */
  readonly valid: boolean;
  /** One entry for each failing location. The array is empty when `valid` is true. */
  readonly failures: readonly FailureEntry[];
}

const names: readonly string[] = Object.freeze(elementTypes.map((row) => row.elementType));

/**
 * Validates a standalone element against a named element type (ELV-001). Throws an `UnknownElementTypeError` for a name
 * that is not in the registry (ELV-003, ERR-008). Throws a `LimitExceededError` for a value that is nested deeper than
 * the limit (ELV-004, ERR-011).
 */
export function validateElement(elementType: string, value: unknown): ElementValidationResult {
  const validators = elementValidators(elementType);
  if (validators === undefined) throw new UnknownElementTypeError(elementType);
  if (exceedsDepthLimit(value)) throw new LimitExceededError("nesting-depth", depthLimitMessage);
  if (passes(validators.failFast, value)) return { valid: true, failures: [] };
  return { valid: false, failures: collect(validators.full, value) };
}

/** The element-type names that `validateElement` accepts: kebab-case, sorted (ELV-002). */
export function supportedElementTypes(): readonly string[] {
  return names;
}
