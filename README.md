# oscal-bindings-typescript

> [!WARNING]
> **Pre-alpha. Not functional.** This repository is an experiment. It has no usable API, no npm package, and no
> stability guarantees. Do not depend on it.

Typed TypeScript data bindings for [OSCAL](https://pages.nist.gov/OSCAL/), generated from the NIST JSON Schema and the
naming manifest published by
[cairn-proofs/oscal-bindings-specs](https://github.com/cairn-proofs/oscal-bindings-specs).

## Status

The repository currently holds a spike. The spike tests whether the provisional naming manifest format of the spec
store is enough for a second language to generate types. It is not a binding.

What exists:

- A manifest validator that a consumer runs before it generates code.
- A generator that writes TypeScript type declarations to `src/generated/oscal.ts`.
- Type tests: valid corpus documents compile against the generated types, and documents with an invalid shape do not.

What does not exist:

- Runtime parsing and validation
- Serialization
- The conformance runner
- Regex dialect translation and datetime handling
- A published npm package

## Development

The toolchain is pinned in `mise.toml`. Run the full check gate with:

```sh
npm ci
npm run check
```

The check gate downloads a pinned spec artifact release from cairn-proofs/oscal-bindings-specs over HTTPS.

## License

[Apache-2.0](LICENSE)
