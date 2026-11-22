## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. Each parse operation except `isValid` runs `parseInput` in `src/parse.ts`: decode, depth limit, root key, schema
   check. `parse`, `parseFile`, `parseYaml`, `parseYamlFile` and the typed parsers all call it. `isValid` runs its own
   copy of the stages and calls the fail-fast schema check.
2. A `FailureEntry` has a `location`, which is a JSON Pointer from the root of the input, and a list `messages`.
   `toEntries` in `src/validators.ts` merges the schema errors of one location into one entry. `docs/limits.md` states
   that a `ParseError` has no limit on its entries.
3. The depth limit of 250 levels applies before the schema check, so a walk of the document recurses at most 250 times.
4. `constraints.json` of the pinned release has 319 entries: 194 `allowed-values`, 47 `is-unique`, 24 `matches`,
   22 `index-has-key`, 20 `index`, 7 `has-cardinality` and 5 `expect`. Its queries use only this syntax:
   1. The root `$`, a child name, an array index, `[*]`, and `..` before a child name.
   2. A filter with `&&`, `||`, `!`, parentheses, `==` against a string, existence tests of a relative query, and
      `match`.
5. `test/conformance/expected-failures.json` lists 236 cases for #66: each `parse/constraint/*` case,
   `parse/allowed-value-case`, `parse/nested-control-part-name` and `parse/nested-control-part-name-three-levels`.
   A case with a repeated `id` in `expected-constraints` exists, for example
   `parse/constraint/oscal-metadata-prop-name-values-metadata`.
6. The store evaluates the manifest in `scripts/constraints-manifest.ts` with the library `json-p3`. The store checks
   that evaluator against its reference evaluator ([CNS-022]).
7. The `Adapter` interface of `test/support/adapter.ts` has `failureCount(error)`. It has no function that gives the
   `id` values of constraint failures.

## Goals / Non-Goals

**Goals:**

1. `npm run check` passes with no #66 entry in `expected-failures.json`.
2. A parse of a document of 22 KiB or less stays below 1 ms.
3. A change of the manifest syntax cannot give a silent wrong result.

**Non-Goals:**

1. Element validation and the builders. #68 owns [CNS-018] and the element context queries.
2. A parse of a large document as fast as the schema check. The requested target was a parse of 35 ms for the 10 MiB
   catalog of SP 800-53, and the current parse takes 17 ms. The spike evaluator adds 55 ms to 65 ms when warm, and about
   100 ms on its first call. A fused single pass could come closer to the target, but it is a larger change with an
   unproven result. The decision is to ship the spike design and to leave the target for a later change.
3. Threads. They need an asynchronous parse, and they give no gain on small documents.

## Decisions

### D1: The manifest check runs after the schema check

`parseInput` runs the manifest check when the fail-fast schema check passes. `isValid` runs it at the same place. A
document that fails the schema never reaches the manifest check, so it gets no constraint entry ([PRS-015]).
The typed parsers get the check through `parseInput`, after the root key check, so a document of another type still
gives a `DocumentTypeMismatchError`.

**Why:** the corpus README says that an input that does not conform to the schema has no `expected-constraints`. The
manifest queries also assume the shape that the schema allows.

### D2: The evaluator compiles the RFC 9535 syntax that the manifest uses

