## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. `collect` in `src/validators.ts` builds the entries of a failure. It runs the collecting Ajv validator, and maps each
   Ajv error to a location by the rules of design D5 of the archived change `2026-11-10-add-parsing-and-error-model`.
   The parse pipeline and `validateElement` both call it.
2. Each nested union of the schema is an `anyOf` at a union site. The manifest records the sites of a union, and for
   each variant the distinguishing `property` and the variant type ([NAM-020]). The element-type registry
   `src/generated/element-types.ts` holds a pointer for each variant type, for example `ParameterWithSelect` at
   `#/definitions/oscal-complete-oscal-control-common:parameter/anyOf/1`. The registry holds no union table.
3. In the corpus case `parse/closed-enum-out-of-set`, the union is `Parameter`, with the variants `select` and `values`.
   The parameter object at `/catalog/params/0` holds `select`, so the parameter object selects `ParameterWithSelect`.
   The Ajv errors are:

   | Ajv `instancePath`                  | Ajv `schemaPath`                       | Source of the error  |
   | ----------------------------------- | -------------------------------------- | -------------------- |
   | `/catalog/params/0`                 | `#/anyOf/0/additionalProperties`       | the `values` branch  |
   | `/catalog/params/0/select/how-many` | `#/properties/how-many/allOf/1/enum`   | the `select` branch  |
   | `/catalog/params/0`                 | `#/anyOf`                              | the union            |

4. The Ajv `schemaPath` of an error starts again at each `$ref`. The `how-many` error above holds no trace of
   `anyOf/1`. 5 of the 13 union sites have no `$id`. Thus `schemaPath` cannot identify the branch of an error.
5. With the Ajv option `verbose: true`, each error holds `parentSchema` and `data`. For the `anyOf` error of a union
   site, `parentSchema` is the same object as the site node in the imported schema, and `data` is the object at the
   site.
6. `parseFile` maps `ENOENT` and `ENOTDIR` to `NotFoundError`, and throws each other error unchanged (design D7 of the
   archived change `2026-11-10-add-parsing-and-error-model`).

## Goals / Non-Goals

**Goals:**

1. A parse error carries the failures of the selected branch only, also for a union inside a selected branch.
2. One function owns the location rules of D5, so the two collect paths cannot differ in them.

**Non-Goals:**

1. A change to the entries of `validateElement`. [PRS-014] applies to a parse error. [ELV-001] requires the list of
   element validation to cover each failure, and no requirement of the store permits element validation to drop the
   failures of a branch.

## Decisions

### D1: The generator writes a union-site table

The generator adds the export `unionSites` to `src/generated/element-types.ts`. The table has one row for each site of
each `union` entry of the manifest. A row holds the site pointer, and for each variant the distinguishing property and
the canonical type name:

```ts
/** One row for each site of a nested union of the manifest (NAM-020). */
export interface UnionSite {
  /** The JSON pointer of the schema node that holds the `anyOf` of the union. */
  readonly pointer: string;
  /** The variants of the union, in manifest order. */
  readonly variants: readonly { readonly property: string; readonly typeName: string }[];
}
```

1. **Why:** the manifest is the source of the distinguishing property ([NAM-020]). Design D2 of the archived change
   `2026-11-09-add-runtime-validators-and-element-registry` makes the generator write each runtime input into
   `src/generated/`, so the runtime reads no file of the store. The generator already reads the variants of each union.
2. **Alternative:** find the distinguishing property of each branch from the schema at runtime. That repeats a fact of
   the manifest in a second place that can differ from it.

### D2: Find a union site by schema identity

The factory of design D3 of the archived change `2026-11-10-add-parsing-and-error-model` sets `verbose: true`. The
option applies to both Ajv instances, so `allErrors` stays the only option that differs. At load, `src/validators.ts`
resolves each pointer of `unionSites` in the imported schema, and keeps a map from the site node to its variants. An
Ajv error is the `anyOf` error of a union site when its keyword is `anyOf` and the map holds its `parentSchema`.

1. **Why:** Context items 4 and 5. Identity needs no pointer arithmetic, and it works for a site with no `$id`.
2. **Cost:** `verbose` adds the fields `schema`, `parentSchema`, and `data` to each Ajv error. A valid input makes no
   error, so the fail-fast check of a valid input does not change.
