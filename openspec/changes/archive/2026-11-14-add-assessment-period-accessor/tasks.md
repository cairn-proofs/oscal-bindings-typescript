## 1. The accessor

- [x] 1.1 In `src/errors.ts`, add `AccessError` (design D2). In `src/document.ts`, add `AssessmentPeriod`,
      `compareInstants`, and `OscalDoc.assessmentPeriod()` (design D1, D3, D4). Verify: `npm run typecheck` passes.
- [x] 1.2 In `test/document.test.ts`, add the three tests of design D6 item 1. Verify: `npm test` passes, and the three
      new tests pass.
- [x] 1.3 In `openspec/traceability.json`, add `FAC-004`, `FAC-005`, `FAC-006`, `FAC-007`, and `ERR-007` to the
      `OscalDoc` entry. In the document facade item of `README.md`, state that `assessmentPeriod()` returns the start
      and the end of an Assessment Plan or Assessment Results document, and throws an `AccessError` for each other
      type. In the error-model item of `README.md`, add `AccessError` to the list of error classes. Verify: `npm test`
      passes, including `test/traceability.test.ts`, and `grep -n "AccessError" README.md` finds both items.

## 2. The conformance operation

- [x] 2.1 In `test/support/runner.ts`, add `expected-period` to `Case` (design D5). In `test/support/adapter.ts`,
      change the return type of `assessmentPeriod`, and connect it to `OscalDoc.assessmentPeriod()` (design D5). In
      `test/runner.test.ts`, change `assessmentPeriod` of the conforming fake adapter and the changed answer
      "assessment-period: no error" as design D6 item 2 states. Verify: `npm run typecheck` passes.
- [x] 2.2 In `test/support/runner.ts`, add the `expected-period` rule to the `assessment-period` case of `runCase`
      (design D5). In `test/runner.test.ts`, add the changed answers of design D6 item 3 and the normalization test of
      design D6 item 4. Remove the four `assessment-period/*` entries from `test/conformance/expected-failures.json`. Verify: `npm test` passes, the four new runner tests pass, each
      `assessment-period/*` case runs as an unlisted case, and `expected-failures.json` lists no case.
- [x] 2.3 In the conformance runner item of `## Status` in `README.md`, add the `assessment-period` cases to the cases
      that pass. Under "What does not exist", remove the `assessment-period` item. Verify: the conformance runner item
      names the `assessment-period` cases, and `grep -n "assessment-period" README.md` finds no line under "What does
      not exist".

## 3. Gate

- [x] 3.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

- Archive this change on the feature branch, then merge the pull request. The pull request closes #19.
