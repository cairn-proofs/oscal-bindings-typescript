## Context

See [proposal.md, Why](proposal.md#why). These facts shape the approach:

1. The parse pipeline in `src/parse.ts` takes JSON text or bytes. It decodes the input, finds the root key, applies the
   depth limit, runs the fail-fast validator, and then collects the entries with `collectSelected` ([PRS-014]).
   [YML-005] defines the result of a YAML parse as the result of the JSON parse for the JSON text of the input.
2. The store has a reference YAML reader, `scripts/yaml-reader.ts`. Its design is D4 of the store change
   `2026-11-01-define-yaml-documents`. The reader uses the `yaml` package 2.9.1. It builds a tree of scalar text, then
   converts the text at each Ajv `type` error by the JSON grammar of the type, and repeats until no conversion occurs.
   At start, it checks that no `type` keyword names two types and that no union permits a string and another scalar
   type. The store's corpus check uses this reader on each YAML case. The contract does not require this method.
3. The reference reader stops at the first scalar that does not match its grammar. [PRS-006] requires an entry for each
   failure of the document.
4. The `yaml` package composes collections by recursion. The depth at which the JavaScript stack overflows changes
   with the form of the input, the JIT state, and the stack depth of the caller. In tests on Node 26.13.0, a flow
   sequence overflowed between 940 and 2,000 levels, and a flow sequence 3,000 levels deep or more always overflowed.
   `compose-node.js` catches each error of collection composition and adds a document error with the code
   `RESOURCE_EXHAUSTION` and the original message. It does not throw. For a stack overflow, the message starts with
   `Maximum call stack size exceeded`.
5. The `maxAliasCount` option of the `yaml` package applies only to `toJS`. `Alias.resolve` walks the whole document
   on each call, so a reader that calls it once for each alias takes time that grows with the count of aliases times
   the count of nodes. In a test, 4,000 aliases took 1.3 seconds, and 2,000 aliases took 0.3 seconds.
6. A key `__proto__` in a plain JavaScript object sets the prototype and makes no own property. The reference reader
   builds plain objects, so it drops a `__proto__` key with no error.
7. [PRS-010] permits a binding to apply resource limits and sets no value. A binding must not reject an input for a
   limit that it does not document. `Limit` in `src/errors.ts` has one value, `nesting-depth`, and the README section
   "Limits" documents it.
8. In the vendored OSCAL 1.2.3 schema, no `type` keyword names two types. No union permits a string and another scalar
   type. Each property that two branches of one union both define has the same schema in each branch (66 properties).

## Goals / Non-Goals

**Goals:**

1. One pipeline: a YAML parse makes JSON text, and the JSON pipeline makes the result and each error.
2. A YAML input cannot make the binding expand aliases without a limit, or overflow the stack without a documented
   limit.

**Non-Goals:**

1. A YAML form of `isValid` or of `OscalDoc.fromJson` and `OscalDoc.fromFile`. No requirement of the contract defines
   one.
2. A limit on the bytes of a YAML input. The binding has no byte limit for JSON input.
3. YAML cases in `npm run bench`.

## Decisions

### D1: The YAML reader makes JSON text, and the JSON pipeline does the rest

A new module `src/yaml.ts` exports one function, `yamlToJson(input)`. It decodes the input, reads it as D2 to D4
define, and returns the JSON text of [YML-005]. `src/parse.ts` adds two operations:

1. `parseYaml(input)`: the parse pipeline of the JSON text that `yamlToJson(input)` returns.
2. `parseYamlFile(path)`: reads the bytes of the path with the file read of `parseFile`, then calls `parseYaml`
   ([YML-006]). The read code moves into one private function that both operations call, so `NotFoundError`,
   `ReadError`, and the `TypeError` pass-through of design D4 of the archived change
   `2026-11-13-select-union-branch-and-report-read-errors` apply to both.

`src/yaml.ts` and `parseYaml` share the text decode of the JSON pipeline. The decode code moves out of `decodeJson`
into one function, so a value that is not text or bytes and bytes that are not valid UTF-8 give the same `ParseError`
for JSON and YAML input.

1. **Why:** [YML-005] defines the result through the JSON parse. One pipeline gives each YAML parse the root-key rules
   of [PRS-013], the selection of [PRS-014], the entries of [PRS-006], and the depth limit, with no second copy of the
   rules.
2. **Alternative:** convert the YAML to a JavaScript value and run the validators on that value. That needs a second
   entry to the pipeline, and it loses the number text that [YML-005] requires in the JSON text.

### D2: Parse with the `yaml` package, failsafe schema

`yamlToJson` calls `parseAllDocuments` of `yaml` 2.9.1 with the `failsafe` schema, `resolveKnownTags: false`, and
`uniqueKeys: false`. Each scalar then keeps its text, and a tag does not change a node ([YML-009]). D3 compares keys by
text, so the package does not check unique keys. A warning, for example an unresolved tag, is not an error.

The input gives a `ParseError` with no entries in these cases ([YML-002]):

1. A document holds an error. When an error has the code `RESOURCE_EXHAUSTION` and a message that starts with
   `Maximum call stack size exceeded`, the `ParseError` has the limit `nesting-depth` (Context item 4). Each other
   error is a syntax error.
2. The stream holds no document, or more than one document.

1. **Why `yaml`:** it reads YAML 1.2, it gives the source text of each scalar, and it has no dependencies. The store's
   reference reader uses the same version, so the corpus check and the binding read YAML with the same parser.
2. **Why map a stack overflow to `nesting-depth`:** in the tests of Context item 4, the stack overflows only at more
   than 900 levels, so the input is over the documented depth limit. [PRS-010] requires an error that identifies that
   limit. The test of the message keeps another internal error of the package from giving a limit that the input does
   not exceed.

### D3: The tree of text

`yamlToJson` walks the document nodes in document order and builds a tree of objects, arrays, and strings, as step 2
of the reference reader does. The tree differs from the reference reader in two ways: each object has no prototype
(Context item 6), and the walk does not call `Alias.resolve` (Context item 5).

1. A scalar gives its text. An empty node gives the empty string.
2. A mapping gives an object with no prototype. The walk resolves a key that is an alias as item 4 states. A key that is
   then not a scalar is a `ParseError`. Two keys with the same text are a `ParseError` ([YML-003]).
3. A sequence gives an array.
4. The walk keeps a map from anchor name to node. When the walk enters a node that has an anchor, it sets the map entry
   of that name to the node. An alias gives the tree of the node that the map holds for its name, read again at the
   location of the alias. An alias with no entry in the map is a `ParseError`. An alias inside its own anchored node is
   a `ParseError` ([YML-009]). The walk keeps one set of the open nodes, and adds and removes each node as it enters and
   leaves it.

1. **Why no prototype:** a key `__proto__` is then an own property, so the duplicate check and the JSON text include it.
   The JSON pipeline then rejects it as an unknown field, as it does for JSON input ([YML-005]).
2. **Why the map:** YAML 1.2 binds an alias to the most recent anchor of its name before it, and the walk in document
   order sets the map entries in that order. Each alias then costs one lookup.

The walk applies two limits. Each gives a `ParseError` with no entries and the limit in its `limit` property:

1. `nesting-depth`: an object or an array at level 251. The levels count as in `exceedsDepthLimit`. Thus D1 never
   gives the JSON pipeline a tree that is too deep for the Ajv recursion.
2. `alias-expansion`: the walk keeps two counts for the nodes that it reads through an alias, also through a nested
   alias. One count is the nodes. The other count is the characters of the scalar text of those nodes. The walk stops
   at 100,000 nodes plus one or at 10,000,000 characters plus one.

`Limit` in `src/errors.ts` gets the value `alias-expansion`. A YAML structure error and an alias error are a
`ParseError` with no entries, as a JSON syntax error is.

1. **Why a node count:** nested aliases make the count of nodes grow exponentially with the input size. A count of
   nodes stops this growth. A count of aliases does not. The binding uses one fixed value, so the README can document
   it.
2. **Why a character count:** an alias to a large scalar is one node. Without a character count, a 1 MB input with a
   1 MiB anchored scalar and 600 aliases to it gives 600 MiB of text, and the JSON text then throws a `RangeError` that
   is not an `OscalError`.
3. **Why 100,000 and 10,000,000:** a hand-written OSCAL document reuses an anchor for a small number of nodes. Each
   valid YAML case of the corpus uses two aliases or fewer. 10,000,000 characters are about 20 MB of JavaScript
   strings.
4. **Alternative:** a limit that is a multiple of the source node count. It is harder to document and to test.

### D4: Scalar types by the Ajv conversion loop

`src/validators.ts` exports `typeErrors(rootKey, value)`. It runs the collecting validator of the document branch of the
root key, sets `errors` to `null`, and returns one item for each location that has `type` errors: the location and the
types that the errors name. `yamlToJson` uses it as step 3 of the reference reader:

1. Find the root key of the tree with the rule of `rootKeyOf`. `rootKeyOf` moves from `src/parse.ts` to
   `src/validators.ts`, so `src/yaml.ts` and `src/parse.ts` use one rule and `src/yaml.ts` does not import
   `src/parse.ts`. When the tree has no root key or more than one, skip the
   conversion. The JSON pipeline then reports the root key error.
2. When the fail-fast validator passes the tree, stop.
3. For each location of `typeErrors`, take the named types in the order number, integer, boolean. Convert the text by
   the grammar of the first type that it matches ([YML-004]): the number grammar of RFC 8259, or `true` or `false`.
4. Repeat from step 2 until a pass converts no text.

Text that matches no grammar stays a string. The JSON pipeline then reports a `type` failure at that location, which
gives the one entry of [YML-010]. It also gives an entry for each other failure ([PRS-006]) and the selection of
[PRS-014]. The JSON text writes each converted number as the text of its scalar ([YML-005]).

1. **Why:** the loop uses the validators that the binding already has. The store's corpus check proves the method on
   each YAML case.
2. **Why the text stays a string:** Context item 3. A separate grammar error would need a second error path, and that
   path would drop the other failures.
3. **Alternative:** a walker that finds the schema types at each location. It must resolve `$ref`, `allOf`, `anyOf`,
   and `oneOf` itself, and it repeats knowledge that Ajv has.

### D5: The generator checks the schema for the conversion loop

The loop of D4 gives the type of [YML-004] only when the schema meets three conditions. `scripts/generate.ts` checks
them, and stops with an error when one fails:

1. No `type` keyword names more than one type.
2. No `anyOf` or `oneOf` permits a string and another scalar type at one location.
3. A property that two branches of one `anyOf` or `oneOf` both define has the same schema in each branch.

The reference reader checks conditions 1 and 2. Condition 3 covers a union whose branches give one property a string
in one branch and a number in another. The loop would then convert the text to a number, and [YML-004] requires a
string. The 1.2.3 schema meets the three conditions (Context item 8).

1. **Why the generator:** design D2 of the archived change `2026-11-09-add-runtime-validators-and-element-registry`
   makes the generator the only reader of the store's schema. A new schema that breaks a condition then fails the build,
   not a parse at runtime.

### D6: `serializeYaml`

`src/serialize.ts` adds `serializeYaml(document)`. It writes YAML block style with a recursive function of its own, and
does not use the `yaml` package:

1. An object with properties gives a block mapping. Each property is one line, `key:` followed by its value, with an
   indent of 2 spaces for each level.
2. An array with items gives a block sequence. Each item is a line `-` followed by its value.
3. An empty object gives `{}`, and an empty array gives `[]`.
4. Each key, string, number, and boolean is the output of `JSON.stringify` for it.

The output is one YAML 1.2 document ([YML-008]) and ends with a line break. As `serialize` does, it does not check the
document, and it writes a `null` that a caller puts into a document through a type cast.

1. **Why not `stringify` of `yaml`:** in a test of 3,006 strings, `stringify` of `yaml` 2.9.1 wrote 6 strings that read
   back with a different value, for example `" \n"` as a block scalar that reads back as `"\n"`. With double quotes as
   the default, 95 strings failed. A string that changes breaks [YML-008].
2. **Why `JSON.stringify` for each scalar:** a JSON string is also a YAML 1.2 double-quoted scalar with the same
   escapes. Each string is then one line, and the output has no block scalar, no folding, and no plain scalar. A JSON
   number matches the number grammar of [YML-004]. A prototype read back the 10 corpus documents and 3,000 random
   documents with no difference.
3. **Why quoted keys:** a reader with the YAML core schema reads a plain key such as `true` or `null` as a value that is
   not a string.
4. **Alternative:** return the output of `serialize`, which is also YAML 1.2 in flow style. It needs no code, but the
   output is JSON.

### D7: Tests

1. `test/yaml.test.ts`:
   1. One test for each scenario of [YML-002] to [YML-006] and [YML-008] to [YML-010] that the corpus does not cover.
      Each test name starts with its scenario identifier.
   2. A `ParseError` for a number-grammar failure and an unknown field in one document carries an entry for each
      location.
   3. Nested aliases that give 100,001 nodes through aliases give a `ParseError` with the limit `alias-expansion`.
      100,000 nodes parse. Aliases that give 10,000,001 characters of scalar text give the same limit, and 10,000,000
      characters parse.
   4. A tree at 251 levels gives a `ParseError` with the limit `nesting-depth`. A flow sequence 10,000 levels deep
      gives the same limit, and the test first asserts that `parseAllDocuments` reports `RESOURCE_EXHAUSTION` for that
      input. Thus the test cannot pass through the limit of D3.
   5. `parseYamlFile` of a missing path throws a `NotFoundError`, and of a directory throws a `ReadError`.
   6. `serializeYaml` then `parseYaml` gives the same canonical form for 1,000 random documents. Their strings mix
      spaces, tabs, line breaks, lines of only spaces, backslashes, quotes, `#`, `: `, `- `, U+0085, U+2028, and
      characters outside the BMP, and their objects and arrays include empty ones.
   7. A key `__proto__` gives a `ParseError` for an unknown field. Two keys `__proto__` in one mapping give a
      `ParseError` for a duplicate key.
   8. An alias with no anchor before it gives a `ParseError`. An alias key that resolves to a scalar reads as that key.
   9. 10,000 aliases to one scalar parse in less than one second.
2. `test/generate.test.ts`: the schema check of D5 rejects a schema that breaks each condition.
3. The conformance runner runs each `yaml-parse` and `yaml-round-trip` case.

## Risks / Trade-offs

1. [A valid YAML document that holds a number or a boolean costs more than its JSON form. The fail-fast check fails
   on the tree of text, the collecting validator runs one time or more, and the JSON pipeline runs the validators
   again.] → The security note "Size and time" states the cost. A document with no number and no boolean passes the
   first fail-fast check and has no conversion pass.
2. [D2 depends on a fact of `yaml` 2.9.1: a stack overflow is a document error with the code `RESOURCE_EXHAUSTION` and
   the original message, not a throw. A new version can change this.] → The test of D7 item 1.4 fails when the fact
   changes.
3. [The `yaml` package is a new runtime dependency that runs in the caller's process.] → The package has no
   dependencies, and the lockfile pins it. Only the YAML parse uses it. The security notes on dependencies name it.

## Migration Plan

None. No consumer depends on this repo.

[PRS-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-006-schema-validation-failures-carry-structured-error-detail
[PRS-010]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-010-a-binding-can-limit-the-resources-that-a-parse-uses
[PRS-013]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-013-the-root-key-selects-the-document-type-of-the-parse-failures
[PRS-014]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/document-parsing/spec.md#requirement-prs-014-a-distinguishing-property-selects-the-nested-union-branch-of-parse-failures
[YML-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-002-a-yaml-input-is-one-yaml-12-document-in-utf-8
[YML-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-003-a-yaml-document-reads-as-a-json-value
[YML-004]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-004-the-schema-decides-the-type-of-each-scalar
[YML-005]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-005-parse-an-oscal-document-from-yaml-text-or-bytes
[YML-006]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-006-parse-an-oscal-document-from-a-yaml-file-path
[YML-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-008-serialize-an-oscal-document-to-yaml
[YML-009]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-009-aliases-tags-and-merge-keys-add-no-meaning
[YML-010]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/yaml-documents/spec.md#requirement-yml-010-a-grammar-error-of-a-scalar-carries-the-location-of-the-scalar
