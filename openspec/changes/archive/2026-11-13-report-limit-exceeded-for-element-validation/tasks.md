## 1. Error model

- [x] 1.1 In `src/errors.ts`, add `limit-exceeded` to `ErrorCategory`, add the `Limit` type and the `limit` property of
      design D2, and add `LimitExceededError` of design D3. Change the third argument of the `ParseError` constructor to
      the options object of design D3, and change `DocumentTypeMismatchError` to pass its category in it. Verify:
      `npm run typecheck` and `npm test` pass.
- [x] 1.2 In `test/parse.test.ts`, rename the existing test of ERR-009.01 and add the ERR-009.02 test (design D6
      item 1). Verify: `npm test` passes, and each test name starts with its scenario identifier.
- [x] 1.3 Update the `## Status` item of the error model in `README.md` (design D7 item 1). Add ERR-009 to `parse` and
      to each typed parser in `openspec/traceability.json` (design D8). Verify: the item names `LimitExceededError`,
      `instanceof`, and the `limit` property, and `test/traceability.test.ts` passes.

## 2. Depth limit

- [x] 2.1 In `src/validators.ts`, replace `assertWithinDepthLimit` with the two exports of design D4. Change
      `src/parse.ts` to throw a `ParseError` with the limit `nesting-depth`, and `src/validate-element.ts` to throw a
      `LimitExceededError`. Update the doc comment of `validateElement`. Verify: `npm run typecheck` passes, and
      `grep -rn assertWithinDepthLimit src` finds nothing.
- [x] 2.2 Add the ERR-004.03 and ERR-010.02 tests of design D6 item 1, the ERR-011.01 and ERR-011.02 tests of design D6
      item 2, and the builder test of design D6 item 3. Change the existing depth tests to these expectations, so no
      test expects a `ParseError` from `validateElement`. Verify: `npm test` passes.
- [x] 2.3 Update the `## Limits` section of `README.md` (design D7 item 2). Verify: the section names the error and the
      limit `nesting-depth` for each operation, and `test/security-notes.test.ts` passes.
- [x] 2.4 Add ERR-010 to `parse`, and ELV-004, ERR-010, and ERR-011 to `validateElement` in
      `openspec/traceability.json` (design D8). Verify: `test/traceability.test.ts` passes.

## 3. Gate

- [x] 3.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #28.
