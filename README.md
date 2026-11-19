# oscal-bindings (TypeScript)
<p align="center">
  <a href="https://github.com/cairn-proofs/oscal-bindings-specs"><img alt="oscal-bindings-specs" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcairn-proofs%2Foscal-bindings-typescript%2Fmain%2Fspec-pin.json&query=%24.version&label=oscal-bindings-specs"></a>
  <a href="https://github.com/cairn-proofs/oscal-bindings-typescript/actions/workflows/build.yml"><img alt="CI" src="https://github.com/cairn-proofs/oscal-bindings-typescript/actions/workflows/build.yml/badge.svg?branch=main"></a>
  <a href="https://www.npmjs.com/package/oscal-bindings"><img alt="npm" src="https://img.shields.io/npm/v/oscal-bindings.svg"></a>
  <a href="https://www.npmjs.com/package/oscal-bindings"><img alt="Node versions" src="https://img.shields.io/node/v/oscal-bindings.svg"></a>
  <a href="https://github.com/cairn-proofs/oscal-bindings-typescript/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/oscal-bindings.svg"></a>
</p>

> [!IMPORTANT]
> **Beta.** The binding reads, checks, and writes OSCAL JSON and OSCAL YAML. It has no stability guarantees, and its API can change without notice.

Typed TypeScript data bindings for [OSCAL](https://pages.nist.gov/OSCAL/) (Open Security Controls Assessment Language) v1.2.3, generated from the NIST JSON Schema and the naming manifest of [cairn-proofs/oscal-bindings-specs](https://github.com/cairn-proofs/oscal-bindings-specs).

- **Every OSCAL document type.** Catalog, Profile, Component Definition, System Security Plan, Assessment Plan, Assessment Results, Plan of Action and Milestones, and Mapping Collection, each with a typed parser.
- **Checked input.** A parse rejects a document that does not match the schema, and reports each failing location.
- **JSON and YAML.** Read and write both. A YAML document gives the same result as the same document in JSON.
- **Typed errors.** Each failure is an `OscalError` subclass that you test with `instanceof`.
- **Three runtime dependencies.** `ajv`, `ajv-formats`, and `yaml`. One entry point, `oscal-bindings/v1`.
- **Consistent interoperability.** The binding implements the [language-neutral OSCAL bindings spec](https://github.com/cairn-proofs/oscal-bindings-specs) and passes its conformance corpus.

API reference: <https://cairn-proofs.github.io/oscal-bindings-typescript/>

## Installation

```sh
npm install oscal-bindings
```

The package needs Node 26.13.0 or later. [Security notes](https://github.com/cairn-proofs/oscal-bindings-typescript/blob/main/docs/security.md#install-the-binding) covers how to pin and verify the install.

## Quick start

**Parse** a document. Each document type has a typed parser that returns its document type (`CatalogDocument` here). `parse` takes any type.

```ts
import { parseCatalog, serialize, ParseError } from "oscal-bindings/v1";

const text = `{"catalog": {
  "uuid": "74c8ba1e-5cd4-4ad1-bbfd-d888e2f6c724",
  "metadata": {"title": "Demo catalog", "last-modified": "2026-01-02T03:04:05Z",
               "version": "1.0", "oscal-version": "1.2.3"},
  "controls": [{"id": "ac-1", "title": "Policy and Procedures"}]}}`;
const doc = parseCatalog(text);
```

**Read** it as typed objects.

```ts
doc.catalog.metadata.title; // "Demo catalog"
doc.catalog.controls?.[0]?.id; // "ac-1"
```

**Serialize** it back. The output is OSCAL JSON, with an indent of 2 spaces. Pass `{ compact: true }` for no whitespace.

```ts
const json = serialize(doc);
```

**Reject** input that is not valid OSCAL. Here a wrong key stands in for an OSCAL name.

```ts
try {
  parseCatalog(text.replace('"oscal-version"', '"oscal_version"'));
} catch (error) {
  if (error instanceof ParseError) {
    for (const failure of error.failures) console.log(failure.location, failure.messages);
  }
}
// /catalog/metadata/oscal-version [ "must have required property 'oscal-version'" ]
// /catalog/metadata/oscal_version [ 'must NOT have additional properties' ]
```

## Highlights

**One wrapper for every document type.** `OscalDoc` gives `metadata`, `uuid`, and `oscalVersion` without a check of the type:

```ts
import { OscalDoc } from "oscal-bindings/v1";

const doc = OscalDoc.fromFile("ssp.json");
doc.metadata.title;
```

**Back-matter builders** check what they build:

```ts
import { buildHash, buildResource, buildRlink } from "oscal-bindings/v1";

const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const resource = buildResource({
  title: "Evidence: signed audit report",
  rlinks: [buildRlink("https://example.com/audit-q1.pdf", { "media-type": "application/pdf", hashes: [buildHash(digest)] })],
});
```

**YAML** works the same way as JSON:

```ts
import { parseYamlFile, serializeYaml } from "oscal-bindings/v1";

const yamlText = serializeYaml(parseYamlFile("catalog.yaml"));
```

**One element at a time.** `validateElement` checks a single element, for example an `observation`, against its schema.

**Resource limits.** A parse limits the nesting depth of its input and the alias expansion of a YAML input. See [Limits](https://github.com/cairn-proofs/oscal-bindings-typescript/blob/main/docs/limits.md).

## OSCAL versions

> [!NOTE]
> The types come from one OSCAL release, held in `OSCAL_RELEASE` (currently `"1.2.3"`). A document from a newer 1.x release can fail on a field that the binding has not seen.

The package has one entry point, `oscal-bindings/v1`, named for the OSCAL major version. A later OSCAL major version gets a new path.

## Other TypeScript and JavaScript OSCAL libraries

- [oscal](https://www.npmjs.com/package/oscal) (2.0.7) wraps the Java-based OSCAL CLI and OSCAL Server. Use it when you need XML, conversion between XML, JSON and YAML, or profile resolution.
- [@easydynamics/oscal-types](https://www.npmjs.com/package/@easydynamics/oscal-types) (0.1.0) has generated OSCAL types and `Convert` helpers that throw when a value does not match a type. Its last release is from 2023.
- [oscal-types](https://www.npmjs.com/package/oscal-types) (0.0.1) has type definitions only, generated from the OSCAL JSON Schema in 2021.

oscal-bindings is the typed data-binding layer for one OSCAL release: types for all eight document types, schema checks that report each failing location, JSON and YAML in and out, and three runtime dependencies.

## Documentation

- [Resource limits](https://github.com/cairn-proofs/oscal-bindings-typescript/blob/main/docs/limits.md): the nesting-depth and alias-expansion limits, and the regex patterns
- [Security notes for consumers](https://github.com/cairn-proofs/oscal-bindings-typescript/blob/main/docs/security.md): what to do around each call
- [Performance](https://github.com/cairn-proofs/oscal-bindings-typescript/blob/main/PERFORMANCE.md): how to measure `parse` and `serialize`
- API reference: <https://cairn-proofs.github.io/oscal-bindings-typescript/>

## Project information

- [Source](https://github.com/cairn-proofs/oscal-bindings-typescript) · [Issues](https://github.com/cairn-proofs/oscal-bindings-typescript/issues) · [npm](https://www.npmjs.com/package/oscal-bindings) · [Releases](https://github.com/cairn-proofs/oscal-bindings-typescript/releases)
- Contributing: [DEVELOPING.md](https://github.com/cairn-proofs/oscal-bindings-typescript/blob/main/DEVELOPING.md) covers the check gate, the API reference build, and the release steps.
- Other languages: [oscal-bindings (Python)](https://github.com/cairn-proofs/oscal-bindings-python) follows the same [language-neutral contract](https://github.com/cairn-proofs/oscal-bindings-specs).

## License

Apache License 2.0. See [LICENSE](https://github.com/cairn-proofs/oscal-bindings-typescript/blob/main/LICENSE).
