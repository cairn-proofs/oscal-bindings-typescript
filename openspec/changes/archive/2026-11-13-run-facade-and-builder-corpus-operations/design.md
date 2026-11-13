## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `test/support/adapter.ts` is the only module of the harness that imports the binding. The `Adapter` interface has
   no function for the facade, for `buildHash`, or for `buildRlink`. Its `buildResource` function takes no
   `document-ids`.
2. `runCase` in `test/support/runner.ts` fails a case whose operation it does not know. `PENDING_OPERATIONS` holds
   `facade`, `build-hash`, and `build-rlink`. `pendingField` fails a `build-resource` case that has `expected-element`
   or `document-ids`. `isPendingCase` combines the two.
3. `test/runner.test.ts` runs each case that is not pending through a fake adapter that answers from the corpus data.
   Then it changes one answer of the fake adapter, and checks that the case fails.
4. `OscalDoc` has a constructor that wraps a parsed document, `fromJson` for text or bytes, and `fromFile` for a path.
   Its getters `wrapper`, `body`, and `metadata` return plain JSON values.
5. The `Case` type of the runner allows only `bytes` for `input-form`. A `facade` case also uses `path`.
6. The pinned schema is in the spec artifact at `schemas/1.2.3/oscal_complete_schema.json`, two levels above the
   corpus directory. Its `definitions.UUIDDatatype.pattern` is the UUID datatype.

## Goals / Non-Goals

**Goals:**

1. The harness runs the 18 cases with the rules of `corpus/1.2.3/README.md` for the `facade`, `build-hash`,
   `build-rlink`, and `build-resource` operations.

**Non-Goals:**

1. A change to `OscalDoc`, to the builders, or to their unit tests.

## Decisions

### D1: The adapter functions

The `Adapter` interface adds these types and functions:

```ts
/** FAC-002: the values that the facade reads. */
export interface FacadeView {
  wrapper: unknown;
  body: unknown;
  metadata: unknown;
  oscalVersion: string;
  uuid: string;
}

/** FAC-001: the facade of a parsed document. */
facade(document: unknown): FacadeView;
/** FAC-003: the facade of raw bytes. */
facadeFromBytes(input: Uint8Array): FacadeView;
/** FAC-003: the facade of a file path. */
facadeFromPath(path: string): FacadeView;
/** BMB-001: the hash builder. Returns the hash. */
buildHash(args: { value: string; algorithm?: string }): unknown;
/** BMB-002: the rlink builder. Returns the rlink. */
buildRlink(args: { href: string; "media-type"?: string; hashes?: unknown[] }): unknown;
```

`buildResource` adds the argument `"document-ids"?: unknown[]`.

The adapter connects the three facade functions to `new OscalDoc`, `OscalDoc.fromJson`, and `OscalDoc.fromFile`. Each
function reads the five getters, and returns them as a `FacadeView`. The adapter connects the builder functions to
`buildHash`, `buildRlink`, and `buildResource`. It gives each item of `hashes` and `document-ids` to the builder as it
is, with a type cast and no validation.

**Why:** the runner must not import the binding. A `FacadeView` carries the five values that the runner checks, and no
type of the binding. One function for each construction lets the runner choose the construction from `input-form`.

**Alternative:** one facade function with a form argument. It needs a union type for the input, and the adapter then
does the selection that the corpus README gives to the runner.

The builder functions take the `arguments` object of the case with the key names of the corpus. The adapter does each
rename, for example `identifier` to `uuid`.

### D2: The facade rule

`runCase` adds a case for the `facade` operation:

1. `input-form` is absent: parse the text input with `adapter.parse`, and give the result to `adapter.facade`.
2. `input-form` is `bytes`: give the raw bytes of the input to `adapter.facadeFromBytes`.
3. `input-form` is `path`: give the absolute input path to `adapter.facadeFromPath`.

With `expected`, the runner reads the expected wrapper `E` and its body `B`, which is the value of the
`document-type` key of `E`. Then it checks these five values of the view:

1. The canonical form of `wrapper` is the same bytes as the file at `expected`.
2. The canonical form of `body` is the canonical form of `B`.
3. The canonical form of `metadata` is the canonical form of `B.metadata`.
4. `oscalVersion` equals `B.metadata["oscal-version"]`.
5. `uuid` equals `B.uuid`.

The runner gets the JSON text of a value with `JSON.stringify`, and then uses `canonicalize`.

With `expected-category`, the rule is the rule of `parse-file`: the construction reports the category, and the error
message names the path.

The `Case` type allows `bytes` and `path` for `input-form`.

