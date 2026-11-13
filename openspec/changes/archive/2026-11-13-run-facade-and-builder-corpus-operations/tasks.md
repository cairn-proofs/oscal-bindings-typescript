## 1. The facade operation

- [x] 1.1 In `test/support/adapter.ts`, add `FacadeView`, `facade`, `facadeFromBytes`, and `facadeFromPath`, and
      connect them to `OscalDoc` (design D1). In `test/runner.test.ts`, add the three facade functions to the
      conforming fake adapter (design D6 item 1.1). Verify: `npm run typecheck` passes.
- [x] 1.2 In `test/support/runner.ts`, allow `path` for `input-form`, add the `facade` rule to `runCase`, and remove
      `facade` from `PENDING_OPERATIONS` and from its doc comment (design D2, D5). In `test/runner.test.ts`, add the
      changed answers of design D6 items 2.1 to 2.3, and the bytes test of design D6 item 3. Remove the nine
      `facade/*` entries from `test/conformance/expected-failures.json`. Verify: `npm test` passes, the nine new
      changed-answer tests and the bytes test pass, and each `facade/*` case runs as an unlisted case.
- [x] 1.3 In the conformance runner item of `## Status` in `README.md`, add the `facade` cases to the cases that pass.
      Verify: the item names the `facade` cases.

## 2. The builder operations

- [x] 2.1 In `test/support/adapter.ts`, add `buildHash` and `buildRlink`, and add `document-ids` to `buildResource`
      (design D1). In `test/runner.test.ts`, change the builder functions of the conforming fake adapter as design D6
      item 1.2 states. Verify: `npm run typecheck` passes.
- [x] 2.2 In `test/support/runner.ts`, add the `build-hash` and `build-rlink` rules, add `document-ids` and the
      `expected-element` comparison to the `build-resource` rule, and read the UUID pattern from the pinned schema
      (design D3, D4). Remove `pendingField`, empty `PENDING_OPERATIONS`, and make its doc comment name no operation
      (design D5). In `test/runner.test.ts`, remove the `!isPendingCase(c)` filter of "build-resource: wrong category"
      (design D5), and add the changed answers of design D6 items 2.4 to 2.9. Remove the nine
      `build-hash/*`, `build-rlink/*`, and `build-resource/*` entries from `test/conformance/expected-failures.json`.
      Verify: `npm test` passes, the seven new changed-answer tests pass, `expected-failures.json` lists only the four
      `assessment-period/*` cases, and `grep -n "#31" test/support/runner.ts` finds nothing.
- [x] 2.3 In the conformance runner item of `## Status` in `README.md`, state that the `build-hash`, `build-rlink`, and
      `build-resource` cases pass. Remove the sentence about the `build-resource` fields `expected-element` and
      `document-ids`, and state that `expected-failures.json` lists each case that needs an operation that does not
      exist yet. Verify: the item names the three builder operations, and does not name `expected-element` or
      `document-ids`.

## 3. Gate

- [x] 3.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #31.
