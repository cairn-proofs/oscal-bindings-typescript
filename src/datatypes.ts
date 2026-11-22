/**
 * The grammars of the datatypes that the schema marks with a `format` keyword (PRS-016 to PRS-019). Ajv does not check
 * `format`. The module `validators.ts` copies each `format` value to the keyword `datatype-grammar`, and that keyword
 * calls the function of this module with the same name. A value must meet its grammar and the pattern of the schema.
 *
 * The URI expressions use the rule names of the ABNF in Appendix A of RFC 3986. Each repeated group has alternatives
 * whose first character sets are disjoint, so no expression backtracks beyond linear time. Each expression compiles
 * once, when the module loads. `$` has no `m` flag, so it matches only at the end of the string.
 */

// RFC 3986 Appendix A, from the character classes to reg-name.
const ALPHA = "A-Za-z";
const DIGIT = "0-9";
const HEXDIG = "0-9A-Fa-f";
const unreserved = `${ALPHA}${DIGIT}\\-._~`;
const subDelims = "!$&'()*+,;=";
const pctEncoded = `%[${HEXDIG}]{2}`;
const pchar = `(?:[${unreserved}${subDelims}:@]|${pctEncoded})`;

const scheme = `[${ALPHA}][${ALPHA}${DIGIT}+\\-.]*`;
const userinfo = `(?:[${unreserved}${subDelims}:]|${pctEncoded})*`;
const decOctet = "(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])";
const IPv4address = `${decOctet}\\.${decOctet}\\.${decOctet}\\.${decOctet}`;
const h16 = `[${HEXDIG}]{1,4}`;
const ls32 = `(?:${h16}:${h16}|${IPv4address})`;
const IPv6address = [
  `(?:${h16}:){6}${ls32}`,
  `::(?:${h16}:){5}${ls32}`,
  `(?:${h16})?::(?:${h16}:){4}${ls32}`,
  `(?:(?:${h16}:){0,1}${h16})?::(?:${h16}:){3}${ls32}`,
  `(?:(?:${h16}:){0,2}${h16})?::(?:${h16}:){2}${ls32}`,
  `(?:(?:${h16}:){0,3}${h16})?::${h16}:${ls32}`,
  `(?:(?:${h16}:){0,4}${h16})?::${ls32}`,
  `(?:(?:${h16}:){0,5}${h16})?::${h16}`,
  `(?:(?:${h16}:){0,6}${h16})?::`,
].join("|");
const IPvFuture = `v[${HEXDIG}]+\\.(?:[${unreserved}${subDelims}:])+`;
const IPLiteral = `\\[(?:${IPv6address}|${IPvFuture})\\]`;
const regName = `(?:[${unreserved}${subDelims}]|${pctEncoded})*`;
const host = `(?:${IPLiteral}|${IPv4address}|${regName})`;
const port = `[${DIGIT}]*`;
const authority = `(?:${userinfo}@)?${host}(?::${port})?`;

// Paths, query and fragment.
const segment = `${pchar}*`;
const segmentNz = `${pchar}+`;
const segmentNzNc = `(?:[${unreserved}${subDelims}@]|${pctEncoded})+`;
const pathAbempty = `(?:/${segment})*`;
const pathAbsolute = `/(?:${segmentNz}(?:/${segment})*)?`;
const pathNoscheme = `${segmentNzNc}(?:/${segment})*`;
const pathRootless = `${segmentNz}(?:/${segment})*`;
const query = `(?:${pchar}|[/?])*`;
const fragment = query;

const hierPart = `(?://${authority}${pathAbempty}|${pathAbsolute}|${pathRootless}|)`;
const relativePart = `(?://${authority}${pathAbempty}|${pathAbsolute}|${pathNoscheme}|)`;
const tail = `(?:\\?${query})?(?:#${fragment})?`;

const uriSource = `${scheme}:${hierPart}${tail}`;
const relativeRef = `${relativePart}${tail}`;

const uriRegExp = new RegExp(`^${uriSource}$`);
// The production URI-reference is URI / relative-ref. A scheme cannot start a relative-ref whose first segment holds
// no colon (path-noscheme), so the two alternatives do not overlap.
const uriReferenceRegExp = new RegExp(`^(?:${uriSource}|${relativeRef})$`);

// RFC 3339 Section 5.6. The ABNF strings are case-insensitive, so `T` and `Z` have both cases.
const fullDate = `[${DIGIT}]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])`;
const partialTime = `(?:[01][0-9]|2[0-3]):[0-5][0-9]:(?:[0-5][0-9]|60)(?:\\.[${DIGIT}]+)?`;
const timeOffset = `(?:[Zz]|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])`;
const dateTimeRegExp = new RegExp(`^${fullDate}[Tt]${partialTime}${timeOffset}$`);

// PRS-018: no character in U+0000 to U+001F or U+007F.
const controlCharacterRegExp = /[\u0000-\u001f\u007f]/;

/** The grammar of each `format` name of the schema, by name. */
export const datatypeGrammars: Readonly<Record<string, (value: string) => boolean>> = {
  /** The production `URI` of RFC 3986 (PRS-017). */
  uri: (value) => uriRegExp.test(value),
  /** The production `URI-reference` of RFC 3986 (PRS-017). */
  "uri-reference": (value) => uriReferenceRegExp.test(value),
  /** No ASCII control character (PRS-018). The pattern of the schema decides the rest. */
  email: (value) => !controlCharacterRegExp.test(value),
  /** The production `date-time` of RFC 3339 (PRS-019). */
  "date-time": (value) => dateTimeRegExp.test(value),
};

/** The message of the error that a value gives when it fails the grammar of a `format` name. */
export const datatypeGrammarMessages: Readonly<Record<string, string>> = {
  uri: "must match the grammar of the RFC 3986 production URI",
  "uri-reference": "must match the grammar of the RFC 3986 production URI-reference",
  email: "must not hold an ASCII control character",
  "date-time": "must match the grammar of the RFC 3339 production date-time",
};
