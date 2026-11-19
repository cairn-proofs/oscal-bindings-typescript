# Development

The toolchain is pinned in `mise.toml`. Run the full check gate with:

```sh
npm ci
npm run check
```

The check gate downloads a pinned spec artifact release from cairn-proofs/oscal-bindings-specs over HTTPS. The pin is
release `v0.8.0+oscal.1.2.3`, and `scripts/spec-artifact.ts` holds its sha256. A change that moves the pin also sets `version` in `spec-pin.json`, which
the spec-pin badge of the README reads. `test/spec-pin.test.ts` fails when the two differ.
## API reference
`npm run docs` builds the API reference with TypeDoc into `api-docs/site/`. TypeDoc does not support the TypeScript 7 of
the root package, so `api-docs/` is a separate package with its own `package.json`, its own lockfile and its own
TypeScript 6. The script installs that package with `npm ci`, and then runs TypeDoc on `src/v1/index.ts`. A warning
fails the build. The script is not part of `npm run check`. The CI workflow `.github/workflows/build.yml` runs it after
the check gate.

## How the binding is checked
- A conformance runner. It runs each case of `corpus/1.2.3/cases.json` as one test, with the case id as the test name.
  The cases of parsing, the `round-trip` cases, the `yaml-parse` and `yaml-round-trip` cases, the `element/*` cases, the
  `element-types` case, the `facade` cases, the `assessment-period` cases, and the `build-hash`, `build-rlink`, and
  `build-resource` cases pass.
  `test/conformance/expected-failures.json` lists each case that needs an operation that does not exist yet. A listed
  case that passes fails the run, and so does a listed id that is not in the corpus. A change that adds an operation
  connects it in `test/support/adapter.ts` and removes the cases that it fixes from the list.
- A traceability record, `openspec/traceability.json`. It has one entry for each name that the entry point exports,
  except the generated model types. `test/traceability.test.ts` checks the record against the JSON Schema and the
  requirement index of the pinned spec artifact. A test also compares the record with the exports of the entry point.

## Release
A pull request sets the new `version` in `package.json`. After the merge, a maintainer tags the merge commit `v<version>`
and pushes the tag. The workflow `.github/workflows/release.yml` then builds the package and publishes it to npm with
trusted publishing. The workflow stops when the tag is not `v<version>`, or when the tagged commit is not on `main`.
When the release is published, the workflow `.github/workflows/docs.yml` builds the API reference of the tag and deploys
it to GitHub Pages. A maintainer can run that workflow by hand with a tag, to deploy the first site or to repeat a
failed deploy.
