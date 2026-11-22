## Why

This change closes #67. Release `v0.9.0+oscal.1.2.3` of the store adds [PRS-016] to [PRS-019]. The pin is
this release (#64). The binding does not follow these requirements yet.

The binding turns on `ajv-formats` for four format names: `date-time`, `uri`, `uri-reference` and `email`. The
`format` keyword of the schema then decides whether a value is valid. [PRS-016] states that the patterns of the schema
decide, and that `format` is an annotation. [PRS-017] to [PRS-019] state the grammar that each datatype also meets.
The checks of `ajv-formats` are not these grammars:

1. The `email` check of `ajv-formats` rejects `a@b` and `用户@例子.广告`. The schema pattern `^.+@.+$` accepts both.
   The case `round-trip/email-forms` fails for this reason, and `expected-failures.json` lists it for #67.
2. The checks of `ajv-formats` for `uri` and `uri-reference` follow a regular expression of its own. They are not the
   productions `URI` and `URI-reference` of RFC 3986.
3. The corpus holds 18 other cases for [PRS-016] to [PRS-019]. They pass now, and each one passes because the
   `ajv-formats` check agrees with the RFC in that case. A change of the dependency can break them with no change of
   the binding.

## What Changes

1. Ajv does not check `format`. The keyword is an annotation.
2. A new module holds the grammar of each datatype, as a function of a string:
   1. `URIDatatype`: the production `URI` of RFC 3986 ([PRS-017]).
   2. `URIReferenceDatatype`: the production `URI-reference` of RFC 3986 ([PRS-017]).
   3. `EmailAddressDatatype`: no ASCII control character, which is U+0000 to U+001F and U+007F ([PRS-018]).
   4. `DateTimeWithTimezoneDatatype`: the production `date-time` of RFC 3339 ([PRS-019]).
3. A value of one of these datatypes must meet its grammar and the pattern of the schema. A value that fails gives a
   parse error of [ERR-001]. The binding does not change a value so that it matches.
4. Parse, `isValid`, element validation and the builders use the same checks, because they use the same Ajv
   instances ([PRS-016]).
5. `ajv-formats` is not a dependency of the binding.
6. The entry `round-trip/email-forms` leaves `test/conformance/expected-failures.json` ([VER-007]).

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the document-parsing capability, and adds no requirement of
its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `src/validators.ts`, `package.json`, `package-lock.json`, `README.md`, `docs/security.md`,
   `openspec/traceability.json`, `test/validators.test.ts`, `test/validate-element.test.ts`,
   `test/security-notes.test.ts` and `test/conformance/expected-failures.json`.
2. New files: `src/datatypes.ts` and `test/datatypes.test.ts`.
3. The runtime dependencies are `ajv` and `yaml`. `ajv-formats` leaves the list.
4. Documents that the binding accepted can be rejected. Examples are a `uri` value that holds a character outside
   the RFC 3986 grammar, and an email address that holds a control character. Documents that the binding rejected can
   be accepted. Examples are `a@b` and an email address with a non-ASCII character.

[PRS-016]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-016-the-patterns-of-the-schema-decide-a-value-not-its-format-keyword
[PRS-017]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-017-a-uri-value-matches-the-grammar-of-rfc-3986
[PRS-018]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-018-an-email-address-holds-no-control-character
[PRS-019]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-019-a-date-time-value-matches-the-grammar-of-rfc-3339
[ERR-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/error-model/spec.md
[VER-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/schema-versioning/spec.md#requirement-ver-007-each-binding-keeps-its-own-expected-conformance-failures
