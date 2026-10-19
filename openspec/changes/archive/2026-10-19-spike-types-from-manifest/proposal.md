## Why

The naming manifest format of the spec store is provisional until a second language generates types from it (design
D9 of the store change `define-names-manifest-format`). This spike is that test. It answers the four questions in
the comment on #1 for release `v0.2.0+oscal.1.2.3`. The store change is archived only after the answers are in, and
cairn-proofs/oscal-bindings-python#16 waits for the archive.

## What Changes

1. A Node and TypeScript toolchain for this repo, with the same pins and npm settings as the store.
2. A pinned fetch of the spec artifact `v0.2.0+oscal.1.2.3`. It checks the sha256 before it extracts files.
3. A manifest validator that a consumer runs before it generates code. It applies [NAM-002] to [NAM-004] of the store
   with no code from the store.
4. A type generator that reads only the complete schema and `names.json`. It writes TypeScript type declarations. It
   takes every type name from the manifest, and it fails on each non-scalar place of the schema that has no entry.
5. Type tests. The generated file compiles. Each valid corpus document is assignable to its document type. A
   document that the schema rejects for its shape does not compile.
6. A CI workflow that runs the check gate.
7. A report of the answers to the four questions, as a comment on #1. A format gap goes back to the store change and
   a new release `0.3.0+oscal.1.2.3`.

Not in this change: runtime parsing and validation, serialization, the conformance runner, regex dialect
translation, datetime handling, and a published npm package. Those belong to the full binding.

## Capabilities

### New Capabilities

None. The contract for the manifest and the type names is in the `naming-manifest` and `model-derivation`
capabilities of the store. This change consumes them.

### Modified Capabilities

None. A gap that the spike finds is a change to the store specs, not to this repo. The change sets `skip_specs: true`.

## Impact

1. New files only: `package.json`, `package-lock.json`, `.npmrc`, `mise.toml`, `mise.lock`, `tsconfig.json`,
   `.gitignore`, `scripts/`, `src/generated/`, `test/`, and `.github/workflows/build.yml`.
2. New dependencies, exact-pinned to the store versions: `typescript`, `tsx`, `@types/node`, `ajv`. No install
   scripts run.
3. The check gate downloads one release asset from cairn-proofs/oscal-bindings-specs over HTTPS, in CI and locally.
4. Possible follow-up in the store: an update of `define-names-manifest-format` and a release `0.3.0+oscal.1.2.3`.

[NAM-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-002-the-manifest-records-each-canonical-type-with-its-name-kind-and-kind-data
[NAM-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-004-the-store-publishes-a-json-schema-for-each-manifest-file
