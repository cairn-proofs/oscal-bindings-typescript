## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `src/validators.ts` holds one Ajv instance with `allErrors: true` and the complete schema. `validatorFor` returns the
   validator of a manifest type. Ajv compiles a schema node on its first request, not when the schema is added. The
   archived change
   [add-runtime-validators-and-element-registry](../archive/2026-11-09-add-runtime-validators-and-element-registry/design.md)
   defines the instance.
2. The root of the schema is a `oneOf` of eight branches. Each branch allows its root key and `$schema`, requires the
   root key, and sets `additionalProperties: false`.
3. Ajv with `allErrors: true` does not stop at the first failure. Against the root `oneOf`, each invalid corpus
   document with one fault gives 16 to 18 errors, because Ajv checks each branch in full. Against the one branch of
   its root key, the same documents give 1 to 3 errors.
4. One Ajv error is not one failing location. On `parse/datetime-without-timezone`, Ajv gives a `pattern` error and a
   `format` error at one path. On `parse/two-failures`, Ajv gives two `required` errors at one path, one for each
   missing property.
5. The compiled Ajv validators recurse once for each `$ref` level. A deep input throws
   `RangeError: Maximum call stack size exceeded`. The schema has six self-recursive definitions. The cost of one
   level differs for each, so the threshold differs. At the default Node.js stack size, in a cold process, the
   fail-fast validator of D3 throws at about these JSON depths:

   | Recursive structure | JSON depth that throws |
   |---|---|
   | `tasks` of an assessment plan | 1100 |
   | `groups` of a catalog | 1890 |
   | `parts` of a catalog | 3750 |
   | `controls` of a catalog | 7500 |

   The threshold also changes with the stack size, with the stack depth of the caller, and with the JIT state of the
   process. The deepest valid corpus document has a JSON depth of 12. `JSON.parse` does not throw at these depths.
6. A measurement on a synthetic catalog of 20,000 controls (about 4 MB) gives these times for one validation. The
   numbers are from one run on one machine. They show orders of magnitude only.

   | Input | `allErrors: true` | `allErrors: false` |
   |---|---|---|
   | Compile the eight branches | 226 ms, 3.0 MiB | 211 ms, 1.8 MiB |
   | Valid document | 11.6 ms | 8.9 ms |
   | One fault near the start | 16.1 ms | 0.24 ms |
   | One fault in the last control | 15.8 ms | 9.9 ms |
   | 20,000 faults | 388 ms | 0.03 ms |

7. `TextDecoder` with the default options replaces an invalid UTF-8 sequence with U+FFFD. The corpus input
   `invalid-utf8.json` is then valid JSON and a valid catalog.
8. Two schema patterns use `.` or `\S` outside a character class: `StringDatatype` (`^\S(.*\S)?$`) and
   `URIDatatype` (`^[a-zA-Z][a-zA-Z0-9+\-.]+:.+$`). The XSD and JavaScript meanings of these two constructs differ:
   1. XSD `\s` matches only space, tab, LF, and CR. JavaScript `\s` also matches other Unicode white space, for
      example U+00A0 and U+3000. With the `u` flag, `^\S(.*\S)?$` rejects `"　a"`, which XSD accepts.
   2. XSD `.` excludes only LF and CR. JavaScript `.` also excludes U+2028 and U+2029, so `"a b"` fails in
      JavaScript and passes in XSD.

   JavaScript can express each XSD meaning with a character class.

## Goals / Non-Goals

**Goals:**

1. Each stage of a parse stops at its first decisive failure. A later, more costly stage does not run on input that an
   earlier stage rejected.
