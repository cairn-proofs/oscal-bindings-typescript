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
and pushes the tag. The CI workflow `.github/workflows/build.yml` then runs the check gate on the tag. When the gate
passes, it builds the package tarball once, signs its build provenance, and attaches it to a draft GitHub release. The
workflow fails early when the tag is not `v<version>`, or when the tagged commit is not on `main`.
A maintainer reviews the draft and publishes it. The workflow `.github/workflows/release.yml` then downloads the tarball
from the release, verifies its signature and its name and version, and publishes those exact bytes to npm with trusted
publishing. The workflow never builds the package, so the file on npm is the file that passed the gate.
The same CI run builds the API reference after the gate passes, zips it, and signs the zip with the tarball. The zip is
attached to the draft release. The workflow `.github/workflows/docs.yml` runs when the release is published. It downloads
the zip, verifies its signature, and deploys those files to GitHub Pages. It never builds the site. A maintainer can run
that workflow by hand to deploy the first site or to repeat a failed deploy. The run starts from the tag, for example
`gh workflow run docs.yml --ref v<version> -f tag=v<version>`, because the environment `github-pages` allows only the
tags `v*`.
