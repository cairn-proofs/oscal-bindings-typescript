## Why

This change closes #27. Contract release `v0.8.0+oscal.1.2.3` adds scenario [ELV-002.01] and the corpus case
`element-types/all`. The binding moved its pin to that release in #38. The binding list of element-type names already
holds the 244 names of `expected/element-types.json`, in the same order. But the conformance runner does not know the
`element-types` operation, so `test/conformance/expected-failures.json` lists the case, and no test runs it.

## What Changes

1. The conformance adapter connects the `element-types` operation to `supportedElementTypes`.
2. The conformance runner runs the `element-types` operation. The list of the binding must equal the list in
   `expected`, item by item and in the same order.
3. `test/conformance/expected-failures.json` does not list `element-types/all`.
4. `test/runner.test.ts` shows that the runner fails the case when the list of the binding is different.
5. `README.md` names the `element-types` case in the list of conformance cases that pass. The same item states no case
   count. The count of 58 is wrong for the pinned corpus, which has 86 cases, and a count goes out of date at each pin
   move.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the element-validation capability, and adds no requirement of
its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `test/support/adapter.ts`, `test/support/runner.ts`, `test/runner.test.ts`,
   `test/conformance/expected-failures.json`, and `README.md`.
2. The binding code does not change. `openspec/traceability.json` already names ELV-002 for `supportedElementTypes`.
3. No new dependency.

[ELV-002.01]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#scenario-elv-00201-supported-types-are-listed
