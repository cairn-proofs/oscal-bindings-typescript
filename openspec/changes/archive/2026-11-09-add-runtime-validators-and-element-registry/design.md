## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. The archived change [adopt-contract-0-7-and-conformance-harness](../archive/2026-11-09-adopt-contract-0-7-and-conformance-harness/design.md)
   pins the spec artifact `0.7.0+oscal.1.2.3`. `ensureSpecArtifact()` reads it into `.cache/spec-artifact/`, which git
   ignores. The generator reads the schema and `names.json` from there and writes `src/generated/oscal.ts`.
2. The vendored schema `oscal_complete_schema.json` is draft-07, with the `$id`
   `http://csrc.nist.gov/ns/oscal/1.0/1.2.3/oscal-complete-schema.json`. Each object schema that defines properties
   sets `additionalProperties: false`. An object schema without that keyword is the root or a union, and each of its
   branches sets it. The schema uses the formats `date-time`, `uri`, `uri-reference`, and `email`. Its patterns use the
   Unicode property classes `\p{L}` and `\p{N}`. `DecimalDatatype` sets a `pattern` on `type: number`.
3. `names.json` holds 244 types. For an enum, the site is the `enum` branch inside the `anyOf` (open) or `allOf`
   (closed) that also holds the base datatype. For example, the site of `HashAlgorithm` ends in
   `/properties/algorithm/anyOf/1`.
4. `ajv` `8.20.0` is a dev dependency. The manifest validator of the spike uses it.
5. `tsconfig.json` includes only `scripts/` and `test/`.

## Goals / Non-Goals

**Goals:**

1. One validator for each manifest type, from the vendored schema and from no other source of constraints.
2. Runtime code that reads only files in the repo, not the artifact cache.
3. A generator check that fails when a generated runtime input is not current.

**Non-Goals:**

1. Precompiled validators (Ajv standalone code).
2. A map from Ajv errors to the error model or to the structured entries of a parse error. Steps 3 and 5 add it.
   That map cannot use one Ajv error as one entry. On the corpus case `parse/datetime-without-timezone`, Ajv gives a
   `pattern` error and a `format` error at one location. At the root pointer `#`, Ajv also gives the errors of each
   `oneOf` branch.
3. A public export. The module stays internal until step 9 adds the package entry point.
4. The documentation of the pattern map of [PRS-007]. Step 3 owns [PRS-007]. That documentation must state that Ajv
   ignores the `pattern` of `DecimalDatatype`, because the parsed value is a number, not text.

## Decisions

### D1: Check values with Ajv against the vendored schema

The validator module adds the complete schema to one Ajv instance at load time. It gets the validator of a type with
`ajv.getSchema(<$id> + <pointer>)`. Ajv compiles the schema on the first request and keeps each validator. A validate
function holds the errors of its last call in its own `errors` property. The instance uses these options:

1. `allErrors: true`, because [PRS-006] requires an entry for each failure.
2. The default `unicodeRegExp: true`, so each pattern compiles with the `u` flag, and `\p{L}` and `\p{N}` keep their
   XSD meaning ([PRS-007]).
3. `strictTypes: false`. The other strict options keep their default values. With the default `strictTypes: "log"`,
   Ajv writes a warning to the console for the `pattern` of `DecimalDatatype`, because a pattern does not apply to a
   number. A library must not write to the console.

`ajv-formats` adds the four formats of Context item 2, and no other format. The package is CommonJS, so under
`module: NodeNext` the module calls the default export as `addFormats.default(ajv, [...])`. A direct call of the
default import does not typecheck.

1. **Why:** the artifact pin holds the hash of the schema, and the schema is the source of every constraint. Ajv then
   gives the unknown-field check of [MDL-008] from `additionalProperties: false`, the patterns, and the closed enums
   with no code of this repo.
2. **Alternative considered:** generate a validator for each type in a schema library such as zod. Rejected: it adds
   a dependency and a second copy of each constraint, and that copy can differ from the schema.

### D2: The generator writes the runtime inputs into `src/generated/`

The generator writes two more files. `npm run generate:check` compares each file with the generator output, as it does
for `oscal.ts`.

