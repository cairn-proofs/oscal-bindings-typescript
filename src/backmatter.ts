/**
 * Back-matter builders (design.md D1 to D3). Each builder makes an element from its arguments, validates the element
 * against its element type, and returns it. The builders apply no rule of their own: the schema decides which input is
 * invalid.
 */
import { randomUUID } from "node:crypto";
import { ParseError } from "./errors.ts";
import type { BackMatterResource, BackMatterResourceRlink, Hash, HashAlgorithm } from "./generated/oscal.ts";
import { validateElement } from "./validate-element.ts";

/** The optional inputs of `buildRlink`. */
export type RlinkOptions = Pick<BackMatterResourceRlink, "media-type" | "hashes">;

/** The optional inputs of `buildResource`. */
export type ResourceOptions = Partial<
  Pick<BackMatterResource, "uuid" | "title" | "description" | "rlinks" | "document-ids">
>;

/** Copies each field whose value is not `undefined`, so that an omitted optional input is absent from the result. */
function defined(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/** Validates the element, and throws a `ParseError` that carries the failures when it is not valid. */
function validated<T>(elementType: string, element: Record<string, unknown>): T {
  const result = validateElement(elementType, element);
  if (!result.valid) throw new ParseError(`invalid ${elementType} element`, result.failures);
  return element as T;
}

/** Builds a hash element (BMB-001). The algorithm is SHA-256 when the caller omits it. */
export function buildHash(value: string, algorithm: HashAlgorithm = "SHA-256"): Hash {
  return validated<Hash>("hash", { algorithm, value });
}

/** Builds an rlink element (BMB-002). An omitted option is absent from the result. */
export function buildRlink(href: string, options: RlinkOptions = {}): BackMatterResourceRlink {
  return validated<BackMatterResourceRlink>(
    "back-matter-resource-rlink",
    defined({ href, "media-type": options["media-type"], hashes: options.hashes }),
  );
}

/**
 * Builds a back-matter resource (BMB-003). An omitted option is absent from the result. When the caller omits `uuid`,
 * the builder generates a new one for each call. Give a `uuid` when the identity of the resource must stay the same.
 */
export function buildResource(options: ResourceOptions = {}): BackMatterResource {
  return validated<BackMatterResource>(
    "back-matter-resource",
    defined({
      uuid: options.uuid ?? randomUUID(),
      title: options.title,
      description: options.description,
      rlinks: options.rlinks,
      "document-ids": options["document-ids"],
    }),
  );
}
