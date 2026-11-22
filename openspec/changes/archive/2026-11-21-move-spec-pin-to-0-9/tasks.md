## 1. The pin

- [x] 1.1 Download `oscal-bindings-specs-0.9.0+oscal.1.2.3.tar.gz` and `SHA256SUMS` of release `v0.9.0+oscal.1.2.3`, and
      do steps 1 to 3 of [Verify a release]. Verify: each step passes, and the sha256 is
      `852c1d7d675cb1b4de39d7ac65b546fc79e38c42518520488546364f268a4832`, as #64 states.
- [x] 1.2 Set `SPEC_ARTIFACT_VERSION` and `SPEC_ARTIFACT_SHA256` in `scripts/spec-artifact.ts` and `version` in
      `spec-pin.json` to the new release. Change the pinned release in `DEVELOPING.md`. Run `npm run generate`.
      Verify: `npx tsx --test test/spec-pin.test.ts test/spec-artifact.test.ts test/generate.test.ts` and
      `npm run generate:check` pass, and the diff of `src/generated/` changes only the header line.
- [x] 1.3 Add the four cases of `scripts/check-canonical-json.ts` at the new tag to `test/canonical-json.test.ts`, and
      change the tag in the headers of that file and of `test/support/canonical-json.ts` (design D10). Verify:
      `npx tsx --test test/canonical-json.test.ts` passes, and its test names include the two cases of SER-004.02
      and the two cases of SER-004.03.

## 2. The runner and the adapter

- [x] 2.1 Add the map of operations that the binding does not offer to `test/support/runner.ts`. In
      `test/conformance.test.ts`, register each case of such an operation as a skipped test with its reason. In
      `test/runner.test.ts`, do not run these cases through the conforming fake adapter (design D3). Verify:
      `yaml-parse-typed/wrong-document-type` shows as skipped in the output of
      `npx tsx --test test/conformance.test.ts`.
- [x] 2.2 Add `parseYamlFile` to the `Adapter` interface and to the adapter, and add the `yaml-parse-file` rule to
      `runCase` (design D4). Change the conforming fake adapter as design D11 items 2.1 to 2.3 state, and add the
      changed answers of design D11 item 3.1. Verify: `yaml-parse-file/missing-file` passes, and the three changed
      answers of design D11 item 3.1 each make their case fail.
- [x] 2.3 Change the `expected-period` type and the `assessment-period` rule (design D5). Add the changed answer of
      design D11 item 3.2. Verify: `assessment-period/at-frequency-only` passes, and the test "each case passes with the
      conforming fake adapter" passes.
- [x] 2.4 Apply the input forms of `round-trip` and `yaml-round-trip` in `runCase` (design D6). Add the changed answers
      of design D11 items 3.3 and 3.4, and the input tests of design D11 item 4. Change the test of the `bytes` input
      form (design D11 item 1). Verify: `round-trip/catalog-bytes`, `round-trip/catalog-path`,
      `yaml-round-trip/catalog-bytes` and `yaml-round-trip/profile-path` pass, and
      `npx tsx --test test/runner.test.ts` passes.
- [x] 2.5 Add `expected-absent-keys` to the `Case` type, and add its rule to `yaml-round-trip` (design D7). Add the
      changed answer of design D11 item 3.5. Verify: `yaml-round-trip/minimal-catalog` passes, and
      `npx tsx --test test/runner.test.ts` passes.
- [x] 2.6 Add `inCategory` to the `Adapter` interface and to the adapter, and add the category tree rule to `reports`
      (design D8). Add `inCategory` to the conforming fake adapter (design D11 item 2.4), and add the changed answers
      of design D11 items 3.6 to 3.8. Verify: each case with `expected-category` that design D1 does not list and
      design D3 does not skip passes in `npx tsx --test test/conformance.test.ts`, the three changed answers each make
      their case fail, and `npx tsx --test test/runner.test.ts` passes.

## 3. The expected failures

- [x] 3.1 In `test/support/runner.ts`, export the parsed `expected-failures.json` and the filter of design D2, and use
      them in `test/conformance.test.ts`. Verify: `npm run typecheck` passes.
- [x] 3.2 Add each case of design D1 to `test/conformance/expected-failures.json`, with its owner as the reason.
      Verify: the file has 240 entries, each value is `#66`, `#67` or `#68`, and
      `npx tsx --test test/conformance.test.ts` passes.
- [x] 3.3 Apply the filter in `test/parse.test.ts`, `test/document.test.ts`, `test/serialize.test.ts` and
      `test/validators.test.ts` (design D2). Verify: `npm test` passes.

## 4. Documentation

- [x] 4.1 In `DEVELOPING.md`, change "How the binding is checked":
      1. Add the `yaml-parse-file` cases to the cases that pass.
      2. State that the runner skips `yaml-parse-typed`, and why.
      3. State that `expected-failures.json` lists each case that the binding does not pass yet, with its owner.

      Verify: `DEVELOPING.md` does not state that the list holds only cases of an operation that does not exist yet.

## 5. The release gate

- [x] 5.1 Add a step to the job `tag-check` of `.github/workflows/build.yml` that fails when
      `test/conformance/expected-failures.json` has an entry, and names the entries (design D9). State the rule in
      `DEVELOPING.md`, under "Release". Verify: the command of the step exits with 1 on a copy of the file with one
      entry, and with 0 on a copy that is `{}`. A `node -e` call with the `yaml` package shows that `build.yml` parses and
      that the step is under `jobs.tag-check.steps`. `DEVELOPING.md` states the rule.

## 6. Gate

- [x] 6.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #64.

[Verify a release]: https://github.com/cairn-proofs/oscal-bindings-specs#verify-a-release
