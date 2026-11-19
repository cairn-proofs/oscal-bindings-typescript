# Design

## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. The package has one entry point, `src/v1/index.ts`. It re-exports each public function and error, and it ends with
   `export type * from "../generated/oscal.ts"`.
2. The npm package holds `README.md`, `LICENSE` and `package.json` only. `scripts/pack-check.ts` enforces this list.
3. `test/security-notes.test.ts` reads the "Security notes for consumers" section of `README.md` and checks each note
   against the code. `.github/CODEOWNERS` names that README and that test as one group.
4. The root package pins `typescript` at 7.0.2. TypeDoc 0.28.20 declares a peer range that ends at TypeScript 6.0.x.
5. A probe on a copy of `src` used TypeDoc 0.28.20 and TypeScript 6.0.3, which was installed under the name
   `typescript`. With `src/v1/index.ts` as the only entry point, the build gave no error and no warning. The 15
   warnings of [#47] came from entry points that did not include the generated types.
6. A probe that installed TypeScript 6.0.3 under the alias `typescript-6` next to the root `typescript` failed with
   an npm `ERESOLVE` error.
7. `.npmrc` sets `ignore-scripts=true` and `save-exact=true`. npm reads it from the folder of the package, so a nested
   package needs its own copy.
8. `release.yml` publishes to npm. Its publish job has `id-token: write`, and it runs only code that a lockfile
   records. The workflow files pin each action by commit.
9. GitHub Pages is not enabled for the repository.

## Goals / Non-Goals

**Goals:**

1. A reader finds the quick start in the first screen of the README and the long-form text one link away.
2. The API reference builds locally and in CI with no error and no warning, and it deploys from a release.

**Non-Goals:**

1. A change to the behavior of the binding or to its public API.
2. A change to the TypeScript version of the root package.

## Decisions

### D1: The README layout and where each section goes

The README follows the order of the Python README. A section that has no peer content in this repo is new.

| README section | Source |
|---|---|
| Badges | New. Spec pin, CI, npm version, Node version, license. |
| Description and feature bullets | "Why use it" of the current README, cut to six bullets. |
| Install | "Install" of the current README, minus the version paragraph. |
| Quick start | New. Parse, read, serialize and reject, on one catalog. |
| Highlights | "What you can do" of the current README, each item with a link into `docs/`. |
| OSCAL versions | The version paragraph of "Install". |
| Other TypeScript OSCAL libraries | New (D6). |
| Documentation | New index of the files below and the API reference. |
| Project information | New. Source, issues, npm, releases, the Python binding, `DEVELOPING.md`. |
| License | "License" of the current README. |

The long text moves without a change of meaning:

1. "Limits" and "Regex patterns" go to `docs/limits.md`.
2. "Security notes for consumers" goes to `docs/security.md` (D3).
3. "Development", "How the binding is checked" and "Release" go to `DEVELOPING.md`.
4. "Benchmarks" goes to `PERFORMANCE.md`. The file holds the how-to of `npm run bench`. It holds no measured numbers.

The Python badge for the spec pin reads `spec-pin.json`. This repo adds that file at its root, with the version that
`SPEC_ARTIFACT_VERSION` holds in `scripts/spec-artifact.ts`. `test/spec-pin.test.ts` fails when the two differ, so the
badge cannot show a stale version. The badge follows the sticker of the oscal-bindings-specs store. The README has no
conformance badge.

**Why:** the user chose the Python layout as the model. The long sections keep their text, so a reader loses nothing and
the README shrinks.

### D2: Absolute links

Each link from the README to a file of the repository is an absolute `https://github.com/cairn-proofs/oscal-bindings-typescript/blob/main/...`
URL. The npm page does not contain the other files, so a relative link breaks there. Links between the moved files are
relative, because those files render on GitHub. A moved section keeps its heading text, so a link of the form
`docs/limits.md#limits` resolves.

**Alternative:** relative links in the README. Rejected, because they break on the npm page.

### D3: The security notes and their test

`docs/security.md` has the title "Security notes for consumers". Its sections are the three groups of the current
section, and its subsections are the current notes. The heading levels move up by one, and the heading text stays.

`test/security-notes.test.ts` reads `docs/security.md`, looks for the title and each note at the new levels, and
keeps each other check. Its header comment names the new file. `.github/CODEOWNERS` lists `/docs/security.md` in the
group that now holds `/README.md`, so a change to the notes still needs the same review. The README stays in that group
as the page that links to the notes.

**Why:** the test and the CODEOWNERS group exist so that a note cannot become false without a reviewer seeing it. The
move must keep that protection, or the move weakens the package.

### D4: TypeDoc runs from a separate package

`api-docs/` is a package with its own `package.json`, `package-lock.json` and `.npmrc`. Its development dependencies
are `typedoc` and `typescript` 6.0.x, with exact versions. `api-docs/typedoc.json` has `src/v1/index.ts` as its entry
point and the build tsconfig of the root as its tsconfig. It writes the site to `api-docs/site/`, which `.gitignore`
lists. The options `treatWarningsAsErrors` and `validation` make a warning fail the build.

**Why:** TypeDoc loads the package named `typescript`. The alias route needs a second name for TypeScript 6, and the
probe of Context 6 shows that it does not install next to TypeScript 7. A separate package gives TypeScript 6 its own
`node_modules` and leaves the root pin unchanged.

**Alternatives:**
1. An npm alias in the root package. Rejected, because the probe failed.
2. API Extractor. Rejected, because TypeDoc builds with no warning and the fallback is not needed.
3. A `docs/` folder for the package. Rejected, because `docs/` holds the guides (D1).

The root type check stays on TypeScript 7. TypeScript 6 only reads the source to describe it. A type error still fails
`npm run typecheck`.

### D5: The entry point and the generated types

The only entry point is `src/v1/index.ts`. It is the public API, so the site documents what a consumer imports and
nothing else. The generated types are reachable through `export type *`, so the site includes them and links each
reference to a generated type to its page. This closes the 15 warnings of [#47] without a second entry point.

### D6: Other libraries section

The section lists TypeScript and JavaScript libraries for OSCAL. For each one it says what the library does and when
to choose it, in the form of the Python section. The author reads the README and the types of each library and writes
only what they show. The `npm search oscal` results at the time of writing show these candidates: `oscal-types`,
`@easydynamics/oscal-types` and `@grc-claw/oscal`. The author checks each one, drops a library that has no OSCAL
data-binding or I/O purpose, and adds any library that the survey finds.

### D7: Build in CI, deploy on release

1. The root script is `"docs": "npm ci --prefix api-docs && npm run build --prefix api-docs"`. The root `check` script
   does not call it, so a local `npm run check` keeps one install.
2. `build.yml` runs `npm run docs` after the `Check` step. A docs failure fails the pull request.
3. `.github/workflows/docs.yml` runs on `release: published` and on `workflow_dispatch` with a `tag` input. The job
   checks out the tag, checks that the tag commit is on `main` (as `release.yml` does), installs the toolchain from
   `mise.lock`, runs `npm ci` and `npm run docs`, and deploys `api-docs/site/` with `actions/upload-pages-artifact`
   and `actions/deploy-pages`. It uses the pins of those two actions that the Python repo uses
   (`fc324d3547104276b827a68afc52ff2a11cc49c9` and `368f82528645a54fb793d4d04e342629a3f51346`). The job has the
   environment `github-pages` and the permissions `contents: read`, `pages: write` and `id-token: write`.

**Why a release and not each push:** the package has a release flow, and the Python repo deploys from a release. The
site then matches a version that a consumer can install. `workflow_dispatch` gives a way to deploy the first site and
to repeat a failed deploy.

**Why the job builds and does not verify a signed archive, as the Python repo does:** the Python repo builds the docs in
one job and deploys them in another, so it signs the archive in between. This job builds and deploys in one job from a
locked tag, as the publish job of `release.yml` does. One job has no hand-off to protect.

### D8: The quick start

The quick start uses a catalog that is valid against the schema and prints values that the author ran. The author
runs the code with `tsx` against `src/v1/index.ts` and copies the real output into the README.

## Risks / Trade-offs

1. [The README link to the API reference does not resolve until the first deploy] → The tasks end with a manual
   run of the workflow. The README change and the workflow merge in one pull request.
2. [An example in the README can drift from the code] → The author runs each example before merge. The existing
   security-notes test still pins the notes.
3. [TypeScript 6 describes code that TypeScript 7 checks] → The root type check runs on TypeScript 7. TypeDoc fails on
   any warning. The author re-checks the TypeDoc peer range when TypeScript 7.1 ships.
4. [The deploy job runs TypeDoc with `pages: write`] → `.npmrc` blocks install scripts, a lockfile records each
   package, `npm ci` installs only that lock, and the job runs only after a maintainer publishes a release.
5. [Moved sections lose the review of the README group in CODEOWNERS] → D3 adds the new file to the group.
6. [TypeDoc needs the Node types that the source imports] → The author checks that the build has no error in a clean
   clone. If the build needs `@types/node`, `api-docs/package.json` gets it as an exact version.

## Migration Plan

1. Merge the change. CI builds the site on the pull request.
2. A maintainer enables GitHub Pages with the source "GitHub Actions" in the settings of the repository, and
   approves the environment `github-pages`.
3. A maintainer runs the `docs` workflow by hand with the tag `v0.2.0`.
4. To roll back, revert the commit. A deployed site stays until a maintainer unpublishes it in the settings.

[#47]: https://github.com/cairn-proofs/oscal-bindings-typescript/issues/47
