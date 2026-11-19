# Tasks

## 1. The API docs package

- [x] 1.1 Create `api-docs/package.json`, `api-docs/.npmrc` (a copy of the root file) and `api-docs/typedoc.json` per
  [design D4](design.md#d4-typedoc-runs-from-a-separate-package), install with `npm install --prefix api-docs`, and
  verify `api-docs/package-lock.json` records `typedoc` 0.28.20 and `typescript` 6.0.x and that `npm ls typescript` at
  the root still shows 7.0.2.
- [x] 1.2 Add `api-docs/site/` and `api-docs/node_modules/` to `.gitignore`. Add the `docs` script to the root
  `package.json`. Verify `npm run docs` in a clean clone (after `npm ci`) ends with 0 errors and 0 warnings and
  writes `api-docs/site/index.html`.
- [x] 1.3 Verify the site documents each export of `src/v1/index.ts` and links a generated type such as `Metadata` to
  its page. Verify `npm run check` is unchanged and still passes, and `npm run pack:check` still lists only
  `package.json`, `README.md` and `LICENSE`.
- [x] 1.4 Add `/api-docs/` to `.github/CODEOWNERS` in the group of files that can weaken the CI gate.

## 2. CI build and Pages deploy

- [ ] 2.1 Add the `npm run docs` step to `.github/workflows/build.yml` after `Check`. Verify with `actionlint` through
  mise (see the memory note on actionlint) and verify a pull request run shows the step green.
- [x] 2.2 Create `.github/workflows/docs.yml` per [design D7](design.md#d7-build-in-ci-deploy-on-release). Verify
  `actionlint` passes, each action is pinned by commit, and the permissions are exactly `contents: read`,
  `pages: write` and `id-token: write` on the deploy job.

## 3. Move the long sections

- [x] 3.1 Create `docs/limits.md` from "Limits" and "Regex patterns". Verify with a diff of the text that the moved
  text equals the text of the old README apart from the heading levels.
- [x] 3.2 Create `docs/security.md` from "Security notes for consumers" per
  [design D3](design.md#d3-the-security-notes-and-their-test). Update `test/security-notes.test.ts` to read it, and
  update its header comment. Add `/docs/security.md` to the CODEOWNERS group of the security notes. Verify
  `npm run test` passes and that renaming one note heading in `docs/security.md` makes the test fail.
- [x] 3.3 Create `DEVELOPING.md` from "Development", "How the binding is checked" and "Release". Add the `npm run docs`
  command and the Pages deploy to it. Verify each command in the file runs as written, or is named in `package.json`.
- [x] 3.4 Create `PERFORMANCE.md` from "Benchmarks". Verify `npm run bench -- --quick` runs as the file describes.

## 4. The new README

- [x] 4.1 Write the README in the layout of [design D1](design.md#d1-the-readme-layout-and-where-each-section-goes)
  with absolute links. Write the quick start by running its code with `tsx` and copying the real output. Verify the
  README is 150 lines or fewer and has no relative link, with `grep` for `](` followed by a path that does not start
  with `http` or `#`.
- [x] 4.2 Verify each link target of the README exists on `main` after merge. Before merge, verify each file named in a
  link exists in the working tree. Verify `npm run pack:check` passes.
- [x] 4.3 Survey the TypeScript OSCAL libraries per [design D6](design.md#d6-other-libraries-section) and write the
  "Other TypeScript OSCAL libraries" section. For each library, verify each claim against its README or its types and
  record the version that you read.

## 5. Integration

- [x] 5.1 Run `npm run check` and `npm run docs` from a clean clone and verify both pass.
- [x] 5.2 Verify the claims of the README that name behavior (`isValid` never throws, the entry point, the Node
  version) against `src/` and `package.json`.

## Workflow follow-up

- A maintainer enables GitHub Pages with the source "GitHub Actions", approves the `github-pages` environment, and
  runs the `docs` workflow with the tag `v0.2.0`. Then verify <https://cairn-proofs.github.io/oscal-bindings-typescript/>
  loads and the README link resolves.
- Archive the change after the project's review requirements are satisfied.
