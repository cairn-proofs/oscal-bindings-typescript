## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. The source files import each other with `.ts` extensions (`allowImportingTsExtensions`). `tsconfig.json` sets
   `noEmit`. `src/validators.ts` imports `src/generated/oscal-complete-schema.json` with `with { type: "json" }`.
2. The repository pins TypeScript 7.0.2. TypeScript 7.0 has no stable compiler API, so a tool that reads the exports of
   a module through that API does not run.
3. A probe in a temporary directory showed these TypeScript 7.0.2 results. `tsc` with `rewriteRelativeImportExtensions`,
   `declaration`, and `resolveJsonModule` writes `.js` files with `.js` imports. It copies the JSON schema to the output
   directory. The `.d.ts` files keep the `.ts` extensions. A consumer project with `moduleResolution: NodeNext` and
   `skipLibCheck: false` type-checks against those `.d.ts` files. An `exports` map with only `./v1` makes Node reject
   `import("<package>/dist/parse.js")` with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
4. `.npmrc` sets `ignore-scripts=true`. npm then skips the `prepack` and `prepublishOnly` scripts, but it still runs
   `npm run <script>`.
5. The pinned Node 26.13.0 bundles npm 11.20.0. npm trusted publishing needs npm 11.5.1 or later. npm adds a
   provenance attestation to a package that a GitHub-hosted runner publishes through trusted publishing from a public
   repository. This repository is public.
6. npm configures a trusted publisher in the settings of a package that exists. So the first version needs one
   publish by hand. A new trusted publisher expires when it has no successful publish within 2 days.
7. `test/security-notes.test.ts` checks that `package.json` sets `"private": true`, and it checks the names that the
   security notes use against the source modules.
8. `scripts/generate.ts` writes each generated file from a list. `npm run generate:check` fails when a file in that list
   differs from the generator output.
9. The ruleset "main: require PR and CI" requires a pull request and a passing `build` check, with the check run on the
   current `main`. It allows merge, squash, and rebase merges. CI checks the head of a pull request and the new tip of
   `main`, so a rebase merge puts commits on `main` that CI did not check. The ruleset "Protect release tags" blocks
   the deletion and the update of a `v*` tag, but not the creation of one. It has no bypass list. The repository has no
   GitHub environment.
10. A GitHub ruleset applies its bypass list to each of its rules. A GitHub environment with no deployment policy
    accepts a job from any branch or tag. npm trusted publishing matches the repository, the workflow file, and the
    environment, not the branch or the tag.
11. A tag push runs the `release.yml` of the tagged commit. A commit on a branch that is not merged can change that
    workflow.
12. `jdx/mise-action` restores a cache of the toolchain by default, and mise then does not install again a tool that
    the cache holds.
13. `OscalDoc.body` returns the type `OscalBody` of `src/document.ts`, which the module does not export.

## Goals / Non-Goals

**Goals:**

1. A consumer installs `oscal-bindings` from npm and imports `oscal-bindings/v1` from JavaScript or TypeScript.
2. The check gate fails when the public API and the traceability record differ, or when the package does not install
   and import.

**Non-Goals:**

1. Node versions other than the pinned Node 26 line. The check gate tests one Node version.
2. A CommonJS build. The package is an ES module. Node 26 can `require()` an ES module.
3. A root entry point (`oscal-bindings` without `/v1`).

## Decisions

### D1: The entry point is `src/v1/index.ts`, which only re-exports

`src/v1/index.ts` holds only these statement forms and comments:

1. `export { <names> } from "../<module>.ts";` for each value.
2. `export type { <names> } from "../<module>.ts";` for each named type.
3. One `export type * from "../generated/oscal.ts";` for the generated model types.

The source modules stay in `src/`. The internal helpers of `src/validators.ts`, `src/yaml.ts`, and `src/text.ts` stay
out of the entry point.

**Why:** a fixed statement form lets the test of D4 read the export list from the text of the file (Context item 2).
The entry point is the only place where the public API is defined.

**Alternative:** move the source modules into `src/v1/`. No second namespace exists yet, so the move changes each
import path and gives no result that a consumer can observe.

**Alternative:** a root entry point that re-exports `v1`, as `oscal_bindings` does in oscal-bindings-python. A root
entry point must stay on `v1` or move to `v2` when OSCAL 2 comes. A later change can add one without a break for any
consumer, and no later change can remove one without a break.

### D2: The public names and their record entries

The entry point exports the names that are in `openspec/traceability.json` now, and these names.
`openspec/traceability.json` adds one entry for each:

