# Proposal

## Why

The README of this package has 341 lines. It holds the install steps, the limits, the security notes, the development
guide and the benchmark guide in one file. The peer project
[oscal-bindings-python](https://github.com/cairn-proofs/oscal-bindings-python) has a README of 142 lines that gives a
quick start, and it links to guides and to an API reference. This package has no API reference ([#47]). A reader of the
README cannot find what a function accepts without reading the source.

## What Changes

1. The README follows the layout of the Python README: badges, a short description with feature bullets, install, a
   quick start with runnable examples, highlights, OSCAL versions, other TypeScript OSCAL libraries, a documentation
   index, project information and license.
2. The README links to every other file with an absolute GitHub URL. The npm package holds only `README.md`,
   `LICENSE` and `package.json`, so a relative link breaks on the npm page.
3. The text of the README moves to these files:
   1. `docs/limits.md` gets the "Limits" and "Regex patterns" sections.
   2. `docs/security.md` gets the "Security notes for consumers" section.
   3. `DEVELOPING.md` gets the "Development" and "Release" sections and the "How the binding is checked" list.
   4. `PERFORMANCE.md` gets the "Benchmarks" section.
4. The README gets a section of other TypeScript OSCAL libraries. Each entry says what the library does and when to use
   it. The survey checks each claim against the library at the time of writing.
5. `test/security-notes.test.ts` reads `docs/security.md` and not `README.md`. `.github/CODEOWNERS` lists the new
   file in the group of files that hold the security notes.
6. TypeDoc generates the API reference from the entry point `src/v1/index.ts` ([#47]). It runs from a separate package
   in `api-docs/`, which has its own `package.json`, its own lockfile and its own TypeScript 6 copy. The `typescript`
   pin of the root package stays at 7.0.2.
7. The root `package.json` gets a `docs` script that builds the site. The build fails on a warning.
8. A new workflow, `.github/workflows/docs.yml`, deploys the site to GitHub Pages when a release is published. The CI
   workflow `build.yml` builds the site on each run, so a broken docs build fails a pull request.
9. The README links to the API reference at <https://cairn-proofs.github.io/oscal-bindings-typescript/>.
10. A maintainer enables GitHub Pages for the repository with the GitHub Actions source. This is a repository setting,
    not a file of the change.

The first deploy needs a release or a manual run of the workflow. The README link does not resolve before then.

## Capabilities

### New Capabilities

None. The change adds documentation and docs tooling and adds no requirement. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New files: `docs/limits.md`, `docs/security.md`, `DEVELOPING.md`, `PERFORMANCE.md`, `api-docs/package.json`,
   `api-docs/package-lock.json`, `api-docs/typedoc.json`, `api-docs/.npmrc`, `.github/workflows/docs.yml`, `spec-pin.json`, `test/spec-pin.test.ts`.
2. Changed files: `README.md`, `package.json` (one script), `test/security-notes.test.ts`, `.github/CODEOWNERS`,
   `.github/workflows/build.yml`, `.gitignore`. The README badge row has the spec-pin badge of the oscal-bindings-specs
   store.
3. New development dependencies, in `api-docs/` only: `typedoc` and `typescript` 6.0.x. The published package gains no
   dependency, and `pack:check` still sees the same three files.
4. The change adds a workflow with `pages: write` and `id-token: write`. It runs only code that a lockfile records.
5. A repository setting changes: GitHub Pages with the GitHub Actions source.
6. No consumer depends on this repo, so the change breaks no consumer.

[#47]: https://github.com/cairn-proofs/oscal-bindings-typescript/issues/47
