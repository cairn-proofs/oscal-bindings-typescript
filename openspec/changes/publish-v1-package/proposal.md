## Why

This change closes #14, the last step of the plan of #4. The binding implements each operation of the contract, but no
consumer can install it. `package.json` sets `"private": true`, the repository has no build output, and the package has
no entry point. A consumer can only import a source file by its path. The binding also does not implement these
requirements:

1. [VER-001]: the binding has no namespace for the OSCAL major version.
2. [VER-002]: the OSCAL release of the binding is readable only in `scripts/spec-artifact.ts`, which is not part of the
   binding.
3. [SRF-001] and [SRF-003]: `openspec/traceability.json` lists the exported functions and `OscalDoc`, but no check
   compares the record with the public API. The record has no entry for the error classes and the named types that the
   public functions use.

The pinned corpus has no case for these requirements, and `test/conformance/expected-failures.json` lists no case. So
the test of the public API and a published package mark the end of this step.

## What Changes

1. The package has one entry point, `oscal-bindings/v1` ([VER-001]). It exports each contract operation, each error
   class, each named type of a public signature, and the generated model types. No other path of the package is
   importable.
2. The entry point exports `OSCAL_RELEASE`, the OSCAL release that the binding was generated from, for example
   `"1.2.3"` ([VER-002]). The generator writes it from the spec pin.
3. `openspec/traceability.json` has one entry for each name that the entry point exports, except the generated model
   types ([SRF-001.03]). A test fails when the exports and the record differ ([SRF-003.04]). The test also fails when
   the major version of `OSCAL_RELEASE` is not the major version of the namespace ([VER-001.02]).
4. The package is the npm package `oscal-bindings`, version `0.1.0`. A build writes JavaScript and type declarations to
   `dist/`. The check gate packs the package, installs it in an empty project, and imports it there.
5. A new GitHub Actions workflow publishes the package to npm when a maintainer pushes a version tag, for example
   `v0.1.0`. It uses npm trusted publishing, so the repository holds no npm token. npm adds a provenance attestation to
   each release that the workflow publishes.
6. `README.md` tells a consumer how to install and import the package.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the schema-versioning and binding-surface capabilities, and
adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New source files: `src/v1/index.ts` and the generated file `src/generated/release.ts`. Changed generator:
   `scripts/generate.ts`.
2. New public names: `OSCAL_RELEASE`. The entry point also makes these existing names public: the nine error classes,
   `ErrorCategory`, `Limit`, `FailureEntry`, `SerializeOptions`, `OscalBody`, `AssessmentPeriod`,
   `ElementValidationResult`, `RlinkOptions`, and `ResourceOptions`. `src/document.ts` exports `OscalBody`.
3. Changed package files: `package.json`, `package-lock.json`, `.gitignore`, `.github/CODEOWNERS`, and a new
   `tsconfig.build.json`.
4. New workflow: `.github/workflows/release.yml`.
5. Changed tests and records: `test/traceability.test.ts`, `test/security-notes.test.ts`, the new script
   `scripts/pack-check.ts`, `openspec/traceability.json`, and `README.md`.
6. The runtime dependencies stay `ajv`, `ajv-formats`, and `yaml`. The package states each one as a range below its
   next major version. `package-lock.json` keeps the exact versions for the build of this repository. The spec pin does
   not move.
7. The maintainer does a one-time setup on npmjs.com and GitHub before the workflow can publish. The setup restricts
   the creation of a `v*` tag to a repository admin, and lets only a `v*` tag use the `npm` environment. It also turns
   off rebase merges on `main`. The design lists the steps.

[VER-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/schema-versioning/spec.md#requirement-ver-001-bindings-are-namespaced-by-oscal-major-version
[VER-001.02]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/schema-versioning/spec.md#scenario-ver-00102-new-major-version-adds-a-namespace
[VER-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/schema-versioning/spec.md#requirement-ver-002-a-binding-is-generated-from-exactly-one-active-oscal-release
[SRF-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-001-a-binding-exposes-only-operations-that-a-requirement-defines
[SRF-001.03]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#scenario-srf-00103-generated-model-type
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
[SRF-003.04]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#scenario-srf-00304-public-operation-without-an-entry
