## Context

See [proposal.md, Why](proposal.md#why). These facts about the inputs shape the approach:

1. The release `v0.2.0+oscal.1.2.3` of cairn-proofs/oscal-bindings-specs has two assets: the archive
   `oscal-bindings-specs-0.2.0+oscal.1.2.3.tar.gz` and `SHA256SUMS`. The sha256 of the archive is
   `3bc746e8a6182a612c2a8f397e0ee7a47b2d777108f93df81dcd139ee59b271e`. All files are under the top directory
   `oscal-bindings-specs-0.2.0+oscal.1.2.3/`.
2. The spike needs these files from the archive: `schemas/1.2.3/oscal_complete_schema.json`,
   `manifest/1.2.3/names.json`, `manifest/names.schema.json`, and the documents under `corpus/1.2.3/documents/`.
3. `names.json` has 244 entries: 177 `object`, 44 `enum` (20 closed, 24 open), 13 `union`, 8 `document`, 1
   `document-union`, and 1 `single-or-many`. Each union branch is also an `object` entry, at the pointer of its
   `anyOf` item.
4. A union is an `anyOf`, not a tagged union. In `catalog:group`, the branches do not require their distinguishing
   property (`groups` or `controls`), and each branch has `additionalProperties: false`. So an object with only `title`
   matches both branches, and an object with `groups` and `controls` matches no branch.
5. The store toolchain is Node 24.22.0 from mise, npm with `save-exact`, `ignore-scripts`, and `engine-strict`,
   TypeScript 7.0.2, tsx 4.23.15, and ajv 8.20.0. Its CI pins every action by commit and runs with `contents: read`.
6. The store validator `validateManifest` in `scripts/names-lib.ts` is not published as a package. A consumer in
   another repo has its own validator.
7. Two manifest names are globals in Node: `Map` and `Response`. All TypeScript and JavaScript reserved words are
   lowercase, and [NAM-003] requires an uppercase first letter, so no name is a reserved word.

## Goals / Non-Goals

**Goals:**

1. Answer each of the four questions of #1 with evidence from a run, not from inspection.
2. Prove that the generator needs no naming rule: each type name in the output is a name from `names.json`.
3. Find every gap: each place in the schema that a TypeScript type needs, and that the manifest does not cover.

**Non-Goals:**

1. Runtime parsing, runtime validation, and serialization. Types describe the wire format only.
2. Casing transforms. A property keeps its JSON key, for example `"media-type"`. The full binding decides on casing.
3. Pattern, format, length, and `minItems` constraints. A list is `T[]`, and a constrained string is `string`. Regex
   dialect translation and datetime handling belong to runtime validation.
4. An npm package, a release workflow, and repository settings.

## Decisions

### D1 — Fetch the artifact by URL and check the sha256 before extraction

`scripts/spec-artifact.ts` holds the version, the release URL, and the sha256, as `tests/support/spec_artifact.py`
does in oscal-bindings-python. The tag only names the release. The sha256 is the pin. The script downloads the archive
with `fetch`, checks the sha256 of the bytes, and only then extracts. It extracts only the named members, with the
system `tar` and an argument array. The cache is `.cache/spec-artifact/<version>-<sha256 prefix>/`, and a cache hit
makes no network call.

- **Why named members:** the spike needs a few files. A fixed member list removes path traversal and link members
  from the risk, and it adds no tar dependency.
- **Alternative considered:** a tar package from npm. Rejected: a new dependency for a task that `tar` does.

### D2 — The consumer validates the manifest itself, with no code from the store

`scripts/manifest.ts` applies these checks, in this order, and the generator calls it first:

1. The JSON Schema `manifest/names.schema.json` from the same archive, with ajv ([NAM-004]).
2. `format` is 1, and `oscal-release` is the release of the schema ([NAM-003]).
3. `schema.sha256` equals the sha256 of the schema bytes that the generator parses ([NAM-002]).
4. Names are unique. Each pointer occurs in one entry and resolves through own properties only. Each type reference
   names an entry ([NAM-001], [NAM-003]).
5. Each variant `property` is a property key of its branch, and each `body-field` is a property key of its wrapper.

On any failure, the script prints every failure and generates nothing.

- **Why not copy `names-lib.ts`:** the spike tests whether a second binding can consume the format from the spec text.
  A port of the store code tests the store code instead. If a check is hard to write from the spec text, that is a
  finding for the report.

### D3 — The generator walks the schema and looks up every place in the manifest

`scripts/generate.ts` writes `src/generated/oscal.ts`. It emits one declaration per entry. To type a place, it uses
this order:

1. If the pointer of the place is a site of an entry, use the name of that entry.
2. Else if the place is a `$ref`, type the target pointer with the same rules. The walk follows a `$ref` only to name
   it, so recursive types (`group`, `part`) cannot loop.
3. Else if the place is an array, type its `items` and append `[]`.
4. Else if the place is a scalar (a `type` of `string`, `number`, `integer`, or `boolean`, or a scalar definition),
   use the TypeScript primitive.
5. Else the place is a gap. The generator collects every gap and fails with the full list.

Each kind of entry becomes one declaration:

1. `object` and `document`: an `interface` with the properties of the first site. A property in `required` is
   mandatory. The other properties are optional.
2. `enum`: a union of string literals from the schema values. An open enum adds `(string & {})`, so editors still
   offer the values.
3. `union`: a type union of the variant types. Each variant interface also gets `"<other property>"?: never` for the
   distinguishing property of each other variant (D4).
4. `document-union`: a type union of the members. Each member gets `"<other body field>"?: never` the same way.
5. `single-or-many`: `Item | Item[]`.

The generator writes property keys and enum values with `JSON.stringify`, and names only after the validator accepted
them. It copies schema descriptions into JSDoc comments and replaces each `*/` in them. The output is byte-stable,
and the check gate fails when the committed file differs from a new run.

- **Why entries by pointer:** a lookup by pointer uses the manifest identity ([NAM-001]) as it is. The generator holds
  no naming rule, so a name that the generator cannot find in the manifest is a gap and not a guess.
- **Why commit the output:** reviewers see the names and the shapes in the pull request, as `v1/models.py` shows them
  in oscal-bindings-python.

### D4 — Unions exclude the properties of other branches with `never`

A TypeScript union of object types accepts an object with the properties of two branches, because the excess property
check applies to the union as a whole. The schema rejects that object (Context, item 4). Each variant gets an
optional `never` property for the distinguishing property of each other variant. TypeScript then rejects that object
too. An object with only shared properties stays valid, as the `anyOf` allows.

- **Consequence for the format:** the variant `property` is enough data for this. But [MDL-006] calls it a
  distinguishing property, and in `catalog:group` the property is optional. A reader can take it for a required tag.
  The report recommends a sentence in [NAM-002] that says a variant `property` is not required. That is a text fix,
  not a format change.
- **Alternative considered:** a discriminant field. OSCAL documents have none. Rejected.

### D5 — Type tests use the corpus documents as object literals

`scripts/type-fixtures.ts` writes one file per corpus document under `test/types/corpus/` (git-ignored):

1. A valid document becomes `export const doc = <json> satisfies <Wrapper>`. The wrapper comes from the manifest, as
   the `document` entry whose `body-field` is the top-level key of the document.
2. An invalid document whose failure is a shape failure becomes `export const doc = <json> satisfies OscalDocument`
   on one line, after a `// @ts-expect-error` line. A shape failure is an unknown field, a name-keyed field, a missing
   required field, or an unknown root. The candidates are `unknown-root`, `unknown-field-top`, `unknown-field-nested`,
   `name-keyed-field`, `missing-required-field`, and `two-failures`. The other invalid documents fail only at
   runtime (bad UTF-8, bad JSON, a bad UUID, a datetime without a timezone), and the spike skips them.

`test/types/negative.ts` holds hand-written `@ts-expect-error` cases: a `group` with `groups` and `controls`, a closed
enum with a value outside the enum, and a wrapper with two body fields. `tsc --noEmit` compiles all of them. An
unused `@ts-expect-error` is a compile error, so each negative case must fail to compile.

- **Why `satisfies` and not a JSON import:** a JSON import widens string literals to `string`, so no closed enum
  would accept it. An object literal keeps the literals and gets the excess property check.

### D6 — Name clashes: check them by compilation, and resolve them in the binding

The generated file is a module, so `export interface Map` shadows the global `Map` only in that module and in the
modules that import it. The generated file never refers to a global type. A consumer that needs both renames on
import: `import type { Map as OscalMap }`.

To list the clashes, `scripts/global-names.ts` writes a script file (not a module) with one `type T = <Name>;` line
per manifest name, and compiles it with `lib` set to `ES2023` and `DOM`. A name that compiles without an error is a
global. A second compile of the generated file with `DOM` in `lib` shows that the shadowing causes no error.

- **Why a compile probe:** it uses the lib files of the pinned TypeScript, so no hand-kept list of globals can drift.

### D7 — Toolchain and CI copy the store

`mise.toml` pins Node 24.22.0 and the OpenSpec CLI 1.13.0. `.npmrc` and the package versions copy the store
(Context, item 5). `npm run check` runs these steps in order:

1. A typecheck of `scripts/` and `test/`.
2. The validator and artifact tests.
3. The generator in check mode.
4. The type fixtures, then `tsc --noEmit` on the generated file and the type tests.
5. The global-names probe.
6. `openspec validate --all --strict`.

Tests use `node:test` through `tsx --test`, which adds no dependency. `.github/workflows/build.yml` copies the store build job: the same pinned actions, `contents: read`, no persisted
credentials, `timeout-minutes`, and `npm ci`.

## Risks / Trade-offs

1. [The TypeScript 7 package does not hold `lib.*.d.ts` files at a known path] → The probe in D6 uses only the
   compiler. It does not read lib files.
2. [The corpus covers few branches, so some union shapes stay untested] → The negative cases in D5 cover the union
   exclusion directly. The report lists which unions the corpus documents reach.
3. [A gap is real but rare, and the corpus does not reach it] → D3 does not depend on the corpus. The walk visits every
   property of every entry, so it finds each gap in the schema.
4. [The spike code becomes the binding code without review] → The full binding is a separate change. It can keep or
   replace the spike code.
5. [The download fails in CI] → The check fails. It does not skip, because a skipped check gives no answer.

## Migration Plan

1. Merge this change to `main` after the report is posted on #1.
2. If the report finds a format gap, the store change `define-names-manifest-format` gets an update and release
   `0.3.0+oscal.1.2.3`. This repo then moves its pin in a follow-up change.
3. If the report finds no gap, the store archives `define-names-manifest-format`.

**Rollback:** close the pull request. No other repo depends on this one.

[NAM-001]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-001-a-type-is-identified-by-json-pointers-into-the-complete-schema
[NAM-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-002-the-manifest-records-each-canonical-type-with-its-name-kind-and-kind-data
[NAM-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-003-canonical-names-are-unique-pascalcase-identifiers
[NAM-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/naming-manifest/spec.md#requirement-nam-004-the-store-publishes-a-json-schema-for-each-manifest-file
[MDL-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-006-union-branches-are-named-from-the-union-and-the-property-that-only-the-branch-has
