## Why

This change is step 2 of the plan in #4, and it closes #7. The generated module `src/generated/oscal.ts` gives static
types only. The parse operations of step 3, the element validation of step 5, and the facade of step 6 must check a
value at runtime against the constraints of an OSCAL type. The binding has no such check now.

## What Changes

1. A validator for each type of the naming manifest. Ajv checks a value against the vendored complete schema at the
   place that defines the type. The schema stays the only source of the constraints.
2. An element-type registry. It maps the kebab-case form of each canonical type name to that type, as [ELV-002]
   requires.
3. The generator also writes the runtime inputs that items 1 and 2 need, and `npm run generate:check` checks them.
4. `ajv` becomes a runtime dependency. `ajv-formats` is a new runtime dependency.

The spike already meets [MDL-003], [MDL-011], and [MDL-012] in the generated types. The validators of item 1 attach the
constraints of each scalar. The manifest holds no name for a scalar definition, so this change adds no named scalar
type ([MDL-009]).

No corpus case depends on this change alone, so the list of expected failures does not change. The change is complete
when its own tests pass:

1. The validator of each manifest type compiles.
2. The element-type names are unique, and each name maps back to its canonical type name.
3. Each corpus element of `elements/` gives the validity result that its case expects, when the test calls the validator
   directly.

Not in this change: a public operation, the error model, the structured failure entries of a parse error, and the
package entry point. Steps 3, 5, and 6 add them.

## Capabilities

### New Capabilities

None. The contract is in the store. This change consumes [ELV-002], [MDL-003], [MDL-008], [MDL-009], [MDL-011], and
[MDL-012], and adds no requirement of its own. The change sets `skip_specs: true`.

### Modified Capabilities

None.

## Impact

1. Changed files: `scripts/generate.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, and the generator test.
2. New files: the generated runtime inputs in `src/generated/`, the validator module in `src/`, and its test.
3. New npm dependency: `ajv-formats`. `ajv` moves from `devDependencies` to `dependencies`.
4. The binding exports no operation, so the traceability record does not change.
5. No consumer depends on this repo, so the change breaks no consumer.

[ELV-002]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/element-validation/spec.md#requirement-elv-002-element-type-names-are-kebab-case-and-derived-from-the-type-names
[MDL-003]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-003-scalar-root-wrappers-collapse-to-plain-aliased-types
[MDL-008]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-008-models-reject-unknown-fields-strict-coverage
[MDL-009]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-009-the-naming-manifest-is-the-shared-source-of-truth-across-languages
[MDL-011]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-011-each-enum-site-is-a-named-type-marked-open-or-closed
[MDL-012]: https://github.com/cairn-proofs/oscal-bindings-specs/blob/main/openspec/specs/model-derivation/spec.md#requirement-mdl-012-a-property-that-holds-one-item-or-a-list-of-items-is-a-single-or-many-type
