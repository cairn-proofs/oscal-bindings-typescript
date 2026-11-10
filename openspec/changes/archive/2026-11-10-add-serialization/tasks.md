## 1. Serialize operation

- [x] 1.1 Add `src/serialize.ts` with `SerializeOptions` and `serialize` (design D1). The doc comment of `serialize`
      states that the output has no null for a document that matches the types (design D2). Verify:
      `npm run typecheck`, `npm run types:check`, and `npm run global-names` pass.
- [x] 1.2 Add `test/serialize.test.ts` with items 1 to 3 of design D3. Verify: `npm test` passes.

## 2. Conformance, traceability, and documentation

- [x] 2.1 In `test/support/adapter.ts`, connect `serialize`. Remove the 12 `round-trip` cases from
      `test/conformance/expected-failures.json`. Verify: `npm test` passes, and the list holds 32 entries.
- [x] 2.2 Add one entry to `openspec/traceability.json` for `serialize`, with the requirements SER-001 to SER-005.
      Verify: `test/traceability.test.ts` passes.
- [x] 2.3 Update the `## Status` section of `README.md` (design D4). Verify: the section names serialization as an
      operation that exists, does not list it as missing, and states that the `round-trip` cases pass.

## 3. Gate

- [x] 3.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #9.