1. `src/generated/oscal-complete-schema.json`: the schema bytes of the artifact, unchanged. The manifest validator
   already checks their sha256.
2. `src/generated/element-types.ts`: one row for each manifest type, sorted by element-type name. A row holds the
   element-type name of D4, the canonical type name, and the pointer of D3.

The validator module imports the schema with the import attribute `with { type: "json" }`. `tsconfig.json` adds `src/`
to `include`. `tsconfig.types.json` already includes `src/`, so `npm run types:check` and `npm run global-names` also
compile the module.

1. **Why:** a runtime that reads `.cache/` fails in a clean checkout and in a published package. A committed copy also
   shows a change of the schema in review.
2. **Alternative considered:** embed the schema in a `.ts` module. Rejected: a 268 KB literal in TypeScript is harder
   to review than the JSON file, and the JSON file is the same bytes as the pinned input.

### D3: The pointer of each type

1. For each kind except `enum`, the pointer is the first site of the entry. [MDL-019] makes the other sites
   structurally identical.
2. For an `enum`, the pointer is the parent of the `anyOf` or `allOf` node that holds the site. That node holds the
   enum and the base datatype. For example, the pointer of `HashAlgorithm` ends in `/properties/algorithm`.

The generator fails, and names the entry, when an enum site does not end in `/anyOf/<n>` or `/allOf/<n>`.

1. **Why:** the site of an open enum holds only the listed values. A validator at the site would reject an off-list
   value that [MDL-011] accepts, and it would not check the base datatype.

### D4: The element-type name of each type

The element-type name is the canonical type name with a hyphen before each uppercase letter except the first, in lower
case. A digit stays in the word before it. For example, `BackMatterResourceBase64` gives
`back-matter-resource-base64`. Each of the 244 manifest types gets a name, because [ELV-002] derives the list from the
canonical type names and excludes no kind. The generator fails, and names each pair, when two types give the same
element-type name.

1. **Why:** cairn-proofs/oscal-bindings-python registers only its model classes, which include no enum and no union.
   cairn-proofs/oscal-bindings-specs#40 asks the store to state which kinds ELV-002 covers. If the store limits the
   kinds, only the selection rule of this decision changes.

### D5: The validator module

`src/validators.ts` exports two members:

1. `elementTypes`: the rows of D2, in their sorted order.
2. `validatorFor(typeName)`: the Ajv validate function of a canonical type name. It throws for a name that is not in
   the manifest.

Step 5 builds the public element-validation operation and the unknown-element-type error on these members.

### D6: Tests

`test/validators.test.ts` checks the completion criteria of the proposal:

1. `validatorFor` compiles a validator for each row of `elementTypes`.
2. The element-type names are unique, and the inverse of D4 on each name gives its canonical type name.
3. For each `validate-element` case of the pinned corpus that has `expected-valid`, the validator of its element type
   gives that result on the element file.
4. An open enum accepts an off-list value of its base datatype, and a closed enum rejects one.
5. The compile of each validator writes nothing to the console.

`test/generate.test.ts` adds a check that the generator fails on a malformed enum site (D3) and on an element-type
name collision (D4).

## Risks / Trade-offs

1. [The `ajv-formats` meaning of `uri`, `uri-reference`, or `email` differs from the OSCAL meaning] → The corpus
   cases of steps 3 and 5 show a difference. A difference then gets an issue and an entry in the list of expected
   failures.
2. [The first request for a validator compiles the complete schema, in about 180 ms] → Ajv keeps each compiled
   validator. Precompiled validators stay an option for a later change.

## Migration Plan

1. Implement the tasks on a feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.
3. Merge the pull request.

**Rollback:** revert the merge commit. No other repo depends on this one.

[PRS-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-006-schema-validation-failures-carry-structured-error-detail
[PRS-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-007-regex-patterns-follow-a-defined-portability-rule
[ELV-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-002-element-type-names-are-kebab-case-and-derived-from-the-type-names
[MDL-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-008-models-reject-unknown-fields-strict-coverage
[MDL-011]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-011-each-enum-site-is-a-named-type-marked-open-or-closed
[MDL-019]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-019-merged-places-are-structurally-identical
