## 1. Dependencies and configuration

- [x] 1.1 Move `ajv` `8.20.0` from `devDependencies` to `dependencies`, and add `ajv-formats` `3.0.1` to `dependencies`
      in `package.json`, then run `npm install`. Verify: `npm ci` succeeds, and `npm ls ajv ajv-formats` lists both
      packages.
- [x] 1.2 Add `src/**/*.ts` to `include` in `tsconfig.json` (design D2). Verify:
      `npm run typecheck` passes and includes `src/generated/oscal.ts`.

## 2. Generator

- [x] 2.1 In `scripts/generate.ts`, compute the element-type name of each manifest type (design D4) and the pointer of
      each type (design D3). Add the failures for an enum site that does not end in `/anyOf/<n>` or `/allOf/<n>`, and
      for two types with the same element-type name. Add both failures to `test/generate.test.ts`. Verify: the test
      passes, and each failure message names the entry or each pair.
- [x] 2.2 Make the generator write `src/generated/oscal-complete-schema.json` and `src/generated/element-types.ts`, and
      make `npm run generate:check` compare each file with the generator output (design D2). Run `npm run generate`.
      Verify: `npm run generate:check` passes, the schema copy has the sha256 of the manifest, and a changed byte in
      either new file makes `npm run generate:check` fail.

## 3. Validator module

- [x] 3.1 Add `src/validators.ts` with `elementTypes` and `validatorFor`, with the Ajv options and the `ajv-formats`
      call of design D1 (design D5). Verify: `npm run typecheck`, `npm run types:check`, and `npm run global-names`
      pass.
- [x] 3.2 Add `test/validators.test.ts` with the five checks of design D6. Verify: `npm test` passes, and
      `validatorFor` throws for a name that is not in the manifest.

## 4. Gate

- [x] 4.1 Run `npm run check`. Verify: each step passes, and `test/conformance/expected-failures.json` and
      `openspec/traceability.json` are the same as on `main`.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #7.
