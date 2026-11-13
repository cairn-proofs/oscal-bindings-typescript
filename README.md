# oscal-bindings-typescript

> [!WARNING]
> **Alpha.** The binding reads, checks, and writes OSCAL JSON and OSCAL YAML. It has no npm package and no stability
> guarantees, and its API can change without notice.

Typed TypeScript data bindings for [OSCAL](https://pages.nist.gov/OSCAL/), generated from the NIST JSON Schema and the
naming manifest published by
[cairn-proofs/oscal-bindings-specs](https://github.com/cairn-proofs/oscal-bindings-specs).

## Status

The repository holds a working binding for OSCAL JSON and OSCAL YAML.

What exists:

- A manifest validator that a consumer runs before it generates code.
- A generator that writes TypeScript type declarations to `src/generated/oscal.ts`.
- Type tests: valid corpus documents compile against the generated types, and documents with an invalid shape do not.
- Runtime validators for each type of the manifest, and the element-type registry.
- Parsing. `parse` and `parseFile` read an OSCAL JSON document. One typed parser reads each of the eight document
  types, for example `parseCatalog`. `isValid` checks a document and never throws.
- YAML parsing. `parseYaml` reads an OSCAL document from YAML text or UTF-8 bytes. `parseYamlFile` reads it from a file
  path. Each gives the result of `parse` for the JSON text of the input. The schema decides the type of each scalar, so
  the plain scalar `1.0` at a string location is the string `"1.0"`. A scalar that does not match the grammar of its
  type gives a `ParseError` with one entry for its location.
- Serialization. `serialize` writes an OSCAL document as OSCAL JSON. The output has an indent of 2 spaces. The `compact`
  option gives the output without whitespace. `serializeYaml` writes an OSCAL document as YAML in block style, with an
  indent of 2 spaces. It writes each key and each string in JSON form, so a string such as `"1.0"` keeps its type when a
  reader reads the output again.
- Element validation. `validateElement` checks a standalone element against a named element type, for example
  `observation`. The result states whether the element is valid, and lists one entry for each failing location.
  `supportedElementTypes` returns the sorted list of element-type names.
- The document facade. `OscalDoc` wraps a document of any of the eight types. It gives the wrapper, the body, the
  metadata, the OSCAL version, and the body UUID through one shape. `OscalDoc.fromJson` builds it from text or bytes,
  and `OscalDoc.fromFile` builds it from a file path. The constructor throws a `TypeError` for a value that is not a
  document wrapper.
- Back-matter builders. `buildHash`, `buildRlink`, and `buildResource` build a hash, an rlink, and a back-matter
  resource. `buildHash` uses SHA-256 when the caller omits the algorithm. `buildResource` generates a UUID when the
  caller gives no `uuid` and no `key`. With a `key` and no `uuid`, the `uuid` is the UUID version 5 of the key, so the
  same key gives the same `uuid`. A `key` with a `uuid`, and an empty `key`, give a `BuilderError`. Each builder
  validates its result, and an omitted optional input is absent from the result. An invalid input gives a `BuilderError`
  that carries one entry for each failing location. A `BuilderError` is not a `ParseError`.
- The error model: `OscalError`, `ParseError`, `DocumentTypeMismatchError`, `LimitExceededError`, `BuilderError`,
  `NotFoundError`, `ReadError`, and `UnknownElementTypeError`. A `BuilderError` is not a `ParseError`. A `ParseError` of
  a schema failure carries one entry for each failing location. Use `instanceof` to test the category of an error. A
  `DocumentTypeMismatchError` is also a `ParseError`, but a `ParseError` is not a `DocumentTypeMismatchError`. The
  `category` property holds the most specific category. The `limit` property identifies the limit that stopped an
  operation, for example `nesting-depth` or `alias-expansion`. Test it with `error.limit !== undefined`, because each
  error has the `limit` key.
- A conformance runner. It runs each case of `corpus/1.2.3/cases.json` as one test, with the case id as the test name.
  The cases of parsing, the `round-trip` cases, the `yaml-parse` and `yaml-round-trip` cases, the `element/*` cases, the
  `element-types` case, and the `build-resource` cases of a key pass. The other `build-resource` cases need the fields
  `expected-element` or `document-ids`. `test/conformance/expected-failures.json` lists each case that needs an
  operation or a field that does not exist yet. A listed case that passes fails the run, and so does a listed id that is
  not in the corpus. A change that adds an operation connects it in `test/support/adapter.ts` and removes the cases that
  it fixes from the list.
- A traceability record, `openspec/traceability.json`. It has one entry for each exported operation.
  `test/traceability.test.ts` checks the record against the JSON Schema and the requirement index of the pinned spec
  artifact.

What does not exist:

- A published npm package
- The `assessment-period` operation of the conformance corpus

## Limits

A parse limits the nesting depth of its input to 250 levels. `validateElement` applies the same limit to its value. The
limit has these properties:

1. Each object and each array is one level. A scalar adds no level. The root value is level 1, whether it is an object
   or an array.
2. The limit applies to `parse`, `parseFile`, `parseYaml`, `parseYamlFile`, the typed parsers, `isValid`,
   `validateElement`, `buildHash`, `buildRlink`, and `buildResource`. For a YAML input, the levels are the levels of the
   value that the input reads as, and they include the levels that an alias gives.
3. A deeper input gives a `ParseError` from `parse`, `parseFile`, `parseYaml`, `parseYamlFile`, and the typed parsers. A
   deeper value gives a `LimitExceededError` from `validateElement`, `buildHash`, `buildRlink`, and `buildResource`.
   Each error has the limit `nesting-depth` in its `limit` property. `isValid` returns false for a deeper input.
4. A `LimitExceededError` is not a `ParseError`. A caller that catches `ParseError` around `validateElement` or a
   builder does not catch it.
5. A caller cannot change the limit.

The schema checks recurse once for each level. A deeper input or value can make them throw a `RangeError`, so the
binding stops it first. A valid element that is deeper than 250 levels gives a `LimitExceededError`, not a valid result.

A YAML input has one more limit, `alias-expansion`. `parseYaml` and `parseYamlFile` stop when the aliases of the input
give more than 100,000 nodes, or more than 10,000,000 characters of scalar text. The count includes the nodes that a
nested alias gives. The error is a `ParseError` with no entries, and its `limit` property is `alias-expansion`. A caller
cannot change the limit. The binding has no limit on the size of a YAML input in bytes.

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

## Security notes for consumers

The binding checks the shape of an OSCAL document. It does not check who wrote the document, where the document came
from, or what the document contains. It runs in your process with no isolation. This section explains what can go wrong
when you use it. It also lists what you must do around each call.

Each note has three parts: the risk, what you lose, and what to do.

### 1. What if the input is hostile?

#### Size and time

**Risk.** `parse`, `parseFile`, `parseYaml`, `parseYamlFile`, and `isValid` decode, parse, and check a document in one
synchronous call. The binding limits the nesting depth and the alias expansion of a YAML input (see
[Limits](#limits)). It sets no limit on the size of the input. An attacker who can send you a very large document can
block your event loop and use much memory. An invalid large document costs more. The binding checks it again for each
nested union that selects a branch above a failure, and builds one failure entry for each bad location. Only
`CatalogGroup` and `ProfileGroup` can hold themselves, so a deep stack of groups multiplies this cost.

A YAML input costs more than the same document in JSON. A small YAML input can read as a large tree, up to the limits of
`alias-expansion`: 10,000,000 characters of scalar text are about 20 MB of memory. A valid YAML document that holds a
number or a boolean costs more than its JSON form. The check of the tree of text fails, and the collecting check then
runs one time or more. The JSON checks run again on the result. A document with no number and no boolean has no
conversion pass.

**What you lose.** Your service can become unavailable.

**What to do.**

1. Cap the size of each request body before you call `parse`, `parseYaml`, `isValid`, or `OscalDoc.fromJson`.
2. Run the call in a worker thread, or in a bounded queue, with a timeout.
3. A `ParseError` and a `BuilderError` have no limit on their entries. Return only a set number of failure entries to a
   caller.

#### Error text

**Risk.** An error can contain text that an attacker chose. A `ParseError` carries keys and values of the input document
in `failures[].location` and `failures[].messages`. A `BuilderError` carries the same text of the input of a builder in
`failures[].location` and `failures[].messages`. The `message` of a `ParseError` for a YAML syntax error holds lines
of the input. An attacker can put long strings, control characters, or markup there. These can fill your logs or add
fake log lines. If you show `NotFoundError.path`, `ReadError.path`, or the Node file system error in `ReadError.cause`
(for example `EACCES` and `EISDIR`) to an attacker, it tells them which files exist, their permissions, and their
absolute paths.

**What you lose.** Your logs can contain false entries. An attacker can learn the layout of your file system.

**What to do.**

1. Treat `failures[].location`, `failures[].messages`, the `message` of a `ParseError` for a syntax error,
   `NotFoundError.path`, `ReadError.path`, and the text of the Node file system error in `ReadError.cause` as untrusted.
2. Do not show this text to an end user. Show a generic message instead.
3. Write this text to a log. Use `JSON.stringify` and a length cap.

#### File paths

**Risk.** `parseFile`, `parseYamlFile`, and `OscalDoc.fromFile` read the file at the path that you give them. The
binding does not restrict the path. An attacker who controls part of the path can point it at a named pipe, a device
file, or a very large file. Your process then hangs or runs out of memory. The attacker can also use a symbolic link to
make the binding read a file outside the folder that you intended. The error text can then show the content of that
file.

**What you lose.** Your service can become unavailable. An attacker can read local files, for example other security
plans.

**What to do.**

1. Do not pass a path that you built from untrusted input.
2. If a path must come from a user, call `fs.realpathSync` on it first.
3. Check that the result starts with the allowed directory followed by `path.sep`.
4. Call `fs.lstatSync`. Check that the entry is a regular file.
5. Check that the size of the file is within a limit that you choose.

### 2. Can I trust the content?

#### A valid document is not an authentic document

**Risk.** `parse`, `parseYaml`, and `isValid` tell you that a document has a valid shape. They do not tell you who made
it. An attacker can send a valid document that names another party as its author, uses a uuid that you know, or states a
false `oscal-version`. A sender can also deny later that they sent a document that you accepted. You cannot prove that
they sent it.

**What you lose.** You can treat forged content as content from a trusted author. You cannot prove where a document came
from.

**What to do.**

1. Treat `metadata`, each party, each `uuid`, and `oscal-version` as claims.
2. Authenticate the sender before you trust a document. Use a signature or an authenticated channel.
3. Keep the raw bytes of the document, their sha256, the sender, and the time of receipt.

#### Files that you store and read

**Risk.** The binding does not check who wrote a file. Anyone who can write to your store of OSCAL files can change a
file before you call `parseFile` or `parseYamlFile`. The changed file can still be valid against the schema. The binding
then accepts it.

**What you lose.** You can accept forged or changed security content as real, for example a changed security plan.

**What to do.**

1. Give only one service account write permission on the stores of OSCAL files.
2. Write a file to a temporary name. Then rename it.
3. Keep a sha256 or a signature for each file. Check it before you call `parseFile` or `parseYamlFile`.

#### Links in a document

**Risk.** The schema accepts any URI in an `href`, including the `href` of an `rlink`. A document can hold a `file:` URI,
a `javascript:` URI, an internal network address, or a cloud-metadata address. The binding never fetches or renders an
`href`. If your code does, an attacker can make your server request internal addresses, read local files, or run script
in the page of a user.

**What you lose.** Your network, your files, and your users are at risk.

**What to do.**

1. Allow only the `http` and `https` schemes for an `href`. Allow other schemes only if you need them.
2. In a server-side fetch, block loopback addresses, private addresses, and cloud-metadata addresses.
3. Escape the `href` when you render it.
4. Never put an `href` in a `javascript:` link.

### 3. What am I responsible for?

#### Check what you build or change

**Risk.** `serialize`, `serializeYaml`, and the `OscalDoc` constructor do not check the document against the schema. The
constructor throws a `TypeError` only for a value that is not a document wrapper. A document with `null` values or
without `metadata` passes through each of them. `serializeYaml` writes a `null` as `null`. You can then write invalid
OSCAL. Or a getter can fail later with a `TypeError`.

**What you lose.** Invalid OSCAL can go to other systems. Or your process can fail at a place that you did not expect.

**What to do.**

1. Call `isValid` on a document from untrusted code or untrusted input. Do this before you wrap it or write it.
2. Call `isValid` on the output of `serialize` when you write the file for another system.
3. `isValid` reads JSON only, and it returns false for YAML text. To check the output of `serializeYaml`, call
   `parseYaml` on it in a `try` block. A `ParseError` means that the output is not valid OSCAL.
4. Check the serialized text again after any change to a parsed document. Use `isValid` for JSON, and `parseYaml` for
   YAML.

The back-matter builders (`buildHash`, `buildRlink`, and `buildResource`) check their result against the schema.

#### Isolation and shared documents

**Risk.** The binding runs in your process. It has no sandbox. Any code in the same process, for example a dependency,
can call the binding with any input. That code can also change a parsed document after `parse` or `parseYaml` returns.
The binding does not detect this.

**What you lose.** A parsed document can change without your knowledge. You can also lose control of what code uses the
binding.

**What to do.**

1. Review every dependency that runs in that process. The runtime dependencies of the binding are
   `ajv`, `ajv-formats`, and `yaml`.
2. Deep-freeze a parsed document, or copy it with `structuredClone`, before you share it with other code.

#### Audit

**Risk.** The binding writes no log and keeps no audit record. A user or a process can read or write a sensitive OSCAL
file through the binding. No record then shows which file or document it was. The user can deny it later.

**What you lose.** You have no audit trail of access to your OSCAL documents.

**What to do.** Write an audit entry in your own wrapper for each call of `parse`, `parseFile`, `parseYaml`,
`parseYamlFile`, `OscalDoc.fromFile`, `serialize`, and `serializeYaml`. Record who made the call, what the call was, and
when it happened. Record the sha256 of the document. Never record the content of the document.

#### Install the binding

**Risk.** An attacker can reach you through the way that you install the binding. The attacker can make you install code
that the maintainer did not release. To do this, the attacker can take a maintainer account, move a branch, rename the
repository, or publish a look-alike. The attacker can also publish a malicious release of a dependency of `ajv`, for
example a transitive dependency. Or the attacker can serve a modified `ajv`, `ajv-formats`, or `yaml` from the registry.
Either action can run attacker code in your process or make the binding accept invalid documents. Without your own
lockfile, a new install can take such a release.

**What you lose.** Your process and your data can come under the control of an attacker. You cannot trust the results of
the schema check.

**What to do.** The binding has no published npm package yet. Use these steps for your current install method.

1. Pin the binding to a full commit SHA or to a signed tag. Do not use a branch name.
2. Commit your own lockfile.
3. Install with `npm ci --ignore-scripts`.
4. Run `npm audit signatures`.
5. Review each change in `ajv`, `ajv-formats`, `yaml`, and their dependencies when you update.

## Development

The toolchain is pinned in `mise.toml`. Run the full check gate with:

```sh
npm ci
npm run check
```

The check gate downloads a pinned spec artifact release from cairn-proofs/oscal-bindings-specs over HTTPS. The pin is
release `v0.8.0+oscal.1.2.3`, and `scripts/spec-artifact.ts` holds its sha256.

### Benchmarks

`npm run bench` measures `parse` and `serialize` on the documents of the pinned corpus. It prints Markdown tables that
you can paste into a pull request. It is not part of `npm run check`, because the times depend on the machine.

For each case it reports the median time of one call, the throughput, and the V8 heap that one call allocates. For
`parse` of a valid document it also reports the heap that the parsed document keeps. It covers the happy path (the nine
valid documents, and `serialize` with and without `compact`) and the error path (the invalid documents of the corpus, a
document of the wrong type, and an input over the depth limit). `serialize` has no error path. The tables also give the
time of the first parse, which compiles the validators, and the peak memory of the process.

To measure the effect of a pull request, run both builds on the same machine with nothing else busy:

```sh
git switch main && npm run bench -- --json tmp/base.json
git switch my-branch && npm run bench -- --baseline tmp/base.json
```

The second run adds the change from the baseline to each row. A time change is bold when it is over 10% and over the
spread of both runs. An allocation change is bold when it is over 2%. Time varies from run to run on one machine, so
run again before you act on one bold time. Allocation does not vary, so it is the best signal for a small change. Add
`--json <file>` to save a run, and `--quick` for a short run that checks the script and gives no usable numbers.

## License

[Apache-2.0](LICENSE)
