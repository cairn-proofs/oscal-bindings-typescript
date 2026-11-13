## Why

This change closes #13, step 8 of the plan of #4. The binding reads and writes OSCAL JSON only. The pinned contract
defines an optional YAML capability, and [YML-001] states that a binding that offers it conforms to each of its
requirements. The 23 `yaml-parse` and `yaml-round-trip` cases of the corpus are in the list of expected failures.

## What Changes

1. A new operation `parseYaml(input)` reads an OSCAL document from YAML text or UTF-8 bytes ([YML-005]). It reads the
   input as [YML-002], [YML-003], [YML-004], and [YML-009] define. It then gives the result of `parse` for the JSON text
   of the input. Thus each rule of `parse` applies, for example the root key, the union branch selection of [PRS-014],
   and the entries of [PRS-006].
2. A scalar that does not match the grammar of the type at its location gives a `ParseError` with one entry for that
   location ([YML-010]). The error also holds an entry for each other failure of the document.
3. A new operation `parseYamlFile(path)` reads the file at a path and parses it as `parseYaml` does ([YML-006]). It
   throws `NotFoundError` and `ReadError` as `parseFile` does.
4. A new operation `serializeYaml(document)` writes an OSCAL document as YAML in block style, with each key and scalar
   in JSON form ([YML-008]).
5. A new documented limit, `alias-expansion`: a YAML parse stops when its aliases give more than 100,000 nodes or more
   than 10,000,000 characters of scalar text. The error is a `ParseError` with `limit` set to `alias-expansion`
   ([PRS-010]).
6. The existing limit `nesting-depth` of 250 levels applies to a YAML input.
7. The generator stops with an error when the schema breaks a condition that the YAML scalar typing needs.
8. `README.md` documents the three operations, the new limit, and the YAML cost in the security note "Size and time".
   The notes on dependencies name `yaml`. The security note "Error text" covers the message of a YAML syntax error.
9. The conformance runner runs the `yaml-parse` and `yaml-round-trip` cases.
10. The traceability record names the three operations and their requirements ([SRF-003]).

The binding does not offer the typed YAML parsers of [YML-007], because that requirement makes them optional.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the yaml-documents, document-parsing, and error-model
capabilities, and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New runtime dependency: `yaml` 2.9.1, for the YAML parse only. The store's reference YAML reader uses the same
   version.
2. New file: `src/yaml.ts`. Changed files: `src/parse.ts`, `src/errors.ts`, `scripts/generate.ts`, `package.json`,
   `package-lock.json`, `test/support/adapter.ts`, `test/conformance/expected-failures.json`,
   `openspec/traceability.json`, `README.md`, and the tests.
3. No consumer depends on this repo. The change adds operations and changes no existing behavior.

[PRS-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-006-schema-validation-failures-carry-structured-error-detail
[PRS-010]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-010-a-binding-can-limit-the-resources-that-a-parse-uses
[PRS-014]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-014-a-distinguishing-property-selects-the-nested-union-branch-of-parse-failures
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
[YML-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-001-yaml-support-is-optional-and-a-binding-that-offers-it-conforms-in-full
[YML-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-002-a-yaml-input-is-one-yaml-12-document-in-utf-8
[YML-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-003-a-yaml-document-reads-as-a-json-value
[YML-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-004-the-schema-decides-the-type-of-each-scalar
[YML-005]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-005-parse-an-oscal-document-from-yaml-text-or-bytes
[YML-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-006-parse-an-oscal-document-from-a-yaml-file-path
[YML-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-007-a-typed-yaml-parser-behaves-as-a-typed-json-parser
[YML-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-008-serialize-an-oscal-document-to-yaml
[YML-009]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-009-aliases-tags-and-merge-keys-add-no-meaning
[YML-010]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-010-a-grammar-error-of-a-scalar-carries-the-location-of-the-scalar
