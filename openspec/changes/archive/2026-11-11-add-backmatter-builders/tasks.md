## 1. The builders

- [x] 1.1 Add `src/backmatter.ts` with `buildHash`, `buildRlink`, and `buildResource` (design D1), the pipeline (design
      D2), and the generated identifier (design D3). Widen the doc comment of `ParseError` in `src/errors.ts` to
      include an invalid element value (design D2). Verify: `npm run typecheck` passes.
- [x] 1.2 Add `test/backmatter.test.ts` with items 1 to 8 of design D4. Verify: `npm test` passes.

## 2. Traceability and documentation

- [x] 2.1 Add the three builder entries to `openspec/traceability.json` (design D5). Verify:
      `test/traceability.test.ts` passes.
- [x] 2.2 Update the `## Status` and `## Limits` sections of `README.md` (design D5). Verify: each section names
      `buildHash`, `buildRlink`, and `buildResource`.

## 3. Gate

- [x] 3.1 Run `npm run check`. Verify: each step passes, and `test/conformance/expected-failures.json` does not change.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #12.
2. When cairn-proofs/oscal-bindings-specs#45 adds corpus cases, a later change connects the builders in
   `test/support/adapter.ts`.
