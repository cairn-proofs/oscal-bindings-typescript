## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. In this binding, the document wrapper is the top-level document value. `parse` returns an `OscalDocument`, which is
   the union of the eight wrapper types, for example `{ "catalog": { ... } }`. A wrapper can also hold `$schema`.
2. `rootKeys` in `src/validators.ts` lists the eight root keys of the schema.
3. Each of the eight body types has a required `uuid` and a required `metadata`. `Metadata` has a required
   `oscal-version`.
4. `parse` and `parseFile` throw a `ParseError` or a `NotFoundError`. `parseFile` passes through any other read error.

## Goals / Non-Goals

**Goals:**

1. The caller reads the common fields of each document type with no type branching.

**Non-Goals:**

1. A facade type that is generic over the document type.
2. Schema validation of a value that the caller wraps directly.

## Decisions

### D1: The class

`src/document.ts` exports one class:

```ts
export class OscalDoc {
  constructor(wrapper: OscalDocument);
  static fromJson(input: string | Uint8Array): OscalDoc;
  static fromFile(path: string): OscalDoc;
  get wrapper(): OscalDocument;
  get body(): OscalBody;
  get metadata(): Metadata;
  get oscalVersion(): string;
  get uuid(): string;
}
```

1. `OscalBody` is the union of the eight body types. The module does not export it.
2. The constructor finds the root key once. Each getter reads from the wrapper and does no other work.

**Why:** the name follows the facade of cairn-proofs/oscal-bindings-python. One builder takes text and bytes, as `parse` does. The alternative, a class that is generic over the
document type, gives a typed body, but [FAC-002] requires no type branching, and the generic adds type parameters to
each signature.

### D2: The check of the constructor

The constructor throws a `TypeError` and wraps nothing when one of these conditions is true ([FAC-001]):

1. The value is not a plain object. `null` and an array are not plain objects.
2. The value has no key of `rootKeys`, or more than one.
3. The value of the root key is not a plain object.

The constructor does no schema validation.

**Why:** FAC-001.02 requires a type error, and [ERR-001] has no category for it. The check finds the body, so it is
the minimum that the getters need. Schema validation would repeat the work of a parse for each document that the
caller parsed first. [FAC-002] promises safe getters only for a validly parsed document.

### D3: The builders

1. `fromJson(input)` returns `new OscalDoc(parse(input))`.
2. `fromFile(path)` returns `new OscalDoc(parseFile(path))`.

Each error of `parse` and `parseFile` passes through unchanged ([FAC-003]).

**Why:** the builders add no rule of their own, so a parse and a builder cannot differ in their errors.

### D4: Tests

`test/document.test.ts` checks these scenarios. The valid corpus documents of the pinned spec artifact give the input:

1. For each valid corpus document (the inputs of the `round-trip` cases), `fromJson` gives a facade whose `wrapper` is the parsed document and whose
   `body` is the value of the root key (FAC-001.01, FAC-003.01 with bytes).
2. For each valid corpus document, `metadata`, `oscalVersion`, and `uuid` return the values of the body
   (FAC-002.01, FAC-002.02).
3. The constructor throws a `TypeError` for `null`, an array, a string, an object with no root key, an object with two
   root keys, and an object whose root value is not a plain object (FAC-001.02).
4. `fromFile` gives a facade for a valid file, and throws a `NotFoundError` that names a missing path (FAC-003.02).

### D5: Traceability and documentation

1. `openspec/traceability.json` gets one entry: `OscalDoc` with FAC-001, FAC-002, and FAC-003. The entry covers the
   members of the class ([SRF-003]).
2. The `## Status` section of `README.md` names the facade as an operation that exists.

## Risks / Trade-offs

1. [A caller can wrap a value that has the root key but is not valid against the schema] → a getter can then return
   `undefined` where its type says `string`, or throw a `TypeError`. `oscalVersion` throws when `metadata` is absent. The doc comment of the constructor states that the getters are safe for a
   parsed document. `fromJson` and `fromFile` always parse.

## Migration Plan

1. Implement the tasks on a feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.
3. Merge the pull request.

**Rollback:** revert the merge commit. No other repo depends on this one.

[FAC-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-001-a-uniform-facade-wraps-any-document-type
[FAC-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-002-the-facade-reads-common-fields-without-type-branching
[FAC-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-003-the-facade-can-be-built-from-text-bytes-or-a-file
[ERR-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-001-error-situations-map-to-a-fixed-taxonomy
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
