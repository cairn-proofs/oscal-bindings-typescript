## 1. Shared stages

- [x] 1.1 In `src/validators.ts`, add the depth function of design D3 and `collect` of design D6, moved from
      `src/parse.ts`. Rename `DocumentValidators` to `Validators`, and add `elementValidators` (design D4). Change
      `src/parse.ts` to call the moved functions. Verify: `npm run typecheck` and `npm test` pass with no change to
      `test/parse.test.ts`.

## 2. Element validation

- [x] 2.1 In `src/errors.ts`, add `UnknownElementTypeError` (design D5). Verify: `npm run typecheck` passes.
- [x] 2.2 Add `src/validate-element.ts` with `ElementValidationResult`, `validateElement`, and `supportedElementTypes`
      (design D1, D2). Verify: `npm run typecheck` passes.
- [x] 2.3 Add `test/validate-element.test.ts` with items 1 to 4 of design D7. Verify: `npm test` passes.

## 3. Conformance, traceability, and documentation

- [x] 3.1 In `test/support/adapter.ts`, connect `validateElement` and return the `valid` property of its result.
      Remove the 8 `element/*` cases from `test/conformance/expected-failures.json`. Verify: `npm test` passes, and the
      list holds 24 entries.
- [x] 3.2 Add two entries to `openspec/traceability.json`: `validateElement` with ELV-001, ELV-003, ERR-008, PRS-007,
      and PRS-009, and `supportedElementTypes` with ELV-002. Verify: `test/traceability.test.ts` passes.
- [x] 3.3 Update `README.md` (design D8). Verify: the `## Status` section names element validation, names
      `UnknownElementTypeError` in the error model, and states that the `element/*` cases pass. The `## Limits` section
      names `validateElement` and describes the limit for a value as well as for an input.

## 4. Gate

- [x] 4.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #10.
2. When a pinned contract version defines the error category of an input over a documented limit
   (cairn-proofs/oscal-bindings-specs#42), move the depth limit
   of the parse operations and of `validateElement` to that category in one change.