| Name | Kind | Requirements |
| --- | --- | --- |
| `OSCAL_RELEASE` | value | VER-002 |
| `OscalError` | class | ERR-001, ERR-009, ERR-010 |
| `ParseError` | class | ERR-001, ERR-003, ERR-004 |
| `DocumentTypeMismatchError` | class | ERR-005, ERR-009 |
| `LimitExceededError` | class | ERR-010, ERR-011 |
| `BuilderError` | class | ERR-013 |
| `NotFoundError` | class | ERR-006 |
| `ReadError` | class | ERR-012 |
| `UnknownElementTypeError` | class | ERR-008 |
| `AccessError` | class | ERR-007 |
| `ErrorCategory` | type | ERR-001, ERR-009 |
| `Limit` | type | ERR-010 |
| `FailureEntry` | type | ERR-003 |
| `SerializeOptions` | type | SER-003 |
| `OscalBody` | type | FAC-001 |
| `AssessmentPeriod` | type | FAC-004 |
| `ElementValidationResult` | type | ELV-001 |
| `RlinkOptions` | type | BMB-002 |
| `ResourceOptions` | type | BMB-003, BMB-004 |

The generated model types have no entry ([SRF-001.03]). The generated registry row type `ElementType` stays internal,
because no public signature uses it.

**Why:** a caller tests an error with `instanceof`, so each error class is a value of the API. A named type of a public
signature is exported so that a caller can write the type of an argument or a result. `src/document.ts` exports
`OscalBody` for this reason (Context item 13). A public operation is a function,
a type, or a member of a type, so each of these names needs an entry ([SRF-003]). oscal-bindings-python records its
error classes, `OscalBody`, and `ElementValidationResult` in the same way.

**Alternative:** export only the values. A caller then writes `Parameters<typeof serialize>[1]` for the options of
`serialize`. The types exist in each `.d.ts` file in either case.

### D3: `OSCAL_RELEASE` is a generated constant

`scripts/generate.ts` adds `src/generated/release.ts` to its list of files (Context item 8):

```ts
// Generated by scripts/generate.ts. Do not edit.
/** The OSCAL release that this binding was generated from (VER-002). */
export const OSCAL_RELEASE = "1.2.3";
```

The value is `OSCAL_RELEASE` of `scripts/spec-artifact.ts`, which the spec pin gives.

**Why:** the pin is the explicit identifier of the active release (VER-002.01). `npm run generate:check` fails when a
pin move does not regenerate the constant.

**Alternative:** a literal in `src/v1/index.ts` and a test that compares it with the pin. That adds a test, and the
generator already has the check.

### D4: The test of the public API

`test/traceability.test.ts` adds these tests:

1. The test removes the comments from `src/v1/index.ts`, and reads each statement with the forms of D1. A statement of
   any other form fails the test.
2. The names of the record equal the names of the `export { }` and `export type { }` statements. Each missing entry and
   each extra entry is a separate message.
3. The keys of `await import("../src/v1/index.ts")` equal the names of the `export { }` statements. This shows that the
   test read the statements correctly, and that no type is in an `export { }` statement. Also, no name of an
   `export type { }` statement is a key of its source module. So a class or a function cannot hide in an
   `export type { }` statement, where a caller cannot use it as a value.
4. The major version of `OSCAL_RELEASE` is the number in the directory name `v1` ([VER-001.02]). A pin move to an OSCAL
   2 release fails this test.

**Why:** Context item 2. The test reads only a file whose form D1 fixes, and it fails for each form that it does not
know.

**Alternative:** API Extractor on the `.d.ts` output. It brings a second TypeScript version into the check gate for one
list of names.

### D5: The build and the package fields

`tsconfig.build.json` sets `rootDir: "src"`, `outDir: "dist"`, `declaration`, `rewriteRelativeImportExtensions`,
`resolveJsonModule`, and `noEmit: false`. It includes `src/**/*.ts`. The script `build` removes `dist/`, then runs
`tsc -p tsconfig.build.json`. `.gitignore` adds `dist/`.

`package.json` changes:

1. `name` is `oscal-bindings`, and `version` is `0.1.0`. `private` is removed.
2. `exports` is `{ "./v1": { "types": "./dist/v1/index.d.ts", "default": "./dist/v1/index.js" } }`.
3. `files` is `["dist"]`. npm also adds `package.json`, `README.md`, and `LICENSE`.
4. `repository` is `{ "type": "git", "url": "git+https://github.com/cairn-proofs/oscal-bindings-typescript.git" }`. npm
   trusted publishing compares this URL with the repository of the workflow.
