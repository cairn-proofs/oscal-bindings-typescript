## 1. Error model

- [x] 1.1 Add `src/errors.ts` with `ErrorCategory`, `OscalError`, `ParseError`, `DocumentTypeMismatchError`, and
      `NotFoundError`, and the entry type of design D5 (design D2). Verify: `npm run typecheck`, `npm run types:check`,
      and `npm run global-names` pass.

## 2. Validators

- [x] 2.1 In `src/validators.ts`, add the pattern engine of design D10. Add the three checks of design D9 for the
      engine to `test/validators.test.ts`. Verify: `npm test` passes.
- [x] 2.2 In `src/validators.ts`, add the factory that builds both Ajv instances with the pattern engine, keep
      `validatorFor` on the `allErrors: true` instance, and export `documentValidators(rootKey)` (design D3). Verify:
      `npm test` passes, the validators test checks that `documentValidators` returns a validator pair for each of the
      eight root keys, and the fail-fast validator of the catalog branch returns false for `parse/two-failures` with
      exactly one Ajv error.
- [x] 2.3 Add the `## Regex patterns` section to `README.md`, with the translations of design D10 and the deviation of
      `DecimalDatatype` (design D8). Verify: the section states the `u` flag, the three translations, and the
      deviation.

## 3. Parse pipeline

- [x] 3.1 Add `src/parse.ts` with the internal pipeline of design D1, the depth walk of design D4, the entry map of
      design D5, and the operations `parse`, the eight typed parsers, and `isValid` of design D6. Verify:
      `npm run typecheck` passes.
- [x] 3.2 Add `test/parse.test.ts` with checks 1 to 6 of design D9. Verify: `npm test` passes.
- [x] 3.3 Add the `## Limits` section to `README.md` (design D8). Verify: the section names the limit, what it
      measures, its value 250, each operation of design D4 including `isValid`, and the absence of an entry limit.

## 4. File parse

- [x] 4.1 Add `parseFile` to `src/parse.ts` (design D7), and add check 7 of design D9 to `test/parse.test.ts`. Verify:
      `npm test` passes.

## 5. Conformance and traceability

- [x] 5.1 In `test/support/adapter.ts`, connect `parse`, `parseTyped`, `parseFile`, `isValid`, `category`, and
      `failureCount` (design D2, D6). Remove the 14 cases of `parse`, `parse-typed`, and `parse-file` from
      `test/conformance/expected-failures.json`. Verify: `npm test` passes, and the list holds 44 entries.
- [x] 5.2 Add one entry to `openspec/traceability.json` for each operation of design D6, with these requirements:
      1. `parse`: PRS-001, PRS-004 to PRS-013, ERR-001, ERR-003, ERR-004.
      2. `parseFile`: PRS-002, ERR-006.
      3. Each typed parser: PRS-003, ERR-005.
      4. `isValid`: ERR-002.

      Verify: `test/traceability.test.ts` passes.
- [x] 5.3 Update the `## Status` section of `README.md`: parsing, the error model, and the conformance cases of parsing
      exist, and serialization does not (design D8). Verify: the section names no parse operation as missing.

## 6. Gate

- [x] 6.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #8.
