import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datatypeGrammars } from "../src/datatypes.ts";

/** A row names the value and the ABNF rule, or the case, that the row tests. */
type Row = readonly [value: string, rule: string];

function check(name: string, accepted: readonly Row[], rejected: readonly Row[]): void {
  const grammar = datatypeGrammars[name];
  describe(name, () => {
    for (const [value, rule] of accepted) {
      it(`accepts ${JSON.stringify(value)} (${rule})`, () => assert.equal(grammar(value), true));
    }
    for (const [value, rule] of rejected) {
      it(`rejects ${JSON.stringify(value)} (${rule})`, () => assert.equal(grammar(value), false));
    }
  });
}

const uriAccepted: Row[] = [
  ["a:", "scheme, path-empty"],
  ["http://example.com", "scheme, authority, reg-name, path-abempty"],
  ["http://user:pw@example.com", "userinfo"],
  ["http://user%20x@example.com", "userinfo, pct-encoded"],
  ["http://example.com:8080/x", "port"],
  ["http://example.com:/x", "port, empty"],
  ["http://127.0.0.1/", "IPv4address, dec-octet"],
  ["http://255.249.200.10/", "dec-octet 25x, 2xx, 1xx"],
  ["http://[::1]/", "IP-literal, IPv6address"],
  ["http://[2001:db8::7]/", "IPv6address, h16 before ::"],
  ["http://[1:2:3:4:5:6:7:8]/", "IPv6address, 6( h16 : ) ls32"],
  ["http://[1:2:3:4:5:6:1.2.3.4]/", "IPv6address, ls32 as IPv4address"],
  ["http://[::ffff:1.2.3.4]/", "IPv6address, :: with IPv4address"],
  ["http://[1::]/", "IPv6address, ending in ::"],
  ["http://[v1.fe80]/", "IPvFuture"],
  ["http://exa%6dple.com/", "reg-name, pct-encoded"],
  ["urn:oasis:names:specification:docbook:dtd:xml:4.1.2", "path-rootless"],
  ["mailto:a@b", "path-rootless, @ in pchar"],
  ["file:///etc/hosts", "authority empty, path-abempty"],
  ["a:/b/c", "path-absolute"],
  ["a:/", "path-absolute, no segment-nz"],
  ["a+b-c.d:x", "scheme characters"],
  ["http://x/?q=1&r=a/b?c", "query, / and ? in query"],
  ["http://x/#frag/ment?x", "fragment"],
  ["http://x/%41%7a", "pct-encoded, hex in both cases"],
  ["http://x/a;b=c,d", "sub-delims in path"],
  ["http://x/~a_b.c-d", "unreserved"],
];
const uriRejected: Row[] = [
  ["", "no scheme"],
  ["//example.com", "relative-ref, not URI"],
  ["a b:c", "space in scheme"],
  ["1a:b", "scheme starts with a digit"],
  ["http://x/a b", "space"],
  ["http://x/a\\b", "backslash"],
  ["http://x/é", "non-ASCII character"],
  ["http://[::1/", "open bracket"],
  ["http://x]/", "close bracket in reg-name"],
  ["http://x/\u0000", "control character"],
  ["http://x/\n", "final line feed"],
  ["http://x/%zz", "bad escape"],
  ["http://x/%4", "short escape"],
  ["http://x/<", "angle bracket"],
  ["http://x:80a/", "non-digit in port"],
  ["http://256.0.0.1:x/", "dec-octet over 255, then bad port"],
  ["http://[1:2:3:4:5:6:7:8:9]/", "too many h16"],
  ["http://[12345::]/", "h16 over four digits"],
  ["http://[::1::2]/", "two ::"],
  ["http://[v.x]/", "IPvFuture without HEXDIG"],
  ["http://x/?a#b#c", "second #"],
  ["http://x/a|b", "vertical bar"],
];
check("uri", uriAccepted, uriRejected);

