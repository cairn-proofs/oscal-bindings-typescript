## Why

This change closes #26. Contract release `v0.8.0+oscal.1.2.3` adds [NAM-021] and [NAM-022]
(cairn-proofs/oscal-bindings-specs#49). The binding moved its pin to that release in #38. The manifest validator in
`scripts/manifest.ts` does not meet these requirements yet:

1. The validator applies the JSON Schema of [NAM-004] first. A manifest with `format` 2 gives a JSON Schema failure, not
   a statement that format 2 is not supported. [NAM-022] requires the format check before the JSON Schema check.
2. The validator does not state that a manifest is not a JSON object, or that it has no `format` member. [NAM-021] makes
   such a manifest invalid.
3. The comments and the test names of the manifest validator cite identifiers that the pinned release does not define,
   for example NAM-003.05 and NAM-001.03. The rules that they test are in [NAM-009], [NAM-012], and [NAM-013].

## What Changes

1. The validator rejects a manifest that is not a JSON object, or that has no `format` member, before all other checks
   ([NAM-021]).
2. The validator rejects a `format` value that it does not support before the JSON Schema check. The failure states that
   the format version is not supported, and names the value ([NAM-022]). The validator applies no other check to that
   manifest.
3. Tests cover scenarios NAM-021.01, NAM-022.01, and NAM-022.02.
4. Each requirement or scenario identifier in the comments and the test names of the manifest validator is an
   identifier of the pinned release.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the naming-manifest capability, and adds no requirement of its
own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `scripts/manifest.ts` and `test/manifest.test.ts`.
2. No new dependency.
3. The validator runs only in the code generator. The generated code and the public API do not change.

[NAM-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-004-the-store-publishes-a-json-schema-for-each-manifest-file
[NAM-009]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-009-each-pointer-of-an-entry-resolves-and-belongs-to-that-entry-only
[NAM-012]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-012-the-manifest-matches-the-format-version-and-the-oscal-release-of-the-consumer
[NAM-013]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-013-the-json-schemas-of-the-manifest-files-constrain-every-string
[NAM-021]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-021-each-manifest-format-holds-its-format-version-in-the-member-format
[NAM-022]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-022-a-consumer-checks-the-format-version-before-the-other-checks-of-the-manifest
