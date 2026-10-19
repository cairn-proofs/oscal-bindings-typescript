## 1. Toolchain

- [ ] 1.1 Add `mise.toml` (Node 24.22.0, OpenSpec CLI 1.13.0), `mise.lock` with its `.mise/locks/` sidecar, `.npmrc`,
      `package.json`, `tsconfig.json`, and `.gitignore` (`node_modules/`, `.cache/`, `tmp/`, `test/types/corpus/`),
      with the store versions (design.md D7). Verify that `mise install --locked` and `npm ci` succeed and that
      `npm ls` shows only exact versions.

## 2. Pinned artifact

- [ ] 2.1 Add `scripts/spec-artifact.ts` with the pin and `ensureSpecArtifact()` (design.md D1). Verify with
      `node:test` cases that a cache hit makes no network call, a sha256 mismatch extracts nothing and fails, and a
      fetch failure fails.
- [ ] 2.2 Fetch the real artifact once. Verify that the cache holds the schema, `names.json`, `names.schema.json`,
      and the corpus documents, and that the archive sha256 is
      `3bc746e8a6182a612c2a8f397e0ee7a47b2d777108f93df81dcd139ee59b271e`.

## 3. Manifest validator

- [ ] 3.1 Add `scripts/manifest.ts` with the checks of design.md D2. Verify that the real manifest passes. Also verify
      with `node:test` cases that a changed copy of the manifest fails for each of these changes:
      1. A name `Bad-Name`, a name with a final newline, and a duplicate name.
      2. A branch reference to no entry, and a variant `property` that is not a key of its branch.
      3. `format` 2, another `oscal-release`, and a wrong `schema.sha256`.
      4. A `schema.file` of `../schema.json`, an unresolvable pointer, and a `__proto__` pointer.

## 4. Type generator

- [ ] 4.1 Add `scripts/generate.ts` (design.md D3 and D4) and write `src/generated/oscal.ts`. Verify that the run
      reports zero gaps, that the output declares exactly the 244 manifest names and no other exported name, and that
      `tsc --noEmit` compiles it.
- [ ] 4.2 Add check mode. Verify that two runs give byte-identical output, and that a changed committed file fails
      the check.
- [ ] 4.3 Verify that a gap fails the run: on a copy of the manifest without the `TaskTimingOnDate` entry, the
      generator fails and names the pointer of that place.

## 5. Type tests

- [ ] 5.1 Add `scripts/type-fixtures.ts` and `test/types/negative.ts` (design.md D5). Verify that `tsc --noEmit`
      compiles every valid corpus document against its wrapper, that each shape-failure document and each negative
      case is a compile error, and that removing one `@ts-expect-error` line makes the compile fail.
- [ ] 5.2 Add `scripts/global-names.ts` (design.md D6). Verify that it lists `Map` and `Response` at least, and that
      the generated file compiles with `DOM` in `lib`.

## 6. Gate and CI

- [ ] 6.1 Add the `npm run check` script and `.github/workflows/build.yml` (design.md D7). Verify that
      `npm run check` passes locally from an empty `.cache/`, and that the CI run on pull request #2 passes.

## 7. Report

- [ ] 7.1 Write the answers to the four questions of #1 in `tmp/report.md`, with the evidence from tasks 2 to 5. The
      evidence is the gap count, the union exclusion of design.md D4, the global names of task 5.2, and the fetch and
      validation result. Verify that the user approved the text.
- [ ] 7.2 Post the approved report as a comment on #1. Verify that the comment is on the issue.