### D3: The builder rules

`runCase` adds a case for `build-hash` and for `build-rlink`. Each case gives `arguments` to the builder function.
With `expected-element`, the canonical form of the JSON of the result must be the same bytes as the canonical form of
`expected-element`. With `expected-category`, the builder must report the category.

The `build-resource` rule adds `document-ids` to the arguments, and adds the `expected-element` comparison. When the
arguments have no `key` and no `identifier`, the runner checks the generated `uuid` first:

1. The `uuid` of the result matches the UUID pattern of D4.
2. The runner removes `uuid` from a copy of the result.
3. The runner compares the copy with `expected-element`.

### D4: The UUID pattern comes from the pinned schema

The runner reads `definitions.UUIDDatatype.pattern` from `../../schemas/<release>/oscal_complete_schema.json`, relative
to the corpus directory. `<release>` is the name of the corpus directory, for example `1.2.3`.

**Why:** the corpus README states that the `uuid` matches the UUID datatype of the schema. The pinned schema is the
source of that datatype.

**Alternatives:**

1. A regular expression in the runner. It is a copy of the schema that can differ from it after a pin move.
2. `adapter.validateElement`. The binding then checks its own result, so a fault in the binding can hide a fault in the
   builder.

### D5: The pending scaffolding

`pendingField` is removed, because each `build-resource` field has a rule. `PENDING_OPERATIONS` becomes an empty set,
and its doc comment names no operation. `isPendingCase` tests only `PENDING_OPERATIONS`. In `test/runner.test.ts`, the
`!isPendingCase(c)` filter of the changed answer "build-resource: wrong category" is removed, because no
`build-resource` case is pending.

**Why:** the doc comment of `PENDING_OPERATIONS` states that a change removes an operation from the set when it adds the
rules of that operation. The set stays for the next pin move that adds an operation. While the set is empty, the test
"a pending case is one that runCase does not know yet" has no case to check.

### D6: Runner tests

In `test/runner.test.ts`:

1. The conforming fake adapter:
   1. Each facade function returns the view of the wrapper at `expected`. The `facadeFromPath` function throws a
      `FakeError` with a message that names the path when the case has `expected-category`.
   2. Each builder function checks that its arguments deep-equal the `arguments` of the case. It then throws the
      `expected-category`, or returns `{ uuid: expected-uuid }` for a case with `expected-uuid`, or returns
      `expected-element`. For a `build-resource` case with no `key` and no `identifier`, the result also has a `uuid`
      from `randomUUID`.
2. The list of changed answers adds these entries:
   1. For `facade/catalog`: a different `wrapper`, `body`, `metadata`, `oscalVersion`, or `uuid`. That is five
      entries.
   2. `facade` throws for `facade/catalog`. `facadeFromBytes` throws for `facade/profile`. `facadeFromPath` throws for
      `facade/component-definition`.
   3. For `facade/missing-file`: the error message does not name the path.
   4. For `build-hash/off-list-algorithm`: the algorithm of the result is `SHA-256`.
   5. For `build-hash/invalid-algorithm`: the builder does not throw.
   6. For `build-rlink/reference-only`: the result has a `media-type`.
   7. For `build-resource/generated-identifier`: the `uuid` is `not-a-uuid`. In a second entry, the `title` is
      different.
   8. For `build-resource/omitted-inputs`: the `uuid` is different.
   9. For `build-resource/invalid-document-id`: the builder throws only when `document-ids` is absent from its
      arguments.

3. A test records the argument that `facadeFromBytes` gets for `facade/profile`. The argument must be a `Uint8Array`
   with the bytes of the input file. The test "a case of the corpus has the bytes input form that the runner passes as
   bytes" does the same check for `parse` and `parseYaml`.

**Why:** item 1.2 shows for each builder case that the runner gives the arguments as the corpus states them. Item 2.2
shows that the runner chooses the construction from `input-form`. Item 3 shows that the runner gives raw bytes, not
text, to the bytes construction. `OscalDoc.fromJson` accepts both, so no other test finds that fault. Item 2.9 shows
that the runner gives `document-ids` to the builder.

## Risks / Trade-offs

1. [`JSON.stringify` of a facade value differs from the JSON that the binding writes] → `serialize` uses
   `JSON.stringify`, and the getters return parsed JSON values. The canonical form also removes each difference of key
   order and of white space.

## Migration Plan

1. Implement the tasks on the feature branch, and run `npm run check`.
2. Archive this change on the branch. The change has no spec deltas, so the archive only moves the change directory.
