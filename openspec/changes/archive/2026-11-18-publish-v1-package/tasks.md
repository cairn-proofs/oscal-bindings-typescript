## 1. The v1 entry point

- [x] 1.1 In `scripts/generate.ts`, add `src/generated/release.ts` with `OSCAL_RELEASE` to the list of generated files
      (design D3). Run `npm run generate`. Verify: `npm run generate:check` passes, and `src/generated/release.ts`
      holds `export const OSCAL_RELEASE = "1.2.3";`.
- [x] 1.2 In `src/document.ts`, export the type `OscalBody`. Add `src/v1/index.ts` with the statement forms of design
      D1. It exports the names of `openspec/traceability.json`, the names of design D2, and the generated model types.
      Verify: `npm run typecheck` passes.
- [x] 1.3 In `openspec/traceability.json`, add the entries of the table of design D2. In `test/traceability.test.ts`,
      add the four tests of design D4. Verify: `npm test` passes. A temporary extra export in `src/v1/index.ts` fails
      test 2 of design D4. A temporary move of `BuilderError` into an `export type { }` statement fails test 3. Each
      temporary change is then reverted.
- [x] 1.4 In `## Status` of `README.md`, add an item for the entry point `oscal-bindings/v1` and `OSCAL_RELEASE`. In the
      traceability item, state that a test compares the record with the exports of the entry point. Verify:
      `grep -n "oscal-bindings/v1" README.md` finds the item.

## 2. The package

- [x] 2.1 Add `tsconfig.build.json` and the `build` script, and add `dist/` to `.gitignore` (design D5). Verify:
      `npm run build` writes `dist/v1/index.js`, `dist/v1/index.d.ts`, and `dist/generated/oscal-complete-schema.json`,
      and `git status` does not show `dist/`.
- [x] 2.2 Change `package.json` as items 1 to 7 of design D5 state, and regenerate `package-lock.json` with
      `npm install --package-lock-only`. In `.github/CODEOWNERS`, add `/src/v1/` and `/tsconfig.build.json`. Verify:
      `npm ci` passes, and `npm ls ajv ajv-formats yaml` shows the same versions as before the change.
- [x] 2.3 Add `scripts/pack-check.ts` (design D6) and the `pack:check` script, and add `pack:check` to `check` (design
      D5 item 8). Verify: `npm run pack:check` passes. A temporary change of the `exports` path to
      `./dist/v1/missing.js` fails it, and the change is then reverted.
- [x] 2.4 Change `test/security-notes.test.ts` as design D8 states. In `README.md`, make changes 1 to 4 of design D8.
      Verify: `npm test` passes, including `test/security-notes.test.ts`, and `grep -n "npm install oscal-bindings"
      README.md` finds the `## Install` section.

## 3. The release workflow

- [x] 3.1 Add `.github/workflows/release.yml` (design D7). Verify: the file pins each action by commit, and sets
      `cache: false` on `jdx/mise-action`. The job has `environment: npm` and `id-token: write`, and it does not run
      `npm run check`. The tag check reads `GITHUB_REF_NAME` from the environment.
- [x] 3.2 In `README.md`, add `### Release` under `## Development` (design D8 change 5). Verify: the section names the
      `version` field and the `v<version>` tag.

## 4. Gate

- [x] 4.1 Run `npm run check`. Verify: each step passes, including `pack:check`.

## Workflow follow-up

- Archive this change on the feature branch, then merge the pull request. The pull request closes #14, and with it
  the last step of #4.
- The maintainer does the one-time npm and GitHub setup of design.md, Migration Plan, item 2.