3. **Alternative:** match `schemaPath`. It fails for the reasons of Context item 4.

The `data` field of an error can hold the whole input, and a validate function keeps the errors of its last call. Thus
each caller of a validate function sets its `errors` to `null` after it reads them. `src/validators.ts` exports
`passes(validate, value)`. It runs the validate function, sets `errors` to `null`, and returns the result. The
fail-fast checks of `parse`, `isValid`, and `validateElement` call it. `collect` and `selectedErrors` set `errors` to
`null` after they read them. Thus no validate function holds an input after the operation returns.

### D3: `collectSelected` for a parse error

`src/validators.ts` splits `collect` into two steps, and adds a second public function:

1. `toEntries(errors)`: private. It maps Ajv errors to entries by the rules of D5. It is the only owner of these rules.
2. `collect(full, value)`: runs `full`, and returns `toEntries` of all its errors. `validateElement` continues to call
   it, so its entries do not change.
3. `collectSelected(full, value)`: runs `selectedErrors(full, value)`, and returns `toEntries` of the result. The parse
   pipeline calls it in place of `collect`.

`selectedErrors(full, value)` is private, and works on Ajv errors:

1. Run `full` on the value, read its errors, and set its `errors` to `null` (D2).
2. Make a map from location to selection. For each `anyOf` error of a union site (D2), count the variant properties
   that `data` holds. When `data` is an object that holds exactly one, the error selects the variant of that property,
   and the map gets the `instancePath` of the error as a key. Each other `anyOf` error selects no variant
   ([NAM-020.01]). When an outer union selects no branch, each of its branches can report the same site. The errors of
   that site have the same location and the same `data`, so the map holds one selection for them.
3. Read the errors one time, in order. The owner of an error is the selection at the shortest prefix of its
   `instancePath` that the map holds. A prefix ends at a segment boundary, and the full `instancePath` is a prefix.
   1. An error with no owner goes to the result.
   2. At the first error of an owner at `L`, the result gets the errors of
      `selectedErrors(validatorFor(variant), data)`, with `L` added in front of each `instancePath`.
   3. Each other error of an owner goes nowhere.
4. Return the result.

Step 3 reads each error one time, and examines at most one prefix for each segment of its location. Thus the work of
one call grows linearly with the count of errors. The call of step 3.2 is a call of the same function, so it also
selects the branch of a union inside the selected branch. That call validates the subtree of the selection again.
Thus the first run validates each node one time, and each selected union that holds a node validates it one more time.

1. **Why:** each error at or below `L` comes from the `anyOf` of the site. Apart from annotations, each site node holds
   only `type` and `anyOf`, and an object passes `type`. The variant validator gives exactly the failures of the
   selected branch. The prefix goes on `instancePath` before `toEntries`, so the `required` and `additionalProperties`
   rules of D5 apply once, in one place.
2. **Why step 3.2:** D5 keeps the order of the first Ajv error of each location. The errors of a selection go to the
   position of the first error that the selection replaces.
3. **Alternative:** a boolean option on `collect`. A named function states which requirement it meets, and a call site
   passes no flag.
4. **Alternative:** remove entries after `toEntries`. An entry holds no Ajv keyword and no schema node, so it
   cannot show which branch it came from.

### D4: `ReadError`

`src/errors.ts` adds the category `read-error` to `ErrorCategory`, and adds a class:

```ts
/** A file-path parse cannot read a path that exists (ERR-012). It is not a parse error and not a not-found error. */
export class ReadError extends OscalError {
  readonly path: string;

  constructor(path: string, options: { cause: unknown }) {
    super("read-error", `cannot read the file: ${path}`);
    this.path = path;
    this.cause = options.cause;
  }
}
```

`parseFile` continues to throw a `NotFoundError` for `ENOENT` and `ENOTDIR` (D7). Node throws a `TypeError` for an
argument that is not a path, for example a value that is not a string, or a string that holds a NUL character.
`parseFile` throws that `TypeError` unchanged. It throws a `ReadError` for each other error of the read. The message and
`path` name the path that the caller gave. `cause` holds the Node error, so a caller can read its `code`.

1. **Why a direct subclass of `OscalError`:** [ERR-012] states that a read error is not a parse error and not a
   not-found error. Under the `instanceof` test of [ERR-009], a subclass of `ParseError` or `NotFoundError` is both.
