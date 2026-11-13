## 1. The element-types operation

- [x] 1.1 In `test/support/adapter.ts`, add `elementTypes` to `Adapter` and connect it to `supportedElementTypes`
      (design D1). In `test/runner.test.ts`, add `elementTypes` to the conforming fake adapter (design D3 item 1).
      Verify: `npm run typecheck` passes.
- [x] 1.2 In `test/support/runner.ts`, add the `element-types` rule to `runCase`, and remove `element-types` from
      `PENDING_OPERATIONS` and from its doc comment (design D2). In `test/runner.test.ts`, add the three changed answers
      of design D3 item 2. Remove `element-types/all` from `test/conformance/expected-failures.json`. Verify:
      `npm test` passes, the three new changed-answer tests pass, `element-types/all` runs as an unlisted case, and
      `grep -n element-types test/support/runner.ts` finds only the new rule.
- [x] 1.3 In the conformance runner item of `## Status` in `README.md`, add the `element-types` case to the cases that
      pass. Remove the case count from the item, so that it states that the runner runs each case of
      `corpus/1.2.3/cases.json`. Verify: the item names the `element-types` case, and has no case count.

## 2. Gate

- [x] 2.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #27.
