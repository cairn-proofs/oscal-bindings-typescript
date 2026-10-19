/**
 * Hand-written type tests (design.md D5). Each `@ts-expect-error` must have an error on the next line. An unused
 * directive is itself a compile error, so a type that accepts one of these values fails `npm run types:check`.
 */
import type {
  CatalogGroup,
  IncludeAll,
  MappingCollectionMappings,
  HashAlgorithm,
  OscalDocument,
  ParameterSelectionHowMany,
} from "../../src/generated/oscal.ts";

// A union branch excludes the distinguishing property of the other branch (design.md D4).
// @ts-expect-error A group holds groups or controls, not both.
export const bothBranches: CatalogGroup = { title: "t", groups: [], controls: [] };
// The anyOf accepts an object with only the shared properties.
export const sharedOnly: CatalogGroup = { title: "t" };
export const withGroups: CatalogGroup = { title: "t", groups: [{ title: "u" }] };

// A closed enum holds only its values.
export const closedOk: ParameterSelectionHowMany = "one-or-more";
// @ts-expect-error "many" is not a value of the closed enum.
export const closedBad: ParameterSelectionHowMany = "many";

// An open enum also accepts any other string.
export const openKnown: HashAlgorithm = "SHA-256";
export const openOther: HashAlgorithm = "BLAKE3";

// A document has exactly one body field.
// @ts-expect-error A wrapper with two body fields matches no document type.
export const twoBodies: OscalDocument = { catalog: catalog(), profile: profile() };

// An object without properties accepts no key.
export const emptyOk: IncludeAll = {};
// @ts-expect-error include-all has no properties.
export const emptyBad: IncludeAll = { all: true };

// A single-or-many property accepts one item or a list.
declare const mapping: Extract<MappingCollectionMappings, unknown[]>[number];
export const one: MappingCollectionMappings = mapping;
export const many: MappingCollectionMappings = [mapping, mapping];

declare function catalog(): Extract<OscalDocument, { catalog: unknown }>["catalog"];
declare function profile(): Extract<OscalDocument, { profile: unknown }>["profile"];
