## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. A parse returns the value of `JSON.parse`. Each key of that value is the OSCAL property key, in the order of the
   input. The generated types in `src/generated/oscal.ts` also use the OSCAL property keys, for example `"media-type"`.
   The binding has no internal field name to map.
2. The generated types allow no `null`. Each array type excludes `undefined`.
3. A datetime is a `string` in the generated types. The parse keeps the original text of each datetime.
4. `JSON.stringify` omits an object member whose value is `undefined`. It writes each number in the ECMAScript format,
   which is also the JCS number format of
   [Canonical JSON for conformance comparison](https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/docs/canonical-json.md#rules).

## Goals / Non-Goals

**Goals:**

1. `serialize` writes each document that matches the generated types to OSCAL JSON, with no other transformation.

**Non-Goals:**

1. A runtime check of the document before `serialize` writes it.

## Decisions

### D1: The operation

`src/serialize.ts` exports this synchronous operation:

```ts
export interface SerializeOptions {
  /** When true, the output has no whitespace between tokens. The default is false. */
  readonly compact?: boolean;
}

export function serialize(document: OscalDocument, options?: SerializeOptions): string;
```

1. The default output is `JSON.stringify(document, null, 2)`: an indent of 2 spaces and no trailing newline
   ([SER-003]).
2. The compact output is `JSON.stringify(document)` ([SER-003]).

**Why:** the document is already the JSON value of OSCAL (Context items 1 and 3). The value goes to `JSON.stringify`
unchanged, so each serialization path writes OSCAL property keys ([SER-001]), and each datetime keeps its original text
([SER-005]). The output for a parsed document has the same keys, the same values, and the same key order as its
input ([SER-004]).

### D2: Absent fields

`serialize` relies on the generated types for [SER-002]. An absent optional field is `undefined` or is not present, and
`JSON.stringify` omits it (Context item 4). The types allow no `null` and no `undefined` array item (Context item 2), so
the output of a document that matches the types has no null.

**Why:** a `null` in a document breaks the type contract of the binding. It is not an absent field. A check for it
would do work on each document to find a value that the types already exclude.

### D3: Tests

`test/serialize.test.ts` checks the behavior that the corpus does not check:

1. The default output of a parsed corpus document has a line break and an indent of 2 spaces ([SER-003]).
2. The compact output of the same document is the same as `JSON.stringify(JSON.parse(compact))`, so it has no
   whitespace between tokens. `JSON.parse` of the compact output and `JSON.parse` of the default output give equal
   values ([SER-001], [SER-003]).
3. An optional field set to `undefined` is absent from the default output and from the compact output ([SER-002]).

The `round-trip` corpus cases check [SER-001], [SER-004], and [SER-005].

### D4: Documentation in `README.md`

The `## Status` section names serialization as an operation that exists, and no longer lists it as missing. The item
of the conformance runner states that the cases of parsing and the `round-trip` cases pass.

## Risks / Trade-offs

1. [A caller puts a `null` into a document through a type cast or from JavaScript] → `serialize` writes the null. The
   TypeScript compiler rejects the null in typed code. The doc comment of `serialize` states that the output has no null
   for a document that matches the types.

## Migration Plan

1. Implement the tasks on a feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.
3. Merge the pull request.

**Rollback:** revert the merge commit. No other repo depends on this one.

[SER-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-001-serialization-emits-oscal-property-keys
[SER-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-002-serialization-never-emits-null
[SER-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-003-pretty-output-by-default-compact-output-on-request
[SER-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-004-round-trip-equivalence-uses-the-shared-canonical-form
[SER-005]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/serialization/spec.md#requirement-ser-005-a-datetime-keeps-its-instant-and-offset