2. **Why each other error:** [ERR-012] gives each failure to read a path that exists the read-error category, and lists
   its causes as examples only.
3. **Why a `TypeError` passes unchanged:** a value that is not a path is an error of the caller. [ERR-006] and
   [ERR-012] apply to a path, and [ERR-001] gives no category to an argument error.

The header comment of `src/errors.ts` states that each failure of an operation is an `OscalError` with a category of
[ERR-001]. The exception for a file read error goes.

### D5: Tests

1. `test/validators.test.ts`, with the input of PRS-014.01 and of [NAM-020.01]:
   1. PRS-014.01: a catalog parameter that holds `select` with `how-many` set to `seven` gives one entry, at
      `/catalog/params/0/select/how-many`.
   2. A union in a selected branch: a group that holds `controls` and a parameter of Item 1 gives one entry, at
      `/catalog/groups/0/params/0/select/how-many`. Today it gives 5.
   3. A parameter that holds no distinguishing property and an unknown property `x` gives the 2 entries that it gives
      today.
   4. The parameter of Item 1 with `values` added holds both distinguishing properties. It gives the 4 entries that it
      gives today.
   5. NAM-020.01: a catalog group that holds only `title` parses.
   6. A group that holds only `title` and the parameter of Item 1 gives 2 entries. The entry at
      `/catalog/groups/0/params/0/select/how-many` holds one message. The other entry is at `/catalog/groups/0`.
   7. `validateElement("parameter", ...)` with the parameter of Item 1 gives the 3 entries that it gives today.
   8. After a failed parse, the `errors` of the fail-fast and the collecting validator of the document branch are
      `null`.
   9. A catalog with 4000 parameters of Item 1 gives 4000 entries. The test fails when `collectSelected` takes more than
      5 times as long as `collect` on the same input.
2. `test/parse.test.ts`:
   1. ERR-012.01 and ERR-012.03: `parseFile` of a directory throws a `ReadError` that names the path in `path` and in
      the message. The error is not a `ParseError` and not a `NotFoundError`. This test replaces the test that expects
      an error that is not an `OscalError`.
   2. ERR-012.02: `parseFile` of a file with mode `000` throws a `ReadError` that names the path. The corpus cannot hold
      this case.
   3. `parseFile` of a path that holds a NUL character throws a `TypeError` that is not an `OscalError`.
3. `test/security-notes.test.ts`: the test of the note "Error text" expects a `ReadError` for a directory, with the
   code `EISDIR` on `cause`.
4. The conformance runner runs `parse/closed-enum-out-of-set` and `parse-file/directory`. The runner already checks
   that the message of a `parse-file` error names the path.

## Risks / Trade-offs

1. [The root user can read a file with mode `000`, so the test of ERR-012.02 fails when the tests run as root.] → The
   test skips when `process.getuid?.()` is `0` or `undefined`.
2. [For an invalid input, D3 validates a subtree again for each selected union above a failure. The cost of the
   collection grows with the size of the input times the count of nested selected unions. Only `CatalogGroup` and
   `ProfileGroup` can hold themselves, so only a deep stack of groups makes a long chain. The depth limit permits about
   124 nested groups. A test with 1000 failing parameters under 100 nested groups took 1167 ms, and validation alone
   took 11 ms. A valid input does not get this cost.] → The binding accepts this cost. Ajv 8.20.0 gives no path through
   `$ref` on an error, so one validation cannot show the branch of an error (Context item 4). `README.md` states the
   cost in the security note "Size and time".

## Migration Plan

None. No consumer depends on this repo.

[ELV-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-001-validate-a-standalone-element-against-a-named-type
[ERR-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-001-error-situations-map-to-a-fixed-taxonomy
[ERR-009]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-009-error-categories-form-a-tree
[ERR-012]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/error-model/spec.md#requirement-err-012-a-path-that-cannot-be-read-is-a-read-error
[NAM-020]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-020-a-distinguishing-property-identifies-a-branch-only-when-an-object-holds-it
[NAM-020.01]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-020-a-distinguishing-property-identifies-a-branch-only-when-an-object-holds-it
[PRS-014]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-014-a-distinguishing-property-selects-the-nested-union-branch-of-parse-failures