2. No input makes a parse operation throw an error outside the error model, except a file read error of
   [Decision D7](#d7-parsefile).

**Non-Goals:**

1. Asynchronous parse operations.
2. A caller option that changes the limit of [Decision D4](#d4-the-nesting-depth-limit).
3. Serialization of the parsed document. The parse returns the value of `JSON.parse`. That value keeps each datetime
   as its original text, so the instant, the offset, and each fraction digit stay available to #9 ([PRS-008]).

## Decisions

### D1: The parse pipeline

Each parse operation runs these stages in order. Each stage ends the operation at its first failure.

```text
 string | Uint8Array
   |
   v
 1. decode       Uint8Array only: TextDecoder("utf-8", { fatal: true })  --> ParseError, no entries
   v
 2. JSON.parse                                                            --> ParseError, no entries
   v
 3. depth walk   nesting depth over 250 (D4)                              --> ParseError, no entries
   v
 4. root keys    no root key, or the input is not an object               --> ParseError, no entries
                 two or more root keys                                    --> ParseError, one entry at ""
                 typed parse: the root key names another type             --> DocumentTypeMismatchError
   v
 5. check        fail-fast validator of the one branch (D3)               --> step 6
   v                                                                          (isValid: false)
 6. collect      parse only: allErrors validator of the same branch       --> ParseError, the entries of D5
```

The message of the stage 4 error for no root key states that the input names no OSCAL document type ([PRS-013]). The
message of the error for two or more root keys states that the input names more than one document type, and names the
root keys.

A root key is a key of the input object that names one of the eight document types. Other keys, for example
`$schema`, are not root keys. An input with one root key and an unknown key passes stage 4, and stage 6 reports the
unknown key.

1. **Why stage 1:** [PRS-001] requires a parse error for invalid UTF-8 (Context item 7).
2. **Why stage 4 for two or more root keys:** no branch accepts two root keys (Context item 2), so the result is known
   before any schema check. The entry at the root pointer `""` names the root keys. [PRS-006] requires structured
   detail for a schema failure, and the exemption of [PRS-013] covers only an input with no root key.
3. **Why stage 4 for a mismatch:** the result is a mismatch whether the body is valid or not, so the binding does not
   check the body ([ERR-005]).
4. **Why only one branch:** [PRS-013] requires the entries of one document type (Context item 3).

### D2: The error model

`src/errors.ts` exports these members:

1. `ErrorCategory`: the union of the five category strings of the corpus: `parse-error`, `document-type-mismatch`,
   `not-found`, `access-error`, and `unknown-element-type`.
2. `OscalError`: the base class. It extends `Error` and has a read-only `category` property.
3. `ParseError`: category `parse-error`. It has a read-only `failures` array of the entries of D5. The array is empty
   for each failure of stages 1 to 4 except two or more root keys.
4. `DocumentTypeMismatchError`: a subclass of `ParseError`, with category `document-type-mismatch`. Its message names
   the expected document type and the root key of the input ([ERR-005]). Its `failures` array is empty.
5. `NotFoundError`: category `not-found`. It has a read-only `path` property, and its message names the path
   ([ERR-006]).

The conformance adapter reads `category` for `category()`, and the length of `failures` for `failureCount()`.

1. **Why a subclass for the mismatch:** [ERR-001] states that a mismatch is also a parse error. A caller that catches
   `ParseError` also catches the mismatch.

### D3: Two validators for each branch

`src/validators.ts` gets one factory that builds an Ajv instance with the options of the archived design. The only
option that differs between the two instances is `allErrors`:

1. The instance with `allErrors: true` is the existing instance of `validatorFor`. It collects the entries of a failed
   parse (stage 6).
2. A new instance with `allErrors: false` checks each input first (stage 5). `isValid` uses only this instance.

The module exports `documentValidators(rootKey)`. It returns the validator of the branch of that root key from each
instance. The pointer of a branch is `#/oneOf/<n>`. The module finds `<n>` from the `required` key of each branch.

1. **Why:** valid input is the common case, and the fail-fast validator checks it about 25% faster (Context item 6). An
   invalid input fails in the first stage that can find the fault. Only a failed `parse` pays for a second, full
   check, because [PRS-006] requires each entry. `isValid` never collects entries.
2. **Why the cost is low:** each instance compiles a branch on its first use. A process that sees only valid documents
   compiles only the fail-fast instance. One factory sets the options of both instances, so the options cannot differ
   by mistake.

The factory also sets the Ajv option `code.regExp` to the pattern engine of D10, so both instances and `validatorFor`
use the same pattern map.

### D4: The nesting depth limit

`src/parse.ts` holds the constant `MAX_NESTING_DEPTH = 250`. The module does not export it, and a caller cannot change
it. Each object and each array is one level. A scalar adds no level. The root object of a document is at depth 1.

Stage 3 walks the value of `JSON.parse` with an explicit stack of cursors, one cursor for each open object or array.
The walk stops when the stack grows past the limit. The `ParseError` message names the limit and its value, so the
error identifies the limit ([PRS-010]). The error carries no entries, as [PRS-012] permits.

The limit applies to `parse`, `parseFile`, the eight typed parsers, and `isValid`.

1. **Why:** without a limit, a deep input throws a `RangeError` at a depth that the binding does not control (Context
   item 5). [PRS-010] does not permit an undocumented limit. The limit is about 4 times below the lowest threshold of
   Context item 5, the threshold of `tasks`. It is about 20 times above the deepest valid corpus document. A `tasks`
   input at depth 252 also passes with 3000 more frames on the stack of the caller.
2. **Why a cursor stack:** the walk does not recurse, so it cannot overflow the stack. Its memory grows only with the
   depth, and the limit bounds the depth. A walk that pushes each child onto a work list uses memory that grows with
   the width of the document.

### D5: The structured entries of a parse error

A `ParseError` of stage 6 carries one entry for each failing location. An entry has two read-only properties:

1. `location`: a JSON Pointer from the root of the input.
2. `messages`: the Ajv messages of that location, in the order of the Ajv errors.

The location of an Ajv error is its `instancePath`, with these extensions:

1. For a `required` error, the location appends the missing property.
2. For an `additionalProperties` error, the location appends the extra property.

Each property segment escapes `~` and `/` as JSON Pointer requires. Ajv errors with the same location merge into one
entry. The entries keep the order of the first Ajv error of each location.

1. **Why:** this unit meets both corpus cases of Context item 4. The datetime case gives one entry, and the two-failures
   case gives two entries. Each entry identifies the failing location, as [PRS-006] requires.

### D6: The operations

`src/parse.ts` exports these operations. Each is synchronous.

1. `parse(input: string | Uint8Array): OscalDocument`.
2. `parseFile(path: string): OscalDocument`. See D7.
3. One typed parser for each document type. The name is `parse` and the wrapper name without `Document`, for example
   `parseCatalog(input): CatalogDocument` and
   `parsePlanOfActionAndMilestones(input): PlanOfActionAndMilestonesDocument`.
4. `isValid(input: string | Uint8Array): boolean`. It runs stages 1 to 5 and returns false at the first failure. It
   also catches any error and returns false, so it never throws ([ERR-002]).

All operations share one internal function that runs the pipeline of D1. The typed parsers pass the expected root key
to it.

The adapter maps `parseTyped(documentType, input)` to the typed parser of that root key.

### D7: `parseFile`

`parseFile` reads the file as bytes and passes them to the pipeline. When the read fails with the code `ENOENT` or
`ENOTDIR`, the path does not exist, and `parseFile` throws a `NotFoundError` with the path ([ERR-006]). `ENOTDIR`
occurs when a segment of the path before the last is a file, for example `catalog.json/x`. `parseFile` throws any
other read error unchanged.

1. **Why:** the contract defines no category for another read error. cairn-proofs/oscal-bindings-specs#41 asks the
   store to define one.

### D8: Documentation in `README.md`

`README.md` gets two sections:

1. `## Limits`: the nesting depth limit of D4, what it measures, its value, and the operations of D4. The section names
   `isValid` ([ERR-002]). It also states that a parse error has no limit on its entries ([PRS-011]).
2. `## Regex patterns`: the map of OSCAL patterns to the JavaScript regex engine ([PRS-007]). Ajv compiles each pattern
   with the `u` flag, so `\p{L}` and `\p{N}` keep their XSD meaning. The section states the translations of D10. It
   states one deviation: Ajv ignores the `pattern` of `DecimalDatatype`, because the parsed value is a number, not
   text.

The `## Status` section changes to state that parsing exists and serialization does not.

### D9: Tests

`test/parse.test.ts` checks the behavior that the corpus does not check:

1. Text and bytes of each valid corpus document give equal values ([PRS-001]).
2. Each valid corpus document parses with `parse` and with the typed parser of its root key ([PRS-003]). `isValid`
   returns true for it, as text and as bytes ([ERR-002]).
3. An assessment plan with nested `tasks` at the nesting depth limit parses, because `tasks` is the most costly
   structure of Context item 5. One level more gives a `ParseError` that names the limit. A depth of 5000 gives a
   `ParseError`, not a `RangeError`, and `isValid` returns false.
4. An input with two root keys gives a `ParseError` with one entry at `""`. An object with no root key gives a
   `ParseError` whose message states that the input names no OSCAL document type.
5. `parseCatalog` on a profile with an invalid body gives a `DocumentTypeMismatchError`.
6. `isValid` returns false and does not throw for each invalid corpus input.
7. `parseFile` on a directory throws an error that is not an `OscalError`. `parseFile` on a path through a file
   throws a `NotFoundError`.

`test/validators.test.ts` checks the pattern engine of D10:

1. Each distinct pattern of the schema compiles.
2. `StringDatatype` accepts `"　a"` and `"a b"`, and rejects `" a"` and `"a\n"`.
3. The engine throws for `\s` or `\S` inside a character class.

The 14 corpus cases check the rest of the pipeline.

### D10: The pattern engine

`src/validators.ts` gives Ajv a pattern engine. The engine translates the source of a pattern, then compiles it with
`new RegExp(source, flags)`. The flags include `u`, as before. Outside a character class, the translation replaces
three constructs with their XSD meaning:

1. `.` becomes `[^\n\r]`.
2. `\s` becomes `[\t\n\r ]`.
3. `\S` becomes `[^\t\n\r ]`.

The translation copies each other escape and each character class unchanged. It throws for `\s` or `\S` inside a
character class, because no schema pattern has one and the translation does not cover it. A schema of a later OSCAL
release with such a pattern then fails when its validator compiles.

1. **Why:** [PRS-007] requires the map to keep the set of accepted and rejected values. The JavaScript engine can
   express each XSD meaning (Context item 8), so the map must translate, not document a deviation.

## Risks / Trade-offs

1. [A failed `parse` validates twice] → The first check stops at the first failure, so the extra cost is at most one
   fail-fast check (Context item 6). Each valid parse and each `isValid` call costs less.
2. [The Ajv side errors of an `anyOf` branch become entries] → On `parse/closed-enum-out-of-set`, the entries of D5
   are at 3 locations. Each entry still identifies a location that fails, and the corpus case sets no maximum.
3. [A caller runs with a smaller stack than the default] → The validator can throw a `RangeError` below the limit of
   D4. The limit is about 4 times below the lowest threshold of Context item 5 at the default stack size.

## Migration Plan

1. Implement the tasks on a feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.
3. Merge the pull request.

**Rollback:** revert the merge commit. No other repo depends on this one.

[PRS-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-001-parse-an-oscal-document-from-text-or-bytes
[PRS-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-003-typed-parsers-return-the-matching-document-type-or-report-a-type-mismatch
[PRS-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-006-schema-validation-failures-carry-structured-error-detail
[PRS-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-007-regex-patterns-follow-a-defined-portability-rule
[PRS-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-008-timezone-aware-datetimes-are-enforced-where-oscal-requires-them
[PRS-010]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-010-a-binding-can-limit-the-resources-that-a-parse-uses
[PRS-011]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-011-a-binding-can-limit-the-structured-entries-of-a-parse-error
[PRS-012]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-012-a-parse-error-carries-each-entry-or-100-entries-or-more
[PRS-013]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-013-the-root-key-selects-the-document-type-of-the-parse-failures
[ERR-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-001-error-situations-map-to-a-fixed-taxonomy
[ERR-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-002-a-non-raising-validity-check-is-available
[ERR-005]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-005-a-document-of-another-type-is-a-document-type-mismatch
[ERR-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-006-a-missing-file-is-a-not-found-error