5. `engines.node` is `>=26.13.0`.
6. `dependencies` are `^8.20.0` for `ajv`, `^3.0.1` for `ajv-formats`, and `^2.9.1` for `yaml`.
7. `description` does not say "Not published yet".
8. The script `pack:check` runs `scripts/pack-check.ts` (D6). `check` runs `pack:check` before `validate`.

`package-lock.json` is regenerated for the new name and ranges. The installed versions do not change.

`.github/CODEOWNERS` adds `/src/v1/` and `/tsconfig.build.json`. These files define what the package exposes and what it
holds.

**Why (item 5):** the check gate tests Node 26.13.0 only. An exact version blocks each other Node 26 release.

**Why (item 6):** a library with exact dependency versions blocks a consumer from a fix of a dependency. It can also
make npm install a second copy of the dependency. oscal-bindings-python states its dependency as a range below the next
major version, for the same reason. `.npmrc` (`save-exact=true`) and the lockfile keep the build of this repository
exact. They do not apply to the install of a consumer.

**Alternative (item 1):** version `1.0.0`. The README marks the binding as alpha. Versions below 1.0.0 tell a consumer
that the API can change.

### D6: The package check

`scripts/pack-check.ts` does these steps and fails at the first problem:

1. Run `npm run build`.
2. Run `npm pack --json` into a temporary directory. Each file of the tarball is `package.json`, `README.md`, `LICENSE`,
   or a file under `dist/`.
3. Make an empty ES module project in a temporary directory. Install the tarball and `@types/node` at the version of
   `package.json`, with `--ignore-scripts` and `--prefer-offline`.
4. Type-check a consumer file with the `tsc` of this repository and `skipLibCheck: false`. The consumer file imports a
   function, an error class, a named type, a generated model type, and `OSCAL_RELEASE` from `oscal-bindings/v1`.
5. Run a Node script in the project. It parses a minimal catalog with `parse`, and compares `OSCAL_RELEASE` with the
   generated value. It checks that `import("oscal-bindings")` and `import("oscal-bindings/dist/parse.js")` reject with
   `ERR_PACKAGE_PATH_NOT_EXPORTED`.
6. Remove the temporary directories.

**Why:** the test of D4 reads the source. This check reads what a consumer installs. So it finds a wrong `exports`
path, a missing file, or a `.d.ts` file that a consumer cannot resolve (Context item 3).

### D7: The release workflow

`.github/workflows/release.yml` runs when a tag that starts with `v` is pushed. It has one job:

1. `runs-on: ubuntu-latest`, `environment: npm`, and the permissions `contents: read` and `id-token: write`.
2. Check out the tag with `fetch-depth: 0` and `persist-credentials: false`. Install the toolchain with the pinned
   `jdx/mise-action` and `cache: false`. Both actions are pinned by commit, as in `.github/workflows/build.yml`.
3. Check the tag. The tag is `v` and the `version` of `package.json`. The tagged commit is on `origin/main`. The step
   reads the tag from the `GITHUB_REF_NAME` environment variable, not from an expression in the script.
4. Run `npm ci` and `npm run build`. Then run `npm pack --dry-run`.
5. When `npm view oscal-bindings@<version> version` gives the version, the job states that npm already has it and stops
   with success.
6. Run `npm publish`. npm gets a short-lived token through OpenID Connect and adds the provenance attestation (Context
   item 5).

**Why:** a process in a job with `id-token: write` can get an npm token. So the job runs only code that a lock records.
That code is the toolchain of `mise.lock` (Context item 12) and the packages of `package-lock.json`. No install script
runs (Context item 4). It does not run `npm run check`, because `pack:check` installs the dependencies of the tarball
without a lockfile. The release depends on the CI run of the commit on `main` instead (Context item 9). Item 5 makes a
run for the tag of the version that the maintainer published by hand pass (Context item 6).

Item 3 stops a tag on a commit that is not merged by mistake. It does not stop a person who can push a branch and a
tag, because that person can change the workflow (Context item 11). Two settings of the migration plan stop that
person. The deployment policy of the `npm` environment accepts only a `v*` tag, so a run from a branch cannot use the
environment (Context item 10). A new tag ruleset lets only a repository admin create a `v*` tag. A third setting turns
off rebase merges, so each commit on `main` is a commit that CI checked (Context item 9).

