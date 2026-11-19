# Proposal

## Why

The package declares `engines` `>=26.13.0`, and CI tests it on one Node version and one TypeScript version, the pinned
Node 26.13.0 and TypeScript 7.0.2 ([#52]). Node 22 and Node 24 are in LTS until 2027-04-30 and 2028-04-30, and the
package excludes them. Most TypeScript users are on 5.9 or 6.0, and no test shows that the shipped `.d.ts` files
compile on those versions.

A probe of the 0.2.3 tarball showed these results:

1. TypeScript 5.9.3 and 6.0.3 type-check a consumer file against the `.d.ts` files with `skipLibCheck: false`.
2. Node 22.12.0 and Node 24.22.0 import `oscal-bindings/v1` and parse a document with no warning.
3. Node 22.0.0 to 22.11.0 import and parse, but print `ExperimentalWarning: Importing JSON modules is an experimental
   feature`. The package imports its JSON Schema with `with { type: "json" }`, and Node 22.12.0 is the first 22.x
   release where JSON modules are stable.

So the package already runs on more versions than it declares, but no test keeps it that way.

[#52]: https://github.com/cairn-proofs/oscal-bindings-typescript/issues/52

## What Changes

1. `engines` changes from `>=26.13.0` to `>=22.12.0`. The minimum TypeScript version for consumers is 5.9.
2. CI tests the packed tarball as a consumer installs it, in three legs. Each leg pairs one Node version with one
   TypeScript version, so each supported line gets at least one test:

   | Leg | Node | TypeScript |
   |---|---|---|
   | 1 | 22.12.0 (the floor) | 5.9 |
   | 2 | 24 | 6.0 |
   | 3 | 26 | 7.0 |

3. Each leg installs the tarball in an empty project. It then runs two separate steps:
   1. Import `oscal-bindings/v1` on the Node of the leg, and parse a sample document.
   2. Run `tsc` of the leg on a consumer file that uses the public types.
4. A new CI job builds and packs the tarball once. The legs download it and do not build it again. The legs run in
   parallel and do not stop each other when one fails.
5. The legs run on pushes to `main`, on pull requests, and by hand. They do not run on `v*` tags.
6. The consumer files of `scripts/pack-check.ts` move to files in the repository, and `pack:check` and the legs both
   use them.
7. The README states the supported Node and TypeScript ranges. A new TypeScript badge shows `>=5.9`.
8. The version changes from 0.2.3 to 0.2.4. The Node badge reads `engines` from npm, so it shows `>=22.12.0` when 0.2.4
   is on npm. A maintainer releases 0.2.4 after the merge with the usual tag process.
9. A maintainer adds the three legs to the required status checks of the ruleset "main: require PR and CI". This is a
   repository setting, not a file of the change.

The existing `build` job, the dev tooling and the repository TypeScript stay on the pinned versions.

## Capabilities

### New Capabilities

None. The change adds CI jobs and widens the declared Node range. It adds no requirement and changes no behavior of
the binding. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. New files: the consumer fixture files that `pack:check` and the legs share.
2. Changed files: `package.json` and `package-lock.json` (`engines` and `version`), `scripts/pack-check.ts`,
   `tsconfig.json` (excludes the fixture), `.github/workflows/build.yml`, `.github/CODEOWNERS`, `README.md`,
   `DEVELOPING.md`.
3. Consumers on Node 22.12.0 or later and Node 24 can install the package without an `engines` warning. The change
   breaks no consumer.
4. A CI run on `main` or on a pull request gets four more jobs. The added wall-clock time is about the time of the pack
   job plus one leg.
5. A repository setting changes: the required status checks of the ruleset "main: require PR and CI".
