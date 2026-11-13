## 1. Dependency and schema check

- [x] 1.1 Add `yaml` 2.9.1 to `dependencies` in `package.json` with an exact version, and run `npm install`. Verify:
      `package-lock.json` holds `yaml` 2.9.1 with no dependencies of its own, and `npm ci --ignore-scripts` passes.
- [x] 1.2 In `scripts/generate.ts`, add the schema check of design D5, and run it before the generator writes a file.
      Add a test to `test/generate.test.ts` for each of the three conditions. Verify: `npm run generate:check` passes
      on the 1.2.3 schema, and each new test passes.
- [x] 1.3 In the security notes "Isolation and shared documents" and "Install the binding" of `README.md`, name `yaml`
      with `ajv` and `ajv-formats`. In `test/security-notes.test.ts`, change the test of "Install the binding" to
      expect the three runtime dependencies, and change its title. Verify: `npm test` passes, and each line of
      `README.md` that names `ajv-formats` as a dependency also names `yaml`.

## 2. YAML parse

- [x] 2.1 In `src/errors.ts`, add `alias-expansion` to `Limit`. In `src/parse.ts`, move the text decode of `decodeJson`
      and the file read of `parseFile` into functions of their own (design D1). Move `rootKeyOf` to
      `src/validators.ts` (design D4). Verify: `npm run typecheck` and `npm test` pass, and this task changes no test.
- [x] 2.2 In `src/validators.ts`, export `typeErrors(rootKey, value)` of design D4, and export the depth limit value
      for `src/yaml.ts`. Verify: `npm run typecheck` passes.
- [x] 2.3 Add `src/yaml.ts` with `yamlToJson(input)` of design D2 to D4. Verify: `npm run typecheck` passes.
- [x] 2.4 In `src/parse.ts`, add `parseYaml` and `parseYamlFile` of design D1, with doc comments that name their
      requirements. Connect `parseYaml` in `test/support/adapter.ts`. Remove each `yaml-parse` case from
      `test/conformance/expected-failures.json`. Verify: `npm test` passes, and each `yaml-parse` case runs and passes.
- [x] 2.5 Add `test/yaml.test.ts` with the parse tests of design D7 item 1, items 1 to 5 and 7 to 9. Verify: `npm test`
      passes, each new test name starts with its scenario identifier where it has one, and the test of item 4 fails
      when you remove the mapping of `RESOURCE_EXHAUSTION`.
- [x] 2.6 In `README.md`, document `alias-expansion` in `## Limits`, and state that the `nesting-depth` limit applies
      to `parseYaml` and `parseYamlFile`. Add `parseYaml` and `parseYamlFile` to `## Status`. Add the cost of design
      Risk 1 to the security note "Size and time", and add `parseYamlFile` to the security note "File paths". In the
      security note "Error text", state that the message of a YAML syntax error holds lines of the input. Add the
      new names to the exported names in `test/security-notes.test.ts`. Verify: `test/security-notes.test.ts` passes.
- [x] 2.7 Add `parseYaml` and `parseYamlFile` to `openspec/traceability.json`, each with the YML, PRS, and ERR
      requirements that it meets. `parseYamlFile` also names YML-006, ERR-006, and ERR-012. Verify:
      `test/traceability.test.ts` passes.

## 3. YAML serialize

- [x] 3.1 In `src/serialize.ts`, add `serializeYaml` of design D6, with a doc comment that names YML-008. Connect it in
      `test/support/adapter.ts`. Remove each `yaml-round-trip` case from `test/conformance/expected-failures.json`.
      Verify: `npm test` passes, and each `yaml-round-trip` case runs and passes.
- [x] 3.2 Add the round-trip test of design D7 item 1.6 to `test/yaml.test.ts`. Verify: `npm test` passes, and the test
      fails when `serializeYaml` writes strings with `stringify` of the `yaml` package.
- [x] 3.3 In `README.md`, add `serializeYaml` to `## Status`, and remove the YAML items from "What does not exist" and
      from the alpha note. Add `serializeYaml` to `openspec/traceability.json` with YML-008 and the SER requirements
      that YML-008 applies. Verify: `test/traceability.test.ts` and `test/security-notes.test.ts` pass.

## 4. Gate

- [x] 4.1 Run `npm run check`. Verify: each step passes, and `test/conformance/expected-failures.json` holds no
      `yaml-parse` or `yaml-round-trip` case.

## Workflow follow-up

- Archive this change on the feature branch, then merge the pull request. The pull request closes #13.
