## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. Parsing keeps each datetime as the string of the document ([PRS-008]). The generated types give `Result.start` as
   `string`, `Result.end` as `string | undefined`, `TaskTimingOnDate.date` as `string`, and `TaskTimingDateRange.start`
   and `.end` as `string`. A `Task` holds `timing` and nested `tasks`, each optional.
2. The `OscalDoc` getters do not fail for a validly parsed document ([FAC-002]). The constructor does no schema
   validation. A caller that wraps a value directly must make sure that the value is valid.
3. Each error category of the binding has one subclass of `OscalError`, except `access-error`, which has none.
4. The JavaScript `Date` type keeps milliseconds only. The case `assessment-period/seventh-fraction-digit` needs seven
   fraction digits ([FAC-007.03]).
5. The `assessment-period` rule of `runCase` handles only `expected-category`. The `Case` type has no
   `expected-period`. The conforming fake adapter of `test/runner.test.ts` throws for each `assessment-period` case.
6. `normalizeDatetime` in `test/support/canonical-json.ts` gives the canonical form of a datetime that the corpus README
   requires for a bound.

## Goals / Non-Goals

**Goals:**

1. The four `assessment-period/*` corpus cases pass.

**Non-Goals:**

1. A datetime type in the public API. The bound stays the string of the document, so the caller chooses the type.

## Decisions

### D1: The accessor is a method that returns `AssessmentPeriod`

`src/document.ts` adds this type and method:

```ts
/** The bounds of an assessment period (FAC-004). Each bound is a datetime of the document, or `undefined`. */
export interface AssessmentPeriod {
  readonly start: string | undefined;
  readonly end: string | undefined;
}

/** FAC-004 to FAC-007. Throws an `AccessError` for a document type that is not listed in FAC-004. */
assessmentPeriod(): AssessmentPeriod;
```

**Why:** a getter of `OscalDoc` does not fail ([FAC-002]), and this accessor can fail. `undefined` is the empty bound,
as in the optional fields of the generated types. Both keys are always present, because [FAC-004] states that the
accessor returns a start and an end.

**Alternative:** a getter `assessmentPeriod`. A getter that throws breaks the rule of Context item 2 for the other
getters.

### D2: `AccessError`

`src/errors.ts` adds `AccessError extends OscalError`, with the category `access-error` and the field
`documentType: string`. The message names the root key, for example
`the assessment period is not defined for a catalog document`.

**Why:** Context item 3. The other errors also carry the value that caused them, for example `NotFoundError.path` and
`UnknownElementTypeError.elementType`.

### D3: The walk

The method collects the values in document order:

1. Assessment Plan: for each item of `tasks`, in array order, first the timing of the task, then each nested task by
   the same rule. An `on-date` gives its `date` as a start and as an end. A `within-date-range` gives its `start` as a
   start and its `end` as an end. An `at-frequency` gives nothing.
2. Assessment Results: for each item of `results`, in array order, its `start` as a start, and its `end`, when present,
   as an end.

The method keeps the first start. It replaces the start only with a strictly earlier start, and it replaces the end
only with a strictly later end. A bound with no value stays `undefined`.

**Why:** [FAC-007] gives the tie to the first value in document order, and an item comes before the items that it
holds. A strict comparison keeps the first value.

**Alternative:** collect all values, then sort. A stable sort also keeps document order, but it costs more and the
reader must know that the sort is stable.

The method does not check the form of each value. Context item 2 already puts that duty on a caller that wraps a value
that it did not parse.

### D4: The instant comparison

A private function `compareInstants(a, b)` in `src/document.ts` returns a negative number, zero, or a positive number.
It reads each value with a regular expression for date, time, optional fraction, and offset, and makes a key of two
parts:

1. The epoch second of the value in UTC. The function sets the date and time fields on a `Date` with
   `setUTCFullYear` and `setUTCHours`, then subtracts the offset. It does not use `Date.UTC`, because `Date.UTC` maps a
   year from 0 to 99 to a year from 1900 to 1999.
2. The fraction digits. The function adds zeros on the right of the shorter fraction, and compares the two strings.

The function compares the epoch seconds first, and the fractions only when the seconds are equal.

