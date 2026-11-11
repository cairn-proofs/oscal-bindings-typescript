## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `src/generated/element-types.ts` holds one row for each manifest type, sorted by element-type name. Each row holds
   the kebab-case element-type name, the canonical type name, and the JSON pointer of the schema node of the type. The
   generator derives the kebab-case name from the canonical type name.
2. `src/validators.ts` builds two Ajv instances from one factory. One instance stops at the first error. The other
   collects each error. `documentValidators` returns the validate functions of both instances for one document branch.
3. `src/parse.ts` has two internal stages that this change also needs:
   1. A depth walk that stops an input deeper than 250 levels, because the schema checks recurse once for each level.
      The walk does not recurse.
   2. `collect`, which maps the Ajv errors of a failed check to one `FailureEntry` for each failing location.
4. `ErrorCategory` in `src/errors.ts` already holds `unknown-element-type`. No error class uses it.
5. The corpus gives the element value of each `element/*` case as the value of `JSON.parse`. The adapter returns the
   validity of the result as a boolean, or the category of a thrown error.

## Goals / Non-Goals

**Goals:**

1. `validateElement` gives the same failure entries, the same depth limit, and the same fail-fast behavior as a parse.

**Non-Goals:**

1. A TypeScript union type of the element-type names.

## Decisions

### D1: The operations

`src/validate-element.ts` exports these synchronous operations:

```ts
export interface ElementValidationResult {
  /** True when the element conforms to the constraints of the element type. */
  readonly valid: boolean;
  /** One entry for each failing location. The array is empty when `valid` is true. */
  readonly failures: readonly FailureEntry[];
}

export function validateElement(elementType: string, value: unknown): ElementValidationResult;

export function supportedElementTypes(): readonly string[];
```

1. `supportedElementTypes` returns the `elementType` value of each row of the registry, in the order of the registry
   ([ELV-002]). It returns the same frozen array on each call.
2. The `elementType` parameter is a `string`, because the operation checks the name at runtime for [ELV-003].

**Why:** the result has the same `failures` property in each case, so a caller reads it with no type narrowing. An
empty array states "valid with no failures", as ELV-001.01 requires. The entries use the `FailureEntry` type of a parse
error, so a failing element and a failing document give the same entries.

### D2: The stages of `validateElement`

`validateElement` runs these stages in this order. A stage ends the operation at its first failure:

1. Find the validators of the element type (D4). For a name that is not in the registry, throw an
   `UnknownElementTypeError` (D5) ([ELV-003], [ERR-008]).
2. Check the nesting depth of the value (D3).
3. Run the fail-fast validator. When it passes, return `{ valid: true, failures: [] }`.
4. Run the collecting validator, and return `{ valid: false, failures }` with the entries of D6 ([ELV-001]).

**Why:** each stage is cheaper than the next stage. The operation does no schema work on a value that an earlier stage
already rejects. Stages 3 and 4 are the same as the last two stages of a parse.

### D3: The depth limit

The limit of the parse operations also applies to `validateElement`. The limit, its count, and its message are the
same as for a parse:

1. Each object and each array is one level. A scalar adds no level. The root value is level 1.
2. A value deeper than 250 levels gives a `ParseError` that names the limit, with no failure entries.

The depth walk and the limit move from `src/parse.ts` to `src/validators.ts`, as one internal function that throws the
`ParseError`. The parse pipeline and `validateElement` call the same function.

**Why:** the validators recurse once for each level of the value. The source of the value does not change this. A
value that is too deep makes them throw a `RangeError`. The depth walk keeps an explicit stack and visits each child.
A value that refers to itself has no end, so the walk reaches the limit and stops it with the same `ParseError`.

### D4: The validators of an element type

`src/validators.ts` exports `elementValidators(elementType: string)`. It returns the fail-fast and collecting validate
functions of the schema node of the row, or `undefined` for a name that is not in the registry. The interface
`DocumentValidators` becomes `Validators`, because it now serves documents and elements.

**Why:** the lookup uses the registry of Context item 1, so the kebab-case names come from the generator ([ELV-002]).
The lookup returns `undefined` and does not throw, so `validateElement` owns the error of [ELV-003]. `validatorFor`
does not change.

### D5: The unknown-element-type error

`src/errors.ts` adds this class:

```ts
/** An element-validation call names an element type that the binding does not recognize (ERR-008). */
export class UnknownElementTypeError extends OscalError {
  readonly elementType: string;
}
```

The category is `unknown-element-type`. The message names the element type.

**Why:** [ELV-003] does not permit a result for an unknown type, so the operation throws. The property follows the
`path` property of `NotFoundError`.

### D6: The failure entries

`collect` moves from `src/parse.ts` to `src/validators.ts`. It takes the collecting validate function and the value,
and returns the entries. The rules of the entries do not change: one entry for each location, a JSON Pointer from the
root of the value, and the extensions for `required` and `additionalProperties`. For an element, the root of the value
is the element.

**Why:** one function gives the entries of a parse error and of an element result, so the two cannot differ.

### D7: Tests

`test/validate-element.test.ts` checks the behavior that the corpus does not check:

1. `supportedElementTypes` returns a sorted list of kebab-case names, and the list holds `back-matter` ([ELV-002]).
2. An invalid element gives one entry for each failing location. Each location is a JSON Pointer from the root of the
   element ([ELV-001]).
3. An unknown element type throws an `UnknownElementTypeError` that names the type.
4. A value deeper than 250 levels throws a `ParseError` that names the limit. A value that refers to itself throws the
   same error.

The `element/*` corpus cases check the validity of valid and invalid elements, and the category of an unknown type.
The tests of parsing continue to check the depth limit and the entries of a parse.

### D8: Documentation in `README.md`

1. The `## Status` section names element validation as an operation that exists. The item of the error model names
   `UnknownElementTypeError`. The item of the conformance runner states that the `element/*` cases pass.
2. The `## Limits` section describes the limit for the value of `validateElement` as well as for the input of a parse.
   The root value is level 1, whether it is an object or an array. Item 2 names `validateElement` as an operation that
   the depth limit applies to.

## Risks / Trade-offs

1. [The element-validation capability of the contract defines no resource limit, and no error category for a value
   over a limit (cairn-proofs/oscal-bindings-specs#28, cairn-proofs/oscal-bindings-specs#42)] → a valid element deeper than 250 levels gives a `ParseError`,
   not a valid result. The binding cannot validate the element, because the validators cannot walk it. `README.md`
   documents the limit. The limit has the same value, the same message, and the same category as the limit of a parse.

## Migration Plan

1. Implement the tasks on a feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.
3. Merge the pull request.

**Rollback:** revert the merge commit. No other repo depends on this one.

[ELV-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-001-validate-a-standalone-element-against-a-named-type
[ELV-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-002-element-type-names-are-kebab-case-and-derived-from-the-type-names
[ELV-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-003-an-unknown-element-type-is-reported-not-silently-accepted
[ERR-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-008-an-element-type-that-the-binding-does-not-recognize-is-an-unknown-element-type-error
