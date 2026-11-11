## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. The element-type registry has the rows `hash`, `back-matter-resource-rlink`, and `back-matter-resource`.
   `validateElement` validates a value against each of them. It throws a `ParseError` for a value over the depth
   limit.
2. The generated types are `Hash`, `BackMatterResourceRlink`, `BackMatterResource`, and `DocumentId`. Their field names
   are the JSON names of the schema, for example `"media-type"` and `"document-ids"`.
3. The schema gives `rlinks`, `hashes`, and `document-ids` a `minItems` of 1. A resource requires only `uuid`.
4. [MDL-011] marks `HashAlgorithm` as an open enum. The schema accepts each value of the string datatype, so the only
   invalid algorithms are strings that do not match the pattern of that datatype, `^\S(.*\S)?$`. Examples are an
   empty string, a string with leading or trailing whitespace, and a string that holds a line break.
5. The UUID datatype of the schema accepts a UUID of version 4 or version 5.
6. [ERR-001] has five categories, and each error must map to exactly one of them. It has no validation-error category.
7. `validateElement` already throws a `ParseError` for an element value over the depth limit. The doc comment of
   `ParseError` in `src/errors.ts` names only document input.

## Goals / Non-Goals

**Goals:**

1. Each builder returns an element that is valid against its element type, or it throws.

**Non-Goals:**

1. A derivation of the identifier from the content of the resource or from a key.

## Decisions

### D1: The functions

`src/backmatter.ts` exports three functions:

```ts
export function buildHash(value: string, algorithm?: HashAlgorithm): Hash;
export function buildRlink(href: string, options?: RlinkOptions): BackMatterResourceRlink;
export function buildResource(options?: ResourceOptions): BackMatterResource;
```

1. `RlinkOptions` is `Pick<BackMatterResourceRlink, "media-type" | "hashes">`.
2. `ResourceOptions` is `Partial<Pick<BackMatterResource, "uuid" | "title" | "description" | "rlinks" |
   "document-ids">>`.
3. The default of `algorithm` is `"SHA-256"`.
4. `HashAlgorithm` holds the eight named algorithms and each other string. A named algorithm and its string form are
   then the same value, so one parameter accepts both ([BMB-001]).

**Why:** the names follow the verb style of `parse` and `parseFile`. The option types reuse the generated field names,
so the builder copies each field with no name mapping. The alternative, camelCase option names such as `mediaType`,
needs one mapping for each field and gives two names to one field.

### D2: The pipeline

Each builder runs these steps:

1. Make the element from the arguments. Add a field only when its argument is not `undefined`.
2. For `buildResource`, set `uuid` to a new UUID when the caller gives no `uuid` (D3).
3. Call `validateElement` with the element type of the builder.
4. When the result is not valid, throw a `ParseError` that names the element type and carries the failures of the
   result.
5. Return the element.

The builder applies no rule of its own before step 3.

**Why:** the schema gives each rule of [BMB-001] to [BMB-003] that has an error: an invalid algorithm, an empty list,
and an invalid list item. One validation of the element then covers all of them, and the builder cannot differ from
`validateElement`. Step 1 keeps an omitted input absent, also when a caller passes `undefined` for an optional field.

The error is a `ParseError` for these reasons:

1. [ERR-001] requires one of its five categories. Parse-error is the only category for input that does not conform to
   the schema ([ERR-004] item 1).
2. The binding already uses the parse-error category for an element value: `validateElement` throws a `ParseError`
   for a value over the depth limit.
3. A `ParseError` carries one failure entry for each failing location. The facade of the previous step throws a
   `TypeError` for a value that is not a document wrapper, but a `TypeError` carries no failure entries.

A subclass of `ParseError` would add no behavior that the contract requires. The doc comment of `ParseError` changes to
include an invalid element value.

[BMB-001] requires an error for "an algorithm value that OSCAL does not define". [MDL-011] states that each valid value
of the base datatype of an open enum is valid, so OSCAL defines `SHA-999` as a valid algorithm. The builder therefore
applies the schema and no list of named algorithms.

### D3: The generated identifier

`buildResource` uses `randomUUID` of `node:crypto` when the caller gives no `uuid`. The function returns a UUID of
version 4, which the UUID datatype of the schema accepts. A `uuid` that the caller gives goes through validation
without change.

**Why:** [BMB-003] requires a fresh unique identifier, and `randomUUID` gives one with no new dependency.

### D4: Tests

`test/backmatter.test.ts` tests these scenarios:

1. `buildHash("abc")` gives `{ algorithm: "SHA-256", value: "abc" }` (BMB-001.01).
2. `buildHash("abc", "SHA-512")` gives a hash with the algorithm `SHA-512` (BMB-001.02).
3. `buildHash("abc", " SHA-256")` throws a `ParseError` with a failure at `/algorithm`. `buildHash("abc", "SHA-999")`
   gives a hash with the algorithm `SHA-999` (BMB-001.03).
4. `buildRlink("https://example.com/a")` gives an rlink with no `media-type` key and no `hashes` key (BMB-002.01).
5. `buildRlink` with a media type and a list of one hash gives an rlink with the three fields (BMB-002.02).
6. Two calls of `buildResource()` give two different UUIDs that match the UUID datatype (BMB-003.01).
7. `buildResource({ title: "t" })` gives a resource with no `document-ids` key. A `uuid` that the caller gives is in
   the result (BMB-003.02).
8. `buildResource` throws a `ParseError` for a `document-ids` list with an item that has no `identifier`, and for an
   empty `document-ids` list (BMB-003.03).

### D5: Traceability and documentation

1. `openspec/traceability.json` gets three entries: `buildHash` with BMB-001, `buildRlink` with BMB-002, and
   `buildResource` with BMB-003 ([SRF-003]).
2. The `## Status` section of `README.md` names the builders as operations that exist. The section names the
   `ParseError` of an invalid input.
3. Item 2 of the `## Limits` section of `README.md` names the three builders, because each builder calls
   `validateElement` and gets its depth limit.

## Risks / Trade-offs

1. [Each call of `buildResource` with no `uuid` gives a new identifier] → a caller that builds the same resource again
   gets a different identity. The doc comment of `buildResource` tells the caller to give a `uuid` when the identity
   must stay the same.
2. [The store can decide that BMB-001.03 means the eight named algorithms only] → cairn-proofs/oscal-bindings-specs#45
   asks the store to decide. A different decision needs a change to D2 and to test 3 of D4.
3. [The store can add an error category for an invalid builder input] → cairn-proofs/oscal-bindings-specs#45 asks the
   store to decide. A new category needs a change to D2, to tests 3 and 8 of D4, and to D5.

## Migration Plan

1. Implement the tasks on a feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.
3. Merge the pull request.

**Rollback:** revert the merge commit. No other repo depends on this one.

[BMB-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-001-build-a-back-matter-hash-value
[BMB-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/backmatter-builders/spec.md#requirement-bmb-003-build-a-back-matter-resource-value
[MDL-011]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-011-each-enum-site-is-a-named-type-marked-open-or-closed
[ERR-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-001-error-situations-map-to-a-fixed-taxonomy
[ERR-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-004-inputs-that-are-not-a-valid-document-are-a-parse-error
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
