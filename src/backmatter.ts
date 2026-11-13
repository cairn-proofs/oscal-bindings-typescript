/**
 * Back-matter builders (design.md D1 to D3). Each builder makes an element from its arguments, validates the element
 * against its element type, and returns it. The schema decides which input is invalid. Two rules of `buildResource` are
 * the exception, because the key is not a field of the element: an empty key is invalid, and a key with a `uuid` is
 * invalid (BMB-004).
 */
import { createHash, randomUUID } from "node:crypto";
import { BuilderError } from "./errors.ts";
import type { BackMatterResource, BackMatterResourceRlink, Hash, HashAlgorithm } from "./generated/oscal.ts";
import { validateElement } from "./validate-element.ts";

/** The optional inputs of `buildRlink`. */
export type RlinkOptions = Pick<BackMatterResourceRlink, "media-type" | "hashes">;

/** The optional inputs of `buildResource`. The `key` gives the `uuid` of the resource (BMB-004). It is not a field. */
export type ResourceOptions = Partial<
  Pick<BackMatterResource, "uuid" | "title" | "description" | "rlinks" | "document-ids">
> & { key?: string };

/** The namespace of the UUID version 5 that a key gives (BMB-004). */
const KEY_NAMESPACE = "3942257f-e1cf-5e06-9c6f-eeb97ecabe77";

/** Copies each field whose value is not `undefined`, so that an omitted optional input is absent from the result. */
function defined(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/** Validates the element, and throws a `BuilderError` that carries the failures when it is not valid. */
function validated<T>(elementType: string, element: Record<string, unknown>): T {
  const result = validateElement(elementType, element);
  if (!result.valid) throw new BuilderError(`invalid ${elementType} element`, result.failures);
  return element as T;
}

/** The UUID version 5 of a key in `KEY_NAMESPACE`, as RFC 9562, Section 5.5 states. The text is lowercase. */
function uuidFromKey(key: string): string {
  const digest = createHash("sha1")
    .update(Buffer.from(KEY_NAMESPACE.replaceAll("-", ""), "hex"))
    .update(key, "utf8")
    .digest();
  const bytes = digest.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

/** Gives the `uuid` of a resource: from the key, from the caller, or a new one (BMB-003, BMB-004). */
function resourceUuid(options: ResourceOptions): string {
  const { key, uuid } = options;
  if (key !== undefined && uuid !== undefined) throw new BuilderError("a key and a uuid are both given");
  if (key === "") throw new BuilderError("the key is empty");
  if (key !== undefined) return uuidFromKey(key);
  return uuid ?? randomUUID();
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
 * Builds a back-matter resource (BMB-003, BMB-004). An omitted option is absent from the result. When the caller gives a
 * `key`, the `uuid` is the UUID version 5 of the key, so the same key gives the same `uuid`. When the caller gives no
 * `key` and no `uuid`, the builder generates a new `uuid` for each call. A `key` with a `uuid`, and an empty `key`, throw
 * a `BuilderError`. The result has no `key` field.
 */
export function buildResource(options: ResourceOptions = {}): BackMatterResource {
  return validated<BackMatterResource>(
    "back-matter-resource",
    defined({
      uuid: resourceUuid(options),
      title: options.title,
      description: options.description,
      rlinks: options.rlinks,
      "document-ids": options["document-ids"],
    }),
  );
}