`src/constraints.ts` compiles each query of the manifest once, on the first parse, into a list of segments. Each
segment holds its selectors and, for a filter, a function. The compiler supports the syntax of [Context](#context)
item 4. It throws for any other syntax, with the query in the message. `test/constraints.test.ts` compiles each
document, target, key and test query of the pinned manifest, so a new release that uses other syntax fails
`npm test` and not a user parse.

**Why:** the evaluator that the store uses runs each `..` query as a walk of the whole document. On the 10 MiB catalog
of SP 800-53 (184,882 nodes), it takes 3,626 ms, and the parse takes 17 ms. A document of 22 KiB takes 7.5 ms, against
38 µs for the schema check. [CNS-006] defines the meaning of each query, and the compiler keeps that meaning for the
queries that it accepts.

**Alternative:** `json-p3`, as the store does. It evaluates any RFC 9535 query. It adds a dependency, and the parse
would be about 200 times slower on every document.

**Evidence:** a spike evaluator and the store evaluator give the same failures (entry, location and key) in two
tests. The first test used 284 of 284 JSON documents of the corpus, with 752 failures. The second used the SP 800-53
catalog with injected faults, with 372 failures. The spike code is at `tmp/cns-spike/fast.ts`, which Git ignores, with its comparison scripts `cmp.ts` and `mut.ts`. The
implementation of `src/constraints.ts` starts from `fast.ts`. The comparison scripts are not part of the repo. The
implementation repeats the comparison once by hand, with a
checkout of the store at the release tag, before it removes the expected failures. The comparison is not a test of the
repo, because the spec artifact holds no store script.

### D3: One walk gives the nodes and an index of the keys

For each document, the evaluator walks the containers once. Each container gets a frame with its parent, its key, its
preorder number and the end of its subtree. The walk adds each container to a list for each key that a `..['key']`
segment of the manifest uses. A `..['key']` segment then needs two binary searches in the list of its key: the
containers inside the subtree of the start node. A frame gives its JSON Pointer by following its parents.

Two selections are the same node when they are the same container frame, or the same parent frame and key for a scalar
([CNS-024]). The evaluator does not build a Normalized Path.

**Why:** a walk per query is the cost that D2 removes. The walk takes about 6 ms on the 10 MiB catalog.

### D4: The rules of the entry kinds are those of the store

The evaluator follows [CNS-007] to [CNS-017] for a document:

1. A target query runs on a node of the document, and its selections are the target nodes ([CNS-007], [CNS-024]).
2. `allowed-values` ([CNS-008], [CNS-025]): each target node gets the set of the entries that select it. The node
   fails for each entry of the set with `allow-other` false, when no entry of the set lists the value. The comparison is
   exact, with no case folding.
3. `matches` ([CNS-010]): the value is a string that the pattern matches in full. The pattern is an I-Regexp. The
   evaluator translates `.` to `[^\n\r]`, and uses the flag `u`, as `regExpEngine` in `src/validators.ts` does.
4. `has-cardinality` ([CNS-011]), `is-unique` ([CNS-012], [CNS-013]), `index` ([CNS-014]), `index-has-key`
   ([CNS-015]) and `expect` ([CNS-016]) follow their requirements. An `index-has-key` entry whose `partial` is true
   gives no failure. The `index` entries run before the other entries.
5. A failure has the entry, the location and, for a key, the key. An entry gives at most one failure for one location
   and one key ([CNS-017]).

The evaluator also reads the entries that cannot fail. An `allowed-values` entry with `allow-other` true can list a
value that a closed entry does not list. The evaluator gives no failure for these entries.

The order of the failure entries in a parse error is the order of the evaluation. No requirement fixes it.

### D5: Allowed-values entries that differ in one filter share one pass

Many `allowed-values` entries have the same context nodes and the same target query, except for a filter on
`@['name']`. The evaluator groups them. For a group, it reads the children of each context node once. A lookup by name
finds the entries whose filter names the `name` of the child. The remaining test of the filter runs for these entries
only. An entry whose filter names no `name` runs for each child. The result for each entry is the result of
its own query.

**Why:** a catalog of SP 800-53 has 1,196 controls, and 194 entries select properties of controls. A pass for each
entry makes the cost grow with the number of entries.

### D6: One failure entry for each constraint failure

`FailureEntry` in `src/errors.ts` gets the optional field `constraint`, the `id` of the manifest entry. A constraint
failure gives one `FailureEntry` with `location` set to the JSON Pointer of the failing node, one message that names
the `id`, and `constraint`. The evaluator does not merge failures of one location, so several entries can have the same
location ([PRS-015]). The message of the `ParseError` states the number of constraint failures. A schema failure has no
`constraint`.

A failing entry has an `id`, because [CNS-021] requires one for each entry that can fail. The evaluator throws an
`Error` for a failure of an entry with no `id`, because that is a defect of the manifest and not of the input.

**Why:** the field is optional, so no existing reader of `failures` breaks.

### D7: The binding ships the manifest

`MEMBERS` in `scripts/spec-artifact.ts` adds `manifest/1.2.3/constraints.json` and `manifest/constraints.schema.json`.
`scripts/generate.ts` checks that the manifest conforms to its JSON Schema, that `format` is 1 and that
`oscal-release` is the release of the pin. It then writes the manifest to `src/generated/constraints.json`, as it does
for the schema, and `npm run generate:check` fails when the file differs. The generated file keeps the bytes of the
manifest.

**Why:** the sha256 of the archive covers the manifest. The checks of the generator find a manifest that the
evaluator cannot read before the tests do.

### D7a: An existing cache gets the new members

`ensureSpecArtifact` names its cache folder with the version and the first 12 characters of the sha256. A folder of the
pin that was built before this change has no manifest, and the check accepts it. The folder name also holds a short hash
of the list `MEMBERS`, so a change of the list gives a new folder, and a hit still makes no network call.

### D8: The conformance rule of `expected-constraints`

The `Adapter` interface adds `constraintIds(error: unknown): string[]` and `limitOf(error: unknown): string | undefined`.
`constraintIds` gives the `constraint` of each failure entry that has one. `limitOf` gives the `limit` of the error.
The `parse` rule of `runCase` adds one step. The operations `validate-element`, `build-hash` and `build-resource` also
have cases with `expected-constraints`. #68 adds their rules. When the case has `expected-constraints` and the parse error identifies no
limit, the sorted `constraintIds` of the error must equal the sorted list, with each repeat.

**Why:** the [corpus README] states the rule in these terms. No corpus case combines a limit with
`expected-constraints`, and the exception keeps the runner equal to the README.

### D9: Self-tests of the runner

`test/runner.test.ts` changes as follows:

1. The conforming fake adapter adds `constraintIds`, which gives the list of `expected-constraints` of its case, and
   `limitOf`, which gives `undefined`.
2. These changed answers each make their case fail:
   1. `parse/constraint/oscal-catalog-metadata-prop-name`: one `id` less.
   2. The same case: one `id` more.
   3. `parse/constraint/oscal-metadata-prop-name-values-metadata`: one of the two repeats of its `id` less.
   4. The same case with the same values in another order passes.
3. A parse error that identifies a limit passes with a list that differs.

### D10: The expected failures

The implementation removes the 236 entries of #66. `test/conformance/expected-failures.json` keeps the entries of
#67 and #68. The step of `tag-check` that stops a release while the list has an entry stays.

### D11: Tests of the binding

`test/yaml.test.ts` changes the test "YML-009.01 an alias is read at its own location". Its property has no `ns`, so
the manifest rejects the name `a`. The property gets `ns: https://example.com/ns`. The test still asserts that the alias
value 443 is read at its own location.

`test/constraints.test.ts` holds these tests:

1. Each document, target, key and test query of the manifest compiles.
2. The compiler throws, with the query in the message, for a slice, for `..[*]` and for a function other than `match`.
3. `parse`, `parseYaml` and a typed parser give a `ParseError` for the input of a constraint case. A failure entry has
   `constraint`, and two failures of one location give two entries.
4. A document that fails the schema and also holds a property that a manifest entry rejects gives no entry with
   `constraint` ([PRS-015.02]).
5. `isValid` returns false for the input of a constraint case, and true for a valid corpus document.

### D12: Documentation and numbers

1. `README.md` states that a parse also rejects a document that breaks an OSCAL constraint.
2. `docs/limits.md` keeps its statement that a `ParseError` has no limit on its entries. It replaces the statement
   "one entry for each failing location" with one entry for each failing schema location and one entry for each
   constraint failure. The comments of `FailureEntry`, `ParseError` and `BuilderError` in `src/errors.ts` change in the
   same way.
3. `DEVELOPING.md` names the manifest as an input of `npm run generate`.
   `docs/security.md`, in the section "Size and time", states that the manifest check adds a cost that grows with the
   size of a valid document, and links to `PERFORMANCE.md`.
4. `PERFORMANCE.md` has the numbers of a new run of `npm run bench`. Each parse of a valid document in it includes the
   manifest check.

The number for the 10 MiB catalog stays in this design. The catalog is not in the corpus, so `npm run bench` cannot
repeat it.

## Risks / Trade-offs

1. [The evaluator and the store evaluator can differ for a query that no corpus case covers] → The corpus holds a
   failing case for each reportable entry ([CNS-020]), and the store checks the manifest against its reference
   evaluator. The by-hand comparison of D2 runs before the expected failures go. The compiler throws for syntax that it
   does not know.
2. [A document of several megabytes takes about 70 ms more to parse] → The cost is the cost of evaluating the manifest.
   `PERFORMANCE.md` states it. A later change can fuse the evaluation into one pass.
3. [A document that parsed before gives a parse error] → The change is **BREAKING** and the release notes say so.
4. [`isValid` catches each error, so a defect of the evaluator can show as a false result] → The tests of D11 run the
   evaluator through `parse`, which does not catch it.

[corpus README]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/corpus/1.2.3/README.md#operation-list
[CNS-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-006-the-manifest-selects-nodes-with-rfc-9535-queries
[CNS-007]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-007-each-entry-selects-context-nodes-and-target-nodes
[CNS-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-008-an-allowed-values-entry-checks-the-value-against-its-applicable-set
[CNS-010]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-010-a-matches-entry-checks-the-full-value-against-its-pattern
[CNS-011]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-011-a-has-cardinality-entry-counts-the-target-nodes-of-each-context-node
[CNS-012]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-012-a-key-is-the-list-of-the-values-of-the-key-fields
[CNS-013]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-013-an-is-unique-entry-fails-for-target-nodes-with-the-same-key
[CNS-014]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-014-an-index-holds-the-keys-of-each-index-entry-with-the-same-name
[CNS-015]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-015-an-index-has-key-entry-fails-for-a-key-that-is-not-in-the-index
[CNS-016]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-016-an-expect-entry-fails-for-a-target-node-that-its-test-does-not-select
[CNS-017]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-017-a-document-meets-the-manifest-when-no-entry-fails-for-it
[CNS-018]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-018-an-element-meets-the-manifest-when-no-entry-that-it-can-decide-fails
[CNS-020]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-020-the-corpus-has-a-failing-case-for-each-reportable-entry
[CNS-021]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-021-an-entry-is-reportable-unless-it-cannot-fail
[CNS-022]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-022-the-store-checks-the-failures-of-the-manifest-against-the-reference-evaluator
[CNS-024]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-024-the-location-of-a-node-says-when-two-selections-are-the-same-node
[CNS-025]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/constraint-validation/spec.md#requirement-cns-025-an-allowed-values-entry-compares-values-character-for-character
[PRS-015]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-015-a-constraint-failure-is-a-parse-failure-that-names-its-constraint
[PRS-015.02]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/v0.9.0%2Boscal.1.2.3/openspec/specs/document-parsing/spec.md#requirement-prs-015-a-constraint-failure-is-a-parse-failure-that-names-its-constraint
