## 1. The grammars

- [x] 1.1 Add `src/datatypes.ts` with the functions `uri`, `uri-reference`, `email` and `date-time` (design D2), and add
      `test/datatypes.test.ts` with the tables of design D5 items 1 to 3. Verify: `npx tsx --test test/datatypes.test.ts`
      passes, and each row of the tables names the ABNF rule or the case that it tests.
- [x] 1.2 Add the timing test of design D5 item 6. Verify: the test passes, and it fails when a function is changed to
      use the nested quantifier `(a+)+` on a string of 1 MiB.

## 2. The validators

- [x] 2.1 In `src/validators.ts`, set `validateFormats: false`, remove `addFormats`, make the copy of the schema, add
      the `datatype-grammar` keyword and read the copy in `nodeAt`, `branchPointers` and `siteVariants` (design D1 and
      D3). Verify: `npm run typecheck` passes, and `npx tsx --test test/validators.test.ts test/validate-element.test.ts
      test/parse.test.ts` passes.
- [x] 2.2 Add the tests of design D5 items 4 and 5 to `test/validators.test.ts`. Verify: the test for item 4 fails when
      a name is removed from `src/datatypes.ts`, and the test for item 5 fails when `validateFormats` is set to `true`.
- [x] 2.3 Remove the entry `round-trip/email-forms` from `test/conformance/expected-failures.json`. Leave the three
      entries of #68. Verify: `npx tsx --test test/conformance.test.ts` passes, and the file holds exactly the entries
      `build-hash/wrong-length`, `build-resource/duplicate-rlink-href` and `element/hash-wrong-length`.

## 3. The dependency

- [x] 3.1 Remove `ajv-formats` from `package.json` and `package-lock.json`. Change `README.md` and `docs/security.md`
      to list `ajv` and `yaml`, and change "Three" and "three" to "Two" and "two" at lines 19 and 125 of `README.md`
      (design D4). In `test/security-notes.test.ts`, change the expected dependencies to `["ajv", "yaml"]` and the
      title to "two runtime dependencies". Verify: `git grep -n ajv-formats -- ':!openspec/changes'` finds no match,
      `npm ci` passes, and `npx tsx --test test/security-notes.test.ts` passes.
- [x] 3.2 In `openspec/traceability.json`, add PRS-016 to PRS-019 to the entries `parse`, `parseYaml`,
      `parseYamlFile`, `isValid` and `validateElement`. Add PRS-016 and PRS-017 to the entries `buildRlink` and
      `buildResource`, because their fields hold URI values and no email address or date-time value. Verify:
      `npx tsx --test test/traceability.test.ts` passes.

## 4. The checks

- [x] 4.1 Run `npm run bench` before task 2.1 and after task 3.1, on one machine. Verify: the median of each parse case
      of the second run is within 10% of the first run. If it is not, write the cause in `design.md` before you go on.
- [x] 4.2 Run `npm run check`. Verify: the command passes, and no entry of `test/conformance/expected-failures.json` names #67.
