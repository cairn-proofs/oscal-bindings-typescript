/**
 * The document facade (design.md D1 to D3). One class gives uniform access to the wrapper, the body, the metadata, the
 * OSCAL version, and the body-level UUID of any of the eight OSCAL document types.
 */
import type { Metadata, OscalDocument } from "./generated/oscal.ts";
import { parse, parseFile } from "./parse.ts";
import { rootKeys } from "./validators.ts";

/** The union of the eight body types. */
type OscalBody = NonNullable<
  OscalDocument[
    | "assessment-plan"
    | "assessment-results"
    | "catalog"
    | "component-definition"
    | "mapping-collection"
    | "plan-of-action-and-milestones"
    | "profile"
    | "system-security-plan"
  ]
>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** The facade of an OSCAL document of any type (FAC-001 to FAC-003). */
export class OscalDoc {
  readonly #wrapper: OscalDocument;
  readonly #rootKey: string;

  /**
   * Wraps a document wrapper, for example `{ "catalog": { ... } }`. Throws a `TypeError` and wraps nothing when the
   * value is not a plain object, when it has no root key or more than one, or when the value of the root key is not a
   * plain object (FAC-001). The constructor does no schema validation. The getters are safe for a parsed document, so
   * a caller that wraps a value directly must make sure that the value is valid.
   */
  constructor(wrapper: OscalDocument) {
    const value: unknown = wrapper;
    if (!isPlainObject(value)) throw new TypeError("the value is not an OSCAL document wrapper: it is not an object");
    const found = Object.keys(value).filter((key) => rootKeys.includes(key));
    if (found.length !== 1) {
      throw new TypeError(
        found.length === 0
          ? "the value is not an OSCAL document wrapper: it has no root key"
          : `the value is not an OSCAL document wrapper: it has more than one root key: ${found.join(", ")}`,
      );
    }
    if (!isPlainObject(value[found[0]])) {
      throw new TypeError(`the value is not an OSCAL document wrapper: the value of "${found[0]}" is not an object`);
    }
    this.#wrapper = wrapper;
    this.#rootKey = found[0];
  }

  /** Builds the facade from JSON text or UTF-8 bytes. Each error of `parse` passes through (FAC-003). */
  static fromJson(input: string | Uint8Array): OscalDoc {
    return new OscalDoc(parse(input));
  }

  /** Builds the facade from a file path. Each error of `parseFile` passes through (FAC-003). */
  static fromFile(path: string): OscalDoc {
    return new OscalDoc(parseFile(path));
  }

  /** The document wrapper, for example `{ "catalog": { ... } }`. */
  get wrapper(): OscalDocument {
    return this.#wrapper;
  }

  /** The value of the root key. */
  get body(): OscalBody {
    return (this.#wrapper as unknown as Record<string, OscalBody>)[this.#rootKey];
  }

  /** The metadata block of the body. */
  get metadata(): Metadata {
    return this.body.metadata;
  }

  /** The `oscal-version` of the metadata. */
  get oscalVersion(): string {
    return this.metadata["oscal-version"];
  }

  /** The `uuid` of the body. */
  get uuid(): string {
    return this.body.uuid;
  }
}
