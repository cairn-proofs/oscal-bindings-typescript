# Development

The toolchain is pinned in `mise.toml`. Run the full check gate with:

```sh
npm ci
npm run check
```

The toolchain includes `actionlint`. Run `actionlint` after a change to a file in `.github/workflows/`.

The check gate downloads a pinned spec artifact release from cairn-proofs/oscal-bindings-specs over HTTPS. The pin is
release `v0.9.0+oscal.1.2.3`, and `scripts/spec-artifact.ts` holds its sha256. A change that moves the pin also sets `version` in `spec-pin.json`, which
the spec-pin badge of the README reads. `test/spec-pin.test.ts` fails when the two differ.

`npm run generate` reads two manifests of the artifact: the naming manifest `names.json`, and the constraint manifest
`constraints.json`. It copies the schema and the constraint manifest into `src/generated/`. It stops when the constraint
manifest does not conform to its JSON Schema, when its `format` is not 1, or when its `oscal-release` is not the release
of the pin.

## API reference
`npm run docs` builds the API reference with TypeDoc into `api-docs/site/`. TypeDoc does not support the TypeScript 7 of
the root package, so `api-docs/` is a separate package with its own `package.json`, its own lockfile and its own
TypeScript 6. The script installs that package with `npm ci`, and then runs TypeDoc on `src/v1/index.ts`. A warning
fails the build. The script is not part of `npm run check`. The CI workflow `.github/workflows/build.yml` runs it after
the check gate.

## How the binding is checked
- A conformance runner. It runs each case of `corpus/1.2.3/cases.json` as one test, with the case id as the test name.
  The cases of parsing, the `round-trip` cases, the `yaml-parse`, `yaml-parse-file` and `yaml-round-trip` cases, the
  `element/*` cases, the `element-types` case, the `facade` cases, the `assessment-period` cases, and the `build-hash`,
  `build-rlink`, and `build-resource` cases pass, except the cases that `expected-failures.json` lists.
  The runner skips `yaml-parse-typed`. The binding offers no typed YAML parser, and the corpus README tells a binding
  to skip the operation when YAML is optional for its typed parsers (YML-007).
  `test/conformance/expected-failures.json` lists each case that the binding does not pass yet, with the issue that
  owns it as the reason. A listed case that passes fails the run, and so does a listed id that is not in the corpus.
  The unit tests that read corpus inputs directly do not use a listed case. A change that fixes a case removes its
  entry from the list.
- A traceability record, `openspec/traceability.json`. It has one entry for each name that the entry point exports,
  except the generated model types. `test/traceability.test.ts` checks the record against the JSON Schema and the
  requirement index of the pinned spec artifact. A test also compares the record with the exports of the entry point.
- Three consumer legs. The jobs `consumer-package` and `consumer` of `.github/workflows/build.yml` run on each push to
  `main`, on each pull request and by hand, and not on a `v*` tag. `consumer-package` packs the tarball once. Each leg
  installs the tarball and its TypeScript in an empty project, runs `test/consumer/check.mjs` on its Node ("Run on
  Node"), and runs `tsc` on `test/consumer/consumer.ts` ("Type-check with TypeScript"). The legs are
  `consumer (node 22, ts 5.9)` with Node 22.12.0, the floor of `engines`, `consumer (node 24, ts 6.0)`, and
  `consumer (node 26, ts 7.0)`. `npm run pack:check` uses the same files in `test/consumer/`. A change to the lines of
  a leg also changes the required checks of the ruleset "main: require PR and CI".

## Release
A pull request sets the new `version` in `package.json`. After the merge, a maintainer tags the merge commit `v<version>`
and pushes the tag. The CI workflow `.github/workflows/build.yml` then runs the check gate on the tag. When the gate
passes, it builds the package tarball once, signs its build provenance, and attaches it to a draft GitHub release. The
workflow fails early when the tag is not `v<version>`, when the tagged commit is not on `main`, or when
`test/conformance/expected-failures.json` has an entry. `README.md` states that the binding passes the conformance
corpus, so a release cannot have a listed case.
A maintainer reviews the draft and publishes it. The workflow `.github/workflows/release.yml` then downloads the tarball
from the release, verifies its signature and its name and version, and publishes those exact bytes to npm with trusted
publishing. The workflow never builds the package, so the file on npm is the file that passed the gate.
The same CI run builds the API reference after the gate passes, zips it, and signs the zip with the tarball. The zip is
attached to the draft release. After the publish to npm succeeds, `release.yml` calls `.github/workflows/docs.yml`. It
downloads the zip, verifies its signature, and deploys those files to GitHub Pages. It never builds the site. A failed
publish gives no deploy, so the site never describes a version that npm does not have. A maintainer can run the docs
workflow by hand to deploy again or to repeat a failed deploy. The run starts from the tag, for example
`gh workflow run docs.yml --ref v<version> -f tag=v<version>`, because the environment `github-pages` allows only the
tags `v*`.
