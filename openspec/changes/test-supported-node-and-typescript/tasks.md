# Tasks

## 1. Shared consumer files

- [x] 1.1 Create `test/consumer/tsconfig.json`, `test/consumer/consumer.ts` and `test/consumer/check.mjs` per
  [design D1](design.md#d1-the-consumer-files-move-to-testconsumer). `tsconfig.json` sets `types: []`. Add
  `test/consumer/**` to the `exclude` list of the root `tsconfig.json`. Verify `npm run typecheck` passes.
- [x] 1.2 Change `scripts/pack-check.ts` to copy the three files into its temporary project, to stop installing
  `@types/node`, and to run the `OSCAL_RELEASE` comparison of
  [design D1](design.md#d1-the-consumer-files-move-to-testconsumer) after `node check.mjs`. Verify `npm run pack:check`
  passes. Verify that it fails when `consumer.ts` uses a name that the entry point does not export, and when the
  expected release value differs from the value in the package.
- [x] 1.3 Add `/test/consumer/` to `.github/CODEOWNERS` in the group of files that can weaken the CI gate.

## 2. Supported range

- [x] 2.1 Set `engines.node` in `package.json` to `>=22.12.0` and `version` to `0.2.4`. Run
  `npm install --package-lock-only` so `package-lock.json` records the same values. Verify `npm run check` passes.

## 3. CI legs

- [x] 3.1 Add the `consumer-package` job to `.github/workflows/build.yml` per
  [design D2](design.md#d2-a-consumer-package-job-packs-the-tarball-once). Verify that `actionlint` passes and that the
  job has no `needs` and does not run on a `v*` tag.
- [x] 3.2 Add the `consumer` matrix job per
  [design D3](design.md#d3-a-consumer-matrix-job-runs-the-three-legs), with the latest Node 24.x as the exact version of
  leg 2. Take each sha256 from the `SHASUMS256.txt` of that Node version on nodejs.org, and verify that the value for
  26.13.0 equals the `linux-x64` checksum in `mise.lock`. Verify that `actionlint` passes and that each action is
  pinned by commit.
- [x] 3.3 Open the pull request. Verify that the three legs run in parallel after `consumer-package`, that each leg
  shows "Run on Node" and "Type-check with TypeScript" as separate green steps, and that the check names are
  `consumer (node 22, ts 5.9)`, `consumer (node 24, ts 6.0)` and `consumer (node 26, ts 7.0)`.
- [x] 3.4 Open two draft pull requests from the branch of 3.3, one for each deliberate break of the
  [migration plan](design.md#migration-plan). Verify that each break turns only leg 1 red, on the step that the
  migration plan names, that the other step of leg 1 is green, and that legs 2 and 3 are green. Close both drafts
  without a merge.

## 4. Documentation

- [x] 4.1 In `README.md`, replace "The package needs Node 26.13.0 or later" with the supported ranges: Node 22.12.0 or
  later, and TypeScript 5.9 or later for type checking. Add a static badge `TypeScript >=5.9` next to the Node badge.
  Verify that the README states the same Node range as `engines` and the same TypeScript lines as the matrix.
- [x] 4.2 In `DEVELOPING.md`, add an item to "How the binding is checked" that describes the legs and their lines, and
  states that a change to the lines of a leg also changes the required checks of the ruleset "main: require PR and
  CI". Verify that the item names the same lines as `build.yml`.

## Workflow follow-up

- After the merge, a maintainer adds the three check names of task 3.3 to the required status checks of the ruleset
  "main: require PR and CI". Verify with `gh api repos/cairn-proofs/oscal-bindings-typescript/rulesets/25432261`.
- After the merge, a maintainer tags the merge commit `v0.2.4` and publishes the draft release, as `DEVELOPING.md`
  "Release" describes. Verify that the Node badge of the README shows `>=22.12.0`.
- Archive the change after the review.
