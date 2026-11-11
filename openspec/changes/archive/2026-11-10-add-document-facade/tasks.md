## 1. The facade

- [x] 1.1 Add `src/document.ts` with the `OscalDoc` class (design D1), the check of the constructor (design D2), and the
      builders (design D3). Verify: `npm run typecheck` passes.
- [x] 1.2 Add `test/document.test.ts` with items 1 to 4 of design D4. Verify: `npm test` passes.

## 2. Traceability and documentation

- [x] 2.1 Add the `OscalDoc` entry to `openspec/traceability.json` (design D5). Verify: `test/traceability.test.ts`
      passes.
- [x] 2.2 Update the `## Status` section of `README.md` (design D5). Verify: the section names `OscalDoc`, `fromJson`,
      and `fromFile`.

## 3. Gate

- [x] 3.1 Run `npm run check`. Verify: each step passes, and `test/conformance/expected-failures.json` does not change.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #11.
2. #19 adds the assessment-period accessor to `OscalDoc` after cairn-proofs/oscal-bindings-specs#43 is resolved.
