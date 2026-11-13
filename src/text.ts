/**
 * The text decode that the JSON pipeline and the YAML reader share (design.md D1). A value that is not text or bytes,
 * and bytes that are not valid UTF-8, give the same `ParseError` for JSON and YAML input.
 */
import { ParseError } from "./errors.ts";

const utf8 = new TextDecoder("utf-8", { fatal: true });

/** The text of an input. Throws a `ParseError` for a value that is not text or bytes, and for bytes that are not UTF-8. */
export function decodeText(input: string | Uint8Array): string {
  if (typeof input === "string") return input;
  if (!(input instanceof Uint8Array)) throw new ParseError("the input is not text or bytes");
  try {
    return utf8.decode(input);
  } catch {
    throw new ParseError("the input is not valid UTF-8");
  }
}
