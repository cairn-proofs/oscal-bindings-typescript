# oscal-bindings-typescript

> [!WARNING]
> **Pre-alpha. Not functional.** This repository is an experiment. It has no usable API, no npm package, and no
> stability guarantees. Do not depend on it.

Typed TypeScript data bindings for [OSCAL](https://pages.nist.gov/OSCAL/), generated from the NIST JSON Schema and the
naming manifest published by
[cairn-proofs/oscal-bindings-specs](https://github.com/cairn-proofs/oscal-bindings-specs).

## Status

The repository holds a spike and the first operations of a binding.

What exists:

- A manifest validator that a consumer runs before it generates code.
- A generator that writes TypeScript type declarations to `src/generated/oscal.ts`.
- Type tests: valid corpus documents compile against the generated types, and documents with an invalid shape do not.
- Runtime validators for each type of the manifest, and the element-type registry.
- Parsing. `parse` and `parseFile` read an OSCAL JSON document. One typed parser reads each of the eight document
  types, for example `parseCatalog`. `isValid` checks a document and never throws.
- Serialization. `serialize` writes an OSCAL document as OSCAL JSON. The output has an indent of 2 spaces. The
  `compact` option gives the output without whitespace.
- Element validation. `validateElement` checks a standalone element against a named element type, for example
  `observation`. The result states whether the element is valid, and lists one entry for each failing location.
  `supportedElementTypes` returns the sorted list of element-type names.
- The document facade. `OscalDoc` wraps a document of any of the eight types. It gives the wrapper, the body, the
  metadata, the OSCAL version, and the body UUID through one shape. `OscalDoc.fromJson` builds it from text or bytes,
  and `OscalDoc.fromFile` builds it from a file path. The constructor throws a `TypeError` for a value that is not a
  document wrapper.
- The error model: `OscalError`, `ParseError`, `DocumentTypeMismatchError`, `NotFoundError`, and
  `UnknownElementTypeError`. A `ParseError` of a schema failure carries one entry for each failing location.
- A conformance runner. It runs each of the 58 cases of `corpus/1.2.3/cases.json` as one test, with the case id as the
  test name. The cases of parsing, the `round-trip` cases, and the `element/*` cases pass. `test/conformance/expected-failures.json` lists
  each case that needs an operation that does not exist yet. A listed case that passes fails the run, and so does a
  listed id that is not in the corpus. A change that adds an operation connects it in `test/support/adapter.ts` and
  removes the cases that it fixes from the list.
- A traceability record, `openspec/traceability.json`. It has one entry for each exported operation.
  `test/traceability.test.ts` checks the record against the JSON Schema and the requirement index of the pinned spec
  artifact.

What does not exist:

- A published npm package

## Limits

A parse limits the nesting depth of its input to 250 levels. `validateElement` applies the same limit to its value. The
limit has these properties:

1. Each object and each array is one level. A scalar adds no level. The root value is level 1, whether it is an object
   or an array.
2. The limit applies to `parse`, `parseFile`, the typed parsers, `isValid`, and `validateElement`.
3. A deeper input or value gives a `ParseError` that names the limit. `isValid` returns false for it.
4. A caller cannot change the limit.

The schema checks recurse once for each level. A deeper input or value can make them throw a `RangeError`, so the
binding stops it first. A valid element that is deeper than 250 levels gives a `ParseError`, not a valid result.

A `ParseError` has no limit on its entries. It carries one entry for each failing location.

## Regex patterns

The OSCAL schema holds XSD regex patterns. Ajv compiles each pattern with the JavaScript regex engine and the `u` flag.
The `u` flag keeps the XSD meaning of `\p{L}` and `\p{N}`.

Three constructs have a different meaning in XSD and in JavaScript. The binding translates them outside a character
class:

1. `.` becomes `[^\n\r]`. XSD `.` excludes only LF and CR. JavaScript `.` also excludes U+2028 and U+2029.
2. `\s` becomes `[\t\n\r ]`. XSD `\s` matches only space, tab, LF, and CR. JavaScript `\s` also matches other Unicode
   white space.
3. `\S` becomes `[^\t\n\r ]`.

The binding copies each other escape and each character class unchanged. It throws when it compiles a pattern with `\s`
or `\S` inside a character class. No pattern of the current schema has one.

One deviation exists. Ajv ignores the `pattern` of `DecimalDatatype`, because the parsed value is a number and not text.

## Development

The toolchain is pinned in `mise.toml`. Run the full check gate with:

```sh
npm ci
npm run check
```

The check gate downloads a pinned spec artifact release from cairn-proofs/oscal-bindings-specs over HTTPS. The pin is
release `v0.7.0+oscal.1.2.3`, and `scripts/spec-artifact.ts` holds its sha256.

## License

[Apache-2.0](LICENSE)