check(
  "uri-reference",
  [
    ...uriAccepted,
    ["", "relative-ref, path-empty"],
    ["//example.com", "relative-part, authority"],
    ["//example.com/a", "relative-part, authority, path-abempty"],
    ["/a/b", "path-absolute"],
    ["a/b", "path-noscheme"],
    ["a@b/c", "path-noscheme, @"],
    ["../a", "path-noscheme, dot segments"],
    ["?q", "query only"],
    ["#f", "fragment only"],
    ["a?q#f", "path-noscheme, query, fragment"],
    ["./a:b", "colon after the first segment"],
  ],
  [
    ["a b", "space"],
    ["a\\b", "backslash"],
    ["é", "non-ASCII character"],
    ["a[b", "open bracket"],
    ["a\u0001", "control character"],
    ["a\n", "final line feed"],
    ["a%zz", "bad escape"],
    ["a#b#c", "second #"],
    ["1a:b", "colon in the first segment, no scheme"],
    ["//[::1", "open bracket in authority"],
    ["//x:80a/", "non-digit in port"],
  ],
);

check(
  "email",
  [
    ["a@b", "no rule beyond control characters"],
    ["用户@例子.广告", "non-ASCII address"],
    ["", "empty, pattern decides"],
    ["a b@c", "space U+0020 is not a control character"],
    ["a\u0080@b", "U+0080 is outside both ranges"],
    ["a\u009f@b", "U+009F is outside both ranges"],
  ],
  [
    ["a\u0000@b", "U+0000, start of the first range"],
    ["a\u001f@b", "U+001F, end of the first range"],
    ["a\u007f@b", "U+007F, the second range"],
    ["a@b\n", "final line feed"],
    ["a\t@b", "tab"],
  ],
);

check(
  "date-time",
  [
    ["2024-02-29T12:00:00Z", "full-date, T, partial-time, Z"],
    ["2024-02-29t12:00:00z", "lower case t and z"],
    ["2024-02-29T12:00:00+01:00", "time-numoffset, plus"],
    ["2024-02-29T12:00:00-23:59", "time-numoffset, minus"],
    ["2024-02-29T12:00:00.123456Z", "time-secfrac"],
    ["2016-12-31T23:59:60Z", "leap second"],
    ["2024-12-31T00:00:00Z", "date-month 12, day 31"],
    ["2024-02-31T00:00:00Z", "day 31 in any month, the calendar is not in the grammar"],
  ],
  [
    ["2024-02-29T12:00:00", "missing offset"],
    ["2024-02-29T12:00Z", "missing second"],
    ["24-02-29T12:00:00Z", "two-digit year"],
    ["2024-13-01T00:00:00Z", "month 13"],
    ["2024-00-01T00:00:00Z", "month 00"],
    ["2024-01-32T00:00:00Z", "day 32"],
    ["2024-01-00T00:00:00Z", "day 00"],
    ["2024-01-01T24:00:00Z", "hour 24"],
    ["2024-01-01T00:60:00Z", "minute 60"],
    ["2024-01-01T00:00:61Z", "second 61"],
    ["2024-01-01T00:00:00.Z", "time-secfrac without digit"],
    ["2024-01-01 00:00:00Z", "space instead of T"],
    ["2024-01-01T00:00:00+0100", "offset without colon"],
    ["2024-01-01T00:00:00+24:00", "offset hour 24"],
    ["2024-01-01T00:00:00Z\n", "final line feed"],
    ["", "empty"],
  ],
);

describe("time limit", () => {
  // A string of 1 MiB built to cause backtracking in a nested quantifier. Each function must finish in linear time.
  const size = 1024 * 1024;
  const inputs: Array<[string, string]> = [
    ["uri", `a:${"a".repeat(size)}\u0000`],
    ["uri", `a://${"a".repeat(size)}[`],
    ["uri", `a://${"a:".repeat(size / 2)}[`],
    ["uri", `a:${"%41".repeat(size / 3)}%`],
    ["uri", `a:${"/a".repeat(size / 2)} `],
    ["uri-reference", `${"a".repeat(size)}\u0000`],
    ["uri-reference", `//${"a@".repeat(size / 2)}[`],
    ["uri-reference", `${"a/".repeat(size / 2)} `],
    ["email", `${"a".repeat(size)}\u0000`],
    ["date-time", `2024-01-01T00:00:00.${"1".repeat(size)}`],
  ];
  for (const [name, input] of inputs) {
    it(`${name} ends within one second on ${input.slice(0, 8).replace(/[^\x20-\x7e]/g, "?")}... (1 MiB)`, () => {
      const start = performance.now();
      datatypeGrammars[name](input);
      const elapsed = performance.now() - start;
      assert.ok(elapsed < 1000, `${name} took ${elapsed.toFixed(0)} ms`);
    });
  }
});
