## 1. Format check

- [x] 1.1 In `validateManifest` in `scripts/manifest.ts`, add three checks before the JSON Schema check. Each check
      returns its single failure at once:
      1. When the manifest is not a JSON object, the failure states that `names.json` is not a JSON object.
      2. When the manifest has no own `format` member, the failure states that `names.json` has no `format` member.
      3. When `SUPPORTED_FORMATS` does not include the `format` value, the failure is
         `format <value> is not supported`. `<value>` is the `JSON.stringify` form of the value.

      The `format` value is a `Json` value, so narrow it or cast it for the `includes` call. Remove the format check
      from step 2 of `validateManifest`. Verify: `npm run typecheck` passes, and the test "the released manifest is
      valid" passes.
- [x] 1.2 In `test/manifest.test.ts`, replace the test "NAM-003.05 an unknown format version is rejected" with these
      tests:
      1. "NAM-012.01, NAM-022.01": `format` 2 and the OSCAL release 1.2.4 give exactly one failure,
         `format 2 is not supported`. The release mismatch shows that the release check of [NAM-012] does not run.
      2. "NAM-022.02": `format` 2 and an unknown top-level member give exactly one failure, `format 2 is not supported`,
         and no failure that starts with `[json-schema]`.
      3. "NAM-021.01": a manifest with no `format` member gives the failure of task 1.1 item 2.
      4. "NAM-021.01": a JSON array and a JSON string each give the failure of task 1.1 item 1.

      A manifest without `format` or with an unknown member does not match the type `Manifest`. Cast it to
      `JsonObject`, as the test "NAM-004.01 an entry without a kind is invalid" casts its entry. Verify:
      `npm run typecheck` and `npm test` pass, and each test name starts with its scenario identifier.

## 2. Requirement citations

- [x] 2.1 In `scripts/manifest.ts`, change these comments:
      1. The header comment names the requirements that the validator applies: NAM-001 to NAM-004, NAM-009, NAM-012,
         NAM-013, NAM-021, and NAM-022.
      2. The comment of step 2 cites NAM-012 rule 2.
      3. The comment of step 4 cites NAM-001, NAM-003, and NAM-009.

      Verify: each NAM identifier in the file is a requirement of the pinned release, and `npm run typecheck` passes.
- [x] 2.2 In `test/manifest.test.ts`, rename these tests:
      1. "NAM-003 rule 5: another OSCAL release is rejected" to "NAM-012.02 another OSCAL release is rejected".
      2. "NAM-004.02 a schema file name with a path is invalid" to "NAM-013.01 a schema file name with a path is
         invalid".
      3. "NAM-001.03 an unresolvable pointer is invalid" to "NAM-009.02 an unresolvable pointer is invalid".
      4. "NAM-001 a __proto__ pointer does not resolve to an inherited member" to "NAM-009 a __proto__ pointer does not
         resolve to an inherited member".

      Verify: each NAM identifier in a test name is a requirement or a scenario of the pinned release, and `npm test`
      passes.

## 3. Gate

- [x] 3.1 Run `npm run check`. Verify: each step passes.

## Workflow follow-up

1. Archive this change on the feature branch, then merge the pull request. The pull request closes #26.