**Why:** Context item 4. The epoch second of a valid OSCAL datetime is a safe integer, and a fraction of equal length
compares correctly as a string.

**Alternative:** `BigInt` nanoseconds. [FAC-007] requires all fraction digits, and a nanosecond count keeps only nine.

### D5: The runner rule

The `Case` type adds `"expected-period"?: { start: string; end: string }`. The `Adapter` function `assessmentPeriod`
returns `{ start: string | undefined; end: string | undefined }`. The adapter connects it to
`new OscalDoc(document).assessmentPeriod()`.

The `assessment-period` rule of `runCase` parses the input, as now. Then:

1. With `expected-category`, the rule is as now.
2. With `expected-period`, the runner calls `adapter.assessmentPeriod`. For each bound, it checks that the value is a
   string, and that `normalizeDatetime` of the value equals the expected value.

`notImplemented` and `NotImplemented` stay in `test/support/adapter.ts` with no caller, for the next pin move that
adds an operation.

**Why:** the corpus README requires the normalization. The `corpus:check` script of the store accepts a case with
exactly one of the two fields. The scaffolding stays for the same reason as the empty `PENDING_OPERATIONS` set.

### D6: Tests

1. `test/document.test.ts` adds these tests. Each test wraps an Assessment Plan with the constructor:
   1. [FAC-005.01]: two tasks. The first task has an `on-date` and holds a nested task with a `within-date-range`. The
      second task has a `within-date-range`. The start comes from the nested task, and the end comes from the second
      task.
   2. [FAC-005.02]: two tasks with `at-frequency` timing. Both bounds are `undefined`.
   3. [FAC-005.03]: one task with an `on-date`. The start and the end are that `date`.
2. `test/runner.test.ts` changes the conforming fake adapter. `assessmentPeriod` throws for a case with
   `expected-category`, and returns `expected-period` for each other case. The existing changed answer
   "assessment-period: no error" returns `{ start: undefined, end: undefined }` in place of `{}`, because `{}` does
   not have the type of D5.
3. The list of changed answers of `test/runner.test.ts` adds these entries:
   1. For `assessment-period/mixed-offsets`: the start is `2026-03-01T23:00:00-05:00`.
   2. For `assessment-period/mixed-offsets`: the end is `2026-03-02T01:00:00Z`.
   3. For `assessment-period/mixed-offsets`: the start is `undefined`.
4. A test in `test/runner.test.ts` shows that the runner normalizes a bound. The fake adapter returns
   `2026-03-02T01:00:00+00:00` as the start of `assessment-period/mixed-offsets`, and the case passes.

**Why:** the corpus has no case for [FAC-005.01] to [FAC-005.03] (cairn-proofs/oscal-bindings-specs, change
`define-assessment-period-bounds`, Non-Goals 1). Items 3.1 and 3.2 show that the runner checks each bound. Item 3.3
shows that the runner does not accept an empty bound. Item 4 shows that the runner compares the canonical form, not
the text.

## Risks / Trade-offs

1. [A value with a form that the regular expression of D4 does not match] → For a parsed document, the schema check
   rejects the value first. For a value that the caller wraps directly, Context item 2 applies. The function throws a
   `TypeError` that names the value, so the fault is visible.

## Migration Plan

1. Implement the tasks on the feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.

[PRS-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-008-timezone-aware-datetimes-are-enforced-where-oscal-requires-them
[FAC-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-002-the-facade-reads-common-fields-without-type-branching
[FAC-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-004-the-assessment-period-accessor-is-restricted-to-assessment-plan-and-assessment-results
[FAC-005.01]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#scenario-fac-00501-assessment-plan-period-aggregates-task-timing
[FAC-005.02]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#scenario-fac-00502-no-calendar-dates-returns-empty-bounds
[FAC-005.03]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#scenario-fac-00503-on-date-is-both-start-and-end
[FAC-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#requirement-fac-007-the-bounds-of-the-assessment-period-are-datetime-values-ordered-by-instant
[FAC-007.03]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-facade/spec.md#scenario-fac-00703-the-seventh-fraction-digit-orders-the-bounds
