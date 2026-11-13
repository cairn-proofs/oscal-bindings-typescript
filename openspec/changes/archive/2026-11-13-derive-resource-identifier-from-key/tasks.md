## 1. Builder error

- [x] 1.1 In `src/errors.ts`, add `builder-error` to `ErrorCategory` and add `BuilderError` (design D1). Remove the
      builders from the doc comment of `ParseError`. Verify: `npm run typecheck` passes.
- [x] 1.2 Update the "Error text" note and the "Size and time" note of `## Security notes for consumers` in
      `README.md` (design D7 item 2). Verify: each note names `BuilderError`.
- [x] 1.3 In `src/backmatter.ts`, change `validated` to throw a `BuilderError` (design D4). In
      `test/backmatter.test.ts`, change the BMB-001.03 and BMB-003.03 tests, and add the ERR-013.01 test (design D6
      item 1). In `test/security-notes.test.ts`, change the builder test (design D6 item 3). Verify: `npm test`
      passes, the depth test still expects a `LimitExceededError`, and
      `grep -n ParseError src/backmatter.ts test/backmatter.test.ts` finds no expectation of a `ParseError` from a
      builder.
- [x] 1.4 Update the builder item and the error-model item of `## Status` in `README.md` (design D7 items 1.1 and 1.2).
      Add ERR-013 to `buildHash`, `buildRlink`, and `buildResource` in `openspec/traceability.json` (design D7 item 3).
      Verify: the items name `BuilderError` and state that it is not a `ParseError`, and `test/traceability.test.ts`
      passes.

## 2. Key

- [x] 2.1 In `src/backmatter.ts`, add `key` to `ResourceOptions`, apply the steps of design D2 in `buildResource`, and
      add the UUID version 5 function of design D3. Update the module doc comment and the doc comment of
      `buildResource`. Add the ERR-013.02 test (design D6 item 1.3). Verify: `npm run typecheck` and `npm test` pass,
      and `src/backmatter.ts` has the namespace `3942257f-e1cf-5e06-9c6f-eeb97ecabe77` as one constant.
- [x] 2.2 Add the key and the two key errors to the builder item of `## Status` in `README.md` (design D7 item 1.1). Add
      BMB-004 to `buildResource` in `openspec/traceability.json` (design D7 item 3). Verify: the item names `key`, and
      `test/traceability.test.ts` passes.

## 3. Runner

- [x] 3.1 In `test/support/adapter.ts`, add `buildResource` to `Adapter` and connect it. In `test/support/runner.ts`,
      add the fields of design D5 item 1 to `Case`. In
      `test/runner.test.ts`, add `buildResource` to the conforming fake adapter (design D6 item 2.2). Verify:
      `npm run typecheck` passes.
- [x] 3.2 In `test/support/runner.ts`, add the `build-resource` rule and `isPendingCase`, and remove `build-resource`
      from `PENDING_OPERATIONS` and its doc comment (design D5 items 2 to 6). In `test/runner.test.ts`, use
      `isPendingCase` and add the three changed answers (design D6 items 2.1 and 2.3). Remove the five `(#30)` entries
      from `test/conformance/expected-failures.json`. Verify: `npm test` passes, the five cases of #30 run as unlisted
      cases, and the three other `build-resource` cases stay listed with `(#31)`.
- [x] 3.3 Add the `build-resource` cases that pass to the conformance-runner item of `## Status` in `README.md`
      (design D7 item 1.3). Verify: the item names the `build-resource` cases of a key.

## 4. Gate

- [x] 4.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #30.
