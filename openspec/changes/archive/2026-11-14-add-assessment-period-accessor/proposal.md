## Why

This change closes #19. The document facade `OscalDoc` of #11 has no assessment-period accessor, so the binding does
not implement [FAC-004] to [FAC-006] and [ERR-007]. cairn-proofs/oscal-bindings-specs#43 blocked #19. The store
resolved it with [FAC-007], which states the form and the order of the bounds. Contract release `v0.8.0+oscal.1.2.3`
holds [FAC-007] and its corpus cases, and the binding already pins that release. So
`test/conformance/expected-failures.json` lists four `assessment-period/*` cases, and the adapter function
`assessmentPeriod` throws `NotImplemented`.

## What Changes

1. `OscalDoc` adds the method `assessmentPeriod()`. It returns the start and the end of [FAC-005] to [FAC-007] for an
   Assessment Plan or Assessment Results document. Each bound is the datetime text of the document, or `undefined`.
2. For each other document type, `assessmentPeriod()` throws the new error `AccessError`, with the access-error
   category ([FAC-004], [ERR-007]).
3. The conformance adapter connects `assessmentPeriod` to `OscalDoc`. The conformance runner reads `expected-period`
   with the rules of `corpus/1.2.3/README.md`.
4. `test/conformance/expected-failures.json` does not list the four `assessment-period/*` cases.
5. `test/document.test.ts` checks [FAC-005.01] to [FAC-005.03], which have no corpus case.
6. `openspec/traceability.json` and `README.md` name the accessor.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes the document-facade and error-model capabilities, and adds
no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed source files: `src/document.ts` and `src/errors.ts`.
2. Changed test files: `test/document.test.ts`, `test/runner.test.ts`, `test/support/adapter.ts`,
   `test/support/runner.ts`, and `test/conformance/expected-failures.json`.
3. Changed records: `openspec/traceability.json` and `README.md`.
4. New public names: the method `OscalDoc.assessmentPeriod`, the type `AssessmentPeriod`, and the class `AccessError`.
5. No new dependency. The spec pin does not move.

[FAC-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-004-the-assessment-period-accessor-is-restricted-to-assessment-plan-and-assessment-results
[FAC-005]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-005-the-assessment-period-of-an-assessment-plan-aggregates-task-timing
[FAC-005.01]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#scenario-fac-00501-assessment-plan-period-aggregates-task-timing
[FAC-005.03]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#scenario-fac-00503-on-date-is-both-start-and-end
[FAC-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-006-the-assessment-period-of-assessment-results-aggregates-result-dates
[FAC-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-007-the-bounds-of-the-assessment-period-are-datetime-values-ordered-by-instant
[ERR-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-007-a-type-restricted-accessor-on-an-unsupported-document-type-is-an-access-error