**Alternative:** two jobs. A job with no `id-token` runs `npm run check` and `npm pack`, and a second job publishes the
tarball. No test showed that npm adds provenance to a publish from a tarball, and the CI run on `main` already ran the
check.

**Alternative:** staged publishing (`npm stage publish`), where a maintainer approves each release with 2FA on
npmjs.com. The tag ruleset already limits who can start a release.

### D8: The README and the security notes

`README.md` changes:

1. The alpha warning does not say that the binding has no npm package.
2. A new section `## Install` gives `npm install oscal-bindings` and an example import from `oscal-bindings/v1`. It
   states that `OSCAL_RELEASE` holds the OSCAL release, and that a later OSCAL major version gets a new path.
3. The `## Status` list adds the entry point and the test of D4. The "What does not exist" list goes away.
4. The note "Install the binding" names the package `oscal-bindings` and its repository. Its steps are: pin an exact
   version, commit the lockfile, install with `npm ci --ignore-scripts`, run `npm audit signatures`, and review each
   change in the dependencies. The note states that `npm audit signatures` checks the provenance attestation of each
   release that the workflow published.
5. `## Development` adds `### Release`. A pull request sets the new `version` in `package.json`. After the merge, a
   maintainer tags the merge commit `v<version>` and pushes the tag.

`test/security-notes.test.ts` changes:

1. The install test checks that `package.json` has the name `oscal-bindings`, no `private` field, and the one export
   `./v1`, and it keeps the check of the three dependencies.
2. The test "each operation that the notes name exists" reads the names from `src/v1/index.ts` through a dynamic
   import, not from the source modules.

**Why:** Context item 7. The notes describe what a consumer installs, so the tests read the entry point.

## Risks / Trade-offs

1. [A version published by hand without a build] → The steps of the migration plan run `npm run build`, and
   `npm pack --dry-run`, which lists the files. npm does not let a publisher replace a version. A bad
   version gets `npm deprecate` and a new version.
2. [A consumer on Node 22 or 24 gets an engines warning] → Non-Goal 1. A later change can add Node versions to CI and
   widen `engines`.
3. [A consumer gets a newer minor version of a dependency than the lockfile of this repository holds] → The note
   "Install the binding" tells a consumer to commit a lockfile. It also tells a consumer to review each dependency
   change.
4. [The test of D4 reads source text] → It fails for each statement form that D1 does not allow. An unknown form
   cannot hide an export.
5. [The `.d.ts` files keep `.ts` imports] → The package check type-checks a consumer on each run of the check gate.

## Migration Plan

1. Implement the tasks on the feature branch, and run `npm run check`. Archive this change on the branch. The change
   has no spec deltas, so the archive only moves the change directory. Merge the pull request.
2. The maintainer does these steps one time:
   1. Make an npm account and turn on two-factor authentication.
   2. In the GitHub settings of the repository, make these changes:
      1. Add a tag ruleset "Restrict release tag creation" for `refs/tags/v*`, with only the rule "Restrict
         creations". Add the role "Repository admin" to its bypass list. Do not change "Protect release tags", so that
         no account can delete or move a `v*` tag (Context item 10).
      2. In the ruleset "main: require PR and CI", remove `rebase` from the allowed merge methods (Context item 9).
      3. Make the environment `npm`. Set "Deployment branches and tags" to "Selected branches and tags", and allow only
         the tag pattern `v*`.
   3. On `main` at the merge commit, run `npm ci`, `npm run build`, and `npm pack --dry-run`. Check that the list holds
      `dist/v1/index.js` and `dist/v1/index.d.ts`. Run `npm login`, then `npm publish`. npm asks for the 2FA code. The
      CI run of the merge commit already ran `npm run check`.
   4. Tag the merge commit `v0.1.0` and push the tag. The release workflow passes and publishes nothing, because npm has
      the version.
   5. When the next version is ready to release, configure the trusted publisher on npmjs.com, in the settings of
      `oscal-bindings`. Select GitHub Actions. Enter the organization `cairn-proofs`, the repository
      `oscal-bindings-typescript`, the workflow `release.yml`, and the environment `npm`. Allow `npm publish`. Then push
      the tag of that version within 2 days (Context item 6).
   6. After that release passes, set the publishing access of the package to "Require two-factor authentication and
      disallow tokens".

[SRF-001.03]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#scenario-srf-00103-generated-model-type
[SRF-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/binding-surface/spec.md#requirement-srf-003-a-binding-records-the-requirement-that-covers-each-public-operation
[VER-001.02]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/schema-versioning/spec.md#scenario-ver-00102-new-major-version-adds-a-namespace
