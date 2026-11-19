/**
 * The document facade (design.md D1 to D3). One class gives uniform access to the wrapper, the body, the metadata, the
 * OSCAL version, and the body-level UUID of any of the eight OSCAL document types.
 */
import { AccessError } from "./errors.ts";
import type { AssessmentPlan, AssessmentResults, Metadata, OscalDocument, Task } from "./generated/oscal.ts";
import { parse, parseFile } from "./parse.ts";
import { rootKeys } from "./validators.ts";

/** The union of the eight body types. */
export type OscalBody = NonNullable<
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

/** The bounds of an assessment period (FAC-004). Each bound is a datetime of the document, or `undefined`. */
export interface AssessmentPeriod {
  readonly start: string | undefined;
  readonly end: string | undefined;
}

const DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

/**
 * Compares two OSCAL datetimes by instant (FAC-007). Returns a negative number, zero, or a positive number. The key of
 * a value is its epoch second in UTC, then its fraction digits. A `TypeError` names a value that has another form.
 */
function compareInstants(a: string, b: string): number {
  const key = (value: string): [number, string] => {
    const m = DATETIME.exec(value);
    if (m === null) throw new TypeError(`the value is not an OSCAL datetime: ${value}`);
    const date = new Date(0);
    // `Date.UTC` maps a year from 0 to 99 to a year from 1900 to 1999, so the fields are set on a `Date`.
    date.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    date.setUTCHours(Number(m[4]), Number(m[5]), Number(m[6]), 0);
    const offset = m[8] === undefined ? 0 : (m[8] === "-" ? -1 : 1) * (Number(m[9]) * 3600 + Number(m[10]) * 60);
    return [date.getTime() / 1000 - offset, m[7] ?? ""];
  };
  const [secondsA, fractionA] = key(a);
  const [secondsB, fractionB] = key(b);
  if (secondsA !== secondsB) return secondsA - secondsB;
  const width = Math.max(fractionA.length, fractionB.length);
  const paddedA = fractionA.padEnd(width, "0");
  const paddedB = fractionB.padEnd(width, "0");
  return paddedA < paddedB ? -1 : paddedA > paddedB ? 1 : 0;
}

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

  /**
   * The start and the end of an Assessment Plan or Assessment Results document (FAC-004 to FAC-007). Each bound is a
   * datetime of the document, or `undefined` when the document has no value for it. Throws an `AccessError` for each
   * other document type.
   */
  assessmentPeriod(): AssessmentPeriod {
    let start: string | undefined;
    let end: string | undefined;
    const addStart = (value: string) => {
      if (start === undefined || compareInstants(value, start) < 0) start = value;
    };
    const addEnd = (value: string) => {
      if (end === undefined || compareInstants(value, end) > 0) end = value;
    };
    if (this.#rootKey === "assessment-plan") {
      const visit = (tasks: readonly Task[] | undefined) => {
        for (const task of tasks ?? []) {
          const onDate = task.timing?.["on-date"];
          const range = task.timing?.["within-date-range"];
          if (onDate !== undefined) {
            addStart(onDate.date);
            addEnd(onDate.date);
          }
          if (range !== undefined) {
            addStart(range.start);
            addEnd(range.end);
          }
          visit(task.tasks);
        }
      };
      visit((this.body as AssessmentPlan).tasks);
    } else if (this.#rootKey === "assessment-results") {
      for (const result of (this.body as AssessmentResults).results) {
        addStart(result.start);
        if (result.end !== undefined) addEnd(result.end);
      }
    } else {
      throw new AccessError(
        this.#rootKey,
        `the assessment period is not defined for a ${this.#rootKey} document`,
      );
    }
    return { start, end };
  }
}
