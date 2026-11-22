/**
 * The evaluator of the constraint manifest (design D2 to D5 of evaluate-constraint-manifest, CNS-006 to CNS-017,
 * CNS-024, CNS-025). It compiles the RFC 9535 queries of the manifest once, on the first call. The compiler reads only
 * the syntax that the manifest of the pinned release uses and throws for any other syntax, so a new release that uses
 * more syntax fails a test and not a user parse.
 *
 * Each document gets one walk that numbers its containers in preorder and indexes the keys that `..['key']` segments
 * use. A `..['key']` segment then needs two binary searches, and no walk of the subtree.
 */
import constraintManifest from "./generated/constraints.json" with { type: "json" };

type Json = unknown;
interface Rec {
  t: F;
  value: Json;
  entries: number[];
}
interface F {
  v: Json;
  up: F | null;
  k: string | number | null;
  pre: number;
  end: number;
  path?: string;
  rec?: Rec;
  kids?: Map<string | number, Rec>;
}

/* ---------- query compiler ---------- */
type Sel =
  | { t: "name"; name: string }
  | { t: "index"; i: number }
  | { t: "all" }
  | { t: "filter"; f: (n: Json) => boolean; names: Set<string> | null };
interface Seg {
  desc: boolean;
  sels: Sel[];
  src: string;
}
export interface Compiled {
  segs: Seg[];
}

const isObj = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);
const isCont = (v: Json): v is object => typeof v === "object" && v !== null;

class P {
  i = 0;
  s: string;
  constructor(s: string) {
    this.s = s;
  }
  ws() {
    while (this.s[this.i] === " ") this.i++;
  }
  eat(t: string): boolean {
    this.ws();
    if (this.s.startsWith(t, this.i)) {
      this.i += t.length;
      return true;
    }
    return false;
  }
  need(t: string) {
    if (!this.eat(t)) throw new Error(`expected ${t} at ${this.i} in ${this.s}`);
  }
  str(): string {
    this.ws();
    const q = this.s[this.i];
    if (q !== "'") throw new Error(`expected string at ${this.i} in ${this.s}`);
    this.i++;
    let out = "";
    while (this.s[this.i] !== "'") {
      if (this.i >= this.s.length) throw new Error("unterminated string");
      if (this.s[this.i] === "\\") {
        out += this.s[this.i + 1];
        this.i += 2;
      } else out += this.s[this.i++];
    }
    this.i++;
    return out;
  }
}

const hasOwn = Object.prototype.hasOwnProperty;
/** A relative query `@...`: the values it selects. */
const NONE = Symbol("none");
/** A relative query that only follows names: the value, or NONE. It allocates nothing. */
function relNames(segs: Seg[]): ((n: Json) => Json) | undefined {
  const names: string[] = [];
  for (const sg of segs) {
    if (sg.desc || sg.sels.length !== 1 || sg.sels[0].t !== "name") return undefined;
    names.push(sg.sels[0].name);
  }
  if (names.length === 1) {
    const k = names[0];
    return (n) =>
      typeof n === "object" && n !== null && !Array.isArray(n) && hasOwn.call(n, k)
        ? (n as Record<string, Json>)[k]
        : NONE;
  }
  return (n) => {
    let cur = n;
    for (const k of names) {
      if (typeof cur !== "object" || cur === null || Array.isArray(cur) || !hasOwn.call(cur, k)) return NONE;
      cur = (cur as Record<string, Json>)[k];
    }
    return cur;
  };
}
function relQuery(p: P): ((n: Json) => Json[]) & { names?: (n: Json) => Json; onlyName?: string } {
  p.need("@");
  const segs = parseSegs(p, undefined);
  const names = relNames(segs);
  const fn = (n: Json) => {
    let cur: Json[] = [n];
    for (const sg of segs) {
      if (sg.desc) throw new Error("unsupported descendant segment in a filter");
      const out: Json[] = [];
      for (const v of cur) {
        if (!isCont(v)) continue;
        for (const s of sg.sels) {
          switch (s.t) {
            case "name":
              if (!Array.isArray(v) && hasOwn.call(v, s.name)) out.push((v as Record<string, Json>)[s.name]);
              break;
            case "index":
              if (Array.isArray(v) && s.i < v.length) out.push(v[s.i]);
              break;
            case "all":
              if (Array.isArray(v)) out.push(...v);
              else out.push(...Object.values(v));
              break;
            case "filter":
              for (const c of Array.isArray(v) ? v : Object.values(v)) if (s.f(c)) out.push(c);
              break;
          }
        }
      }
      cur = out;
      if (cur.length === 0) break;
    }
    return cur;
  };
  const only =
    segs.length === 1 && !segs[0].desc && segs[0].sels.length === 1 && segs[0].sels[0].t === "name"
      ? (segs[0].sels[0] as { name: string }).name
      : undefined;
  return Object.assign(fn, { names, onlyName: only });
}

function iRegexp(pattern: string): RegExp {
  let out = "",
    inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      out += c + (pattern[i + 1] ?? "");
      i++;
    } else if (inClass) {
      if (c === "]") inClass = false;
      out += c;
    } else if (c === "[") {
      inClass = true;
      out += c;
    } else out += c === "." ? "[^\\n\\r]" : c;
  }
  return new RegExp(`^(?:${out})$`, "u");
}

interface Filter {
  fn: (n: Json) => boolean;
  names: Set<string> | null;
}
function filterExpr(p: P): Filter {
  const or = (): Filter => {
    const parts = [and()];
    while (p.eat("||")) parts.push(and());
    if (parts.length === 1) return parts[0];
    const names = parts.every((x) => x.names) ? new Set(parts.flatMap((x) => [...x.names!])) : null;
    return { fn: (n) => parts.some((f) => f.fn(n)), names };
  };
  const and = (): Filter => {
    const parts = [unary()];
    while (p.eat("&&")) parts.push(unary());
    if (parts.length === 1) return parts[0];
    let names = null as Set<string> | null;
    for (const x of parts) {
      const xs = x.names;
      if (xs) names = names ? new Set([...names].filter((v) => xs.has(v))) : xs;
    }
    return { fn: (n) => parts.every((f) => f.fn(n)), names };
  };
  const unary = (): Filter => {
    if (p.eat("!")) {
      const f = unary();
      return { fn: (n) => !f.fn(n), names: null };
    }
    if (p.eat("(")) {
      const f = or();
      p.need(")");
      return f;
    }
    if (p.eat("match(")) {
      const q = relQuery(p);
      p.need(",");
      const re = iRegexp(p.str());
      p.need(")");
      const g = q.names;
      if (g)
        return {
          fn: (n) => {
            const r = g(n);
            return typeof r === "string" && re.test(r);
          },
          names: null,
        };
      return {
        fn: (n) => {
          const r = q(n);
          return r.length === 1 && typeof r[0] === "string" && re.test(r[0]);
        },
        names: null,
      };
    }
    const q = relQuery(p);
    if (p.eat("==")) {
      p.ws();
      const lit = p.str();
      const g = q.names;
      if (g) return { fn: (n) => g(n) === lit, names: q.onlyName === "name" ? new Set([lit]) : null };
      return {
        fn: (n) => {
          const r = q(n);
          return r.length === 1 && r[0] === lit;
        },
        names: null,
      };
    }
    const g = q.names;
    if (g) return { fn: (n) => g(n) !== NONE, names: null };
    return { fn: (n) => q(n).length > 0, names: null };
  };
  const f = or();
  p.ws();
  if (p.i !== p.s.length) throw new Error(`trailing input at ${p.i} in ${p.s}`);
  return f;
}

function parseSegs(p: P, descKeys: Set<string> | undefined): Seg[] {
  const query = p.s;
  const segs: Seg[] = [];
  for (;;) {
    p.ws();
    if (p.i >= query.length || (query[p.i] !== "[" && !query.startsWith("..", p.i))) break;
    const segStart = p.i;
    const desc = p.eat("..");
    p.need("[");
    const sels: Sel[] = [];
    do {
      p.ws();
      const c = p.s[p.i];
      if (c === "'") sels.push({ t: "name", name: p.str() });
      else if (c === "*") {
        p.i++;
        sels.push({ t: "all" });
      } else if (c === "?") {
        p.i++;
        let depth = 0,
          j = p.i,
          inStr = false;
        for (; j < query.length; j++) {
          const ch = query[j];
          if (inStr) {
            if (ch === "\\") j++;
            else if (ch === "'") inStr = false;
          } else if (ch === "'") inStr = true;
          else if (ch === "[") depth++;
          else if (ch === "]") {
            if (depth === 0) break;
            depth--;
          }
        }
        {
          const fx = filterExpr(new P(query.slice(p.i, j)));
          sels.push({ t: "filter", f: fx.fn, names: fx.names });
        }
        p.i = j;
      } else if (/[0-9]/.test(c)) {
        let j = p.i;
        while (/[0-9]/.test(query[j])) j++;
        sels.push({ t: "index", i: Number(query.slice(p.i, j)) });
        p.i = j;
      } else throw new Error(`unsupported selector at ${p.i} in ${query}`);
    } while (p.eat(","));
    p.need("]");
    if (desc) {
      if (descKeys === undefined) throw new Error("descendant segment in a filter");
      for (const s of sels) {
        if (s.t !== "name") throw new Error(`unsupported descendant selector in ${query}`);
        descKeys.add(s.name);
      }
    }
    segs.push({ desc, sels, src: query.slice(segStart, p.i) });
  }
  return segs;
}

export function compile(query: string, descKeys: Set<string>): Compiled {
  try {
    const p = new P(query);
    p.need("$");
    const segs = parseSegs(p, descKeys);
    if (p.i !== query.length) throw new Error(`trailing input at ${p.i}`);
    return { segs };
  } catch (error) {
    throw new Error(`the constraint query ${query} is not supported: ${(error as Error).message}`, { cause: error });
  }
}

/* ---------- per-document walk ---------- */
export class Doc {
  frames = new Map<object, F>();
  idxPre = new Map<string, number[]>();
  idxFrame = new Map<string, F[]>();
  root: F;
  constructor(data: Json, descKeys: Set<string>) {
    for (const k of descKeys) {
      this.idxPre.set(k, []);
      this.idxFrame.set(k, []);
    }
    let pre = 0;
    const frames = this.frames,
      idxPre = this.idxPre,
      idxFrame = this.idxFrame;
    const walk = (v: object, up: F | null, k: string | number | null): F => {
      const f: F = { v, up, k, pre: pre++, end: 0 };
      frames.set(v, f);
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          const c = v[i];
          if (typeof c === "object" && c !== null) walk(c, f, i);
        }
      } else {
        for (const key in v as Record<string, Json>) {
          const c = (v as Record<string, Json>)[key];
          const ip = idxPre.get(key);
          if (ip !== undefined) {
            ip.push(f.pre);
            idxFrame.get(key)!.push(f);
          }
          if (typeof c === "object" && c !== null) walk(c, f, key);
        }
      }
      f.end = pre;
      return f;
    };
    this.root = isCont(data) ? walk(data, null, null) : { v: data, up: null, k: null, pre: 0, end: 1 };
  }
  child(f: F, k: string | number): F {
    const c = (f.v as never)[k] as Json;
    if (typeof c === "object" && c !== null) return this.frames.get(c)!;
    return { v: c, up: f, k, pre: -1, end: -1 };
  }
  descNamed(f: F, key: string, out: F[]) {
    if (f.pre < 0) return;
    const ip = this.idxPre.get(key)!,
      ifr = this.idxFrame.get(key)!;
    let lo = 0,
      hi = ip.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ip[m] < f.pre) lo = m + 1;
      else hi = m;
    }
    for (let i = lo; i < ip.length && ip[i] < f.end; i++) out.push(this.child(ifr[i], key));
  }
  applySel(f: F, s: Sel, out: F[]) {
    const v = f.v;
    if (!isCont(v)) return;
    switch (s.t) {
      case "name":
        if (!Array.isArray(v) && hasOwn.call(v, s.name)) out.push(this.child(f, s.name));
        break;
      case "index":
        if (Array.isArray(v) && s.i < v.length) out.push(this.child(f, s.i));
        break;
      case "all":
        if (Array.isArray(v)) for (let i = 0; i < v.length; i++) out.push(this.child(f, i));
        else for (const k in v as object) out.push(this.child(f, k));
        break;
      case "filter":
        if (Array.isArray(v)) {
          for (let i = 0; i < v.length; i++) if (s.f(v[i])) out.push(this.child(f, i));
        } else
          for (const k in v as Record<string, Json>)
            if (s.f((v as Record<string, Json>)[k])) out.push(this.child(f, k));
        break;
    }
  }
  /** Runs the segments from `start`. */
  run(segs: Seg[], from: number, start: F[]): F[] {
    let cur = start;
    for (let si = from; si < segs.length; si++) {
      const seg = segs[si],
        out: F[] = [];
      for (const f of cur) {
        if (seg.desc) {
          for (const s of seg.sels) this.descNamed(f, (s as { name: string }).name, out);
        } else for (const s of seg.sels) this.applySel(f, s, out);
      }
      cur = out;
      if (cur.length === 0) break;
    }
    return cur;
  }
  /** A query on the document. */
  runDoc(q: Compiled): F[] {
    return this.run(q.segs, 0, [this.root]);
  }
  /** A query on an array that holds only `ctx`. */
  runOn(q: Compiled, ctx: F): F[] {
    return this.runSegs(q.segs, ctx);
  }
  runSegs(segs: Seg[], ctx: F): F[] {
    const q = { segs };
    const seg0 = q.segs[0];
    if (seg0 === undefined) return []; // `$` alone selects the wrapper array
    if (seg0.desc) return this.run(q.segs, 0, [ctx]);
    const first: F[] = [];
    for (const s of seg0.sels) {
      if (s.t === "index" ? s.i === 0 : s.t === "all" ? true : s.t === "filter" ? s.f(ctx.v) : false) first.push(ctx);
    }
    return this.run(q.segs, 1, first);
  }
}

const token = (k: string | number) => String(k).replace(/~/g, "~0").replace(/\//g, "~1");
/** The JSON Pointer of a node, from the root of the document. */
export function pointerOf(f: F): string {
  if (f.path !== undefined) return f.path;
  const p = f.up === null ? "" : `${pointerOf(f.up)}/${token(f.k!)}`;
  f.path = p;
  return p;
}
/** An identity for a node: the frame object of a container, or a string for a primitive. */
const nodeKey = (f: F): F | string => (f.pre >= 0 ? f : `${f.up!.pre}/${String(f.k)}`);
const dedupe = (hits: F[]): F[] => {
  if (hits.length < 2) return hits;
  const seen = new Set<F | string>();
  const out: F[] = [];
  for (const h of hits) {
    const id = nodeKey(h);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(h);
    }
  }
  return out;
};

/* ---------- manifest ---------- */
interface Entry {
  id: string | null;
  kind: string;
  context: { document: string[] };
  target: string[];
  values?: string[];
  "allow-other"?: boolean;
  pattern?: string;
  "min-occurs"?: number;
  "max-occurs"?: number;
  "index-name"?: string;
  partial?: boolean;
  test?: string;
  "key-fields"?: Array<{ target: string[]; prefix?: string }>;
}
interface Group {
  ctxEntry: number;
  prefix: Seg[];
  j: number;
  suffix: Seg[];
  byName: Map<string, number[]>;
  any: number[];
}
interface CEntry {
  group?: Group;
  filterFn?: (n: Json) => boolean;
  /** The only target query is `$[0]`: the target is the context node. */
  self?: boolean;
  e: Entry;
  ctx: Compiled[];
  target: Compiled[];
  keyFields?: Array<{ target: Compiled[]; prefix?: string }>;
  test?: Compiled;
  re?: RegExp;
}
/** One constraint failure: the `id` of the entry, the JSON Pointer of the failing node, and for a key, the key. */
export interface ConstraintFailure {
  readonly id: string;
  readonly location: string;
  readonly key?: string;
}

export class Manifest {
  entries: CEntry[];
  descKeys = new Set<string>();
  /** Entries with the same document context queries share one list of context nodes. */
  ctxSig: string[] = [];
  constructor(entries: Entry[]) {
    const c = (q: string) => compile(q, this.descKeys);
    const sigs = new Map<string, number>();
    this.ctxSig = entries.map((e) => {
      const k = JSON.stringify(e.context.document);
      if (!sigs.has(k)) sigs.set(k, sigs.size);
      return String(sigs.get(k));
    });
    this.entries = entries.map((e) => ({
      e,
      ctx: e.context.document.map(c),
      target: e.target.map(c),
      keyFields: e["key-fields"]?.map((kf) => ({ target: kf.target.map(c), prefix: kf.prefix })),
      test: e.test === undefined ? undefined : c(e.test),
      re: e.pattern === undefined ? undefined : iRegexp(e.pattern),
    }));
    for (const ce of this.entries) {
      if (ce.target.length === 1) {
        const sg = ce.target[0].segs;
        if (
          sg.length === 1 &&
          !sg[0].desc &&
          sg[0].sels.length === 1 &&
          sg[0].sels[0].t === "index" &&
          (sg[0].sels[0] as { i: number }).i === 0
        )
          ce.self = true;
      }
    }
    // Group the allowed-values entries that differ only in one filter, so that the children of a context node are read once.
    const groups = new Map<string, Group>();
    this.entries.forEach((ce, i) => {
      if (ce.e.kind !== "allowed-values" || ce.target.length !== 1) return;
      const segs = ce.target[0].segs;
      const fj = segs.map((sg, j) => (sg.sels.some((x) => x.t === "filter") ? j : -1)).filter((j) => j >= 0);
      if (fj.length !== 1) return;
      const j = fj[0],
        sg = segs[j];
      if (sg.desc || sg.sels.length !== 1 || (j === 0 && false)) return;
      const f = sg.sels[0] as Extract<Sel, { t: "filter" }>;
      const key = `${this.ctxSig[i]}|${segs
        .slice(0, j)
        .map((x) => x.src)
        .join("")}|${segs
        .slice(j + 1)
        .map((x) => x.src)
        .join("")}`;
      let g = groups.get(key);
      if (!g) {
        g = { ctxEntry: i, prefix: segs.slice(0, j), j, suffix: segs.slice(j + 1), byName: new Map(), any: [] };
        groups.set(key, g);
      }
      if (f.names === null) g.any.push(i);
      else
        for (const n of f.names) {
          const l = g.byName.get(n);
          if (l) l.push(i);
          else g.byName.set(n, [i]);
        }
      ce.group = g;
      ce.filterFn = f.f;
    });
    this.groups = [...new Set(this.entries.map((x) => x.group).filter((g): g is Group => g !== undefined))];
  }
  groups: Group[] = [];

  evaluate(data: Json): ConstraintFailure[] {
    const doc = new Doc(data, this.descKeys);
    const entries = this.entries;
    const failures: ConstraintFailure[] = [];
    const reported = new Set<string>();
    const add = (i: number, location: string, key?: string) => {
      const dedupeKey = JSON.stringify([i, location, key ?? null]);
      if (reported.has(dedupeKey)) return;
      reported.add(dedupeKey);
      const id = entries[i].e.id;
      // CNS-021: an entry that can fail has an id. A missing id is a defect of the manifest and not of the input.
      if (typeof id !== "string")
        throw new Error(`the constraint manifest has an entry with no id that failed at ${location}`);
      failures.push(key === undefined ? { id, location } : { id, location, key });
    };
    const ctxCache = new Map<Compiled, F[]>();
    const runDoc = (q: Compiled) => {
      let r = ctxCache.get(q);
      if (!r) {
        r = doc.runDoc(q);
        ctxCache.set(q, r);
      }
      return r;
    };
    const ctxBySig = new Map<string, F[]>();
    const shapes = new Map<string, F[][]>();
    const listIdOf = new Map<F[], number>();
    const contexts = (ce: CEntry, i: number): F[] => {
      const sig = this.ctxSig[i];
      let r = ctxBySig.get(sig);
      if (!r) {
        r = dedupe(ce.ctx.length === 1 ? runDoc(ce.ctx[0]) : ce.ctx.flatMap(runDoc));
        // Lists with the same nodes get one id, so that the groups of entries that start at them are one pass.
        const nk = (f: F) =>
          f.pre >= 0 ? f.pre : f.up!.pre * 1e6 + 1e5 + (typeof f.k === "number" ? f.k : f.k!.length);
        const shape = r.length === 0 ? "0" : `${r.length}|${nk(r[0])}|${nk(r[r.length - 1])}`;
        const cands = shapes.get(shape) ?? [];
        const same = cands.find((c) => c.length === r!.length && c.every((f, j) => nodeKey(f) === nodeKey(r![j])));
        if (same) r = same;
        else {
          cands.push(r);
          shapes.set(shape, cands);
          listIdOf.set(r, listIdOf.size);
        }
        ctxBySig.set(sig, r);
      }
      return r;
    };
    const targetsOf = (ce: CEntry, ctx: F): F[] =>
      ce.self
        ? [ctx]
        : dedupe(ce.target.length === 1 ? doc.runOn(ce.target[0], ctx) : ce.target.flatMap((q) => doc.runOn(q, ctx)));
    const keysOf = (ce: CEntry, t: F): string[] => {
      const kfs = ce.keyFields!;
      if (kfs.length === 1 && kfs[0].target.length === 1) {
        const kf = kfs[0];
        const hits = dedupe(doc.runOn(kf.target[0], t));
        if (hits.length === 0) return [];
        const out: string[] = [];
        for (const h of hits) {
          const v = String(h.v);
          if (kf.prefix === undefined) out.push("=" + v);
          else if (v.startsWith(kf.prefix)) out.push("=" + v.slice(kf.prefix.length));
        }
        return out;
      }
      const lists = ce.keyFields!.map((kf) => {
        const values = dedupe(kf.target.flatMap((q) => doc.runOn(q, t))).map((h) => String(h.v));
        if (values.length === 0) return [null];
        if (kf.prefix === undefined) return values;
        const prefix = kf.prefix;
        return values.map((v) => (v.startsWith(prefix) ? v.slice(prefix.length) : null));
      });
      let keys: Array<Array<string | null>> = [[]];
      for (const l of lists) keys = keys.flatMap((k) => l.map((v) => [...k, v]));
      return keys
        .filter((k) => k.some((v) => v !== null))
        .map((k) => JSON.stringify(k.map((v) => (v === null ? "\u0000" : `=${v}`))));
    };

    const recs: Rec[] = [];
    const recOf = (t: F): Rec => {
      if (t.pre >= 0) {
        if (!t.rec) {
          t.rec = { t, value: t.v, entries: [] };
          recs.push(t.rec);
        }
        return t.rec;
      }
      const up = t.up!;
      const kids = up.kids ?? (up.kids = new Map());
      let r = kids.get(t.k!);
      if (!r) {
        r = { t, value: t.v, entries: [] };
        kids.set(t.k!, r);
        recs.push(r);
      }
      return r;
    };
    const indexes = new Map<string, Map<string, Array<{ t: F; entry: number }>>>();
    const indexed = new Map<string, Set<F | string>>();
    const merged = new Map<string, { ctxs: F[]; prefix: Seg[]; members: Group[] }>();
    for (const g of this.groups) {
      const ctxs = contexts(this.entries[g.ctxEntry], g.ctxEntry);
      const key = `${listIdOf.get(ctxs)}|${g.prefix.map((x) => x.src).join("")}`;
      const m = merged.get(key);
      if (m) m.members.push(g);
      else merged.set(key, { ctxs, prefix: g.prefix, members: [g] });
    }
    for (const m of merged.values()) {
      const members = m.members;
      const visit = (parent: F | null, key: string | number | null, value: Json, self?: F) => {
        const name =
          typeof value === "object" && value !== null && !Array.isArray(value)
            ? (value as Record<string, Json>).name
            : undefined;
        for (let mi = 0; mi < members.length; mi++) {
          const g = members[mi];
          const byName = typeof name === "string" ? g.byName.get(name) : undefined;
          if (byName === undefined && g.any.length === 0) continue;
          const run = (i: number) => {
            if (!this.entries[i].filterFn!(value)) return;
            const child = self ?? doc.child(parent!, key!);
            const targets = g.suffix.length === 0 ? [child] : doc.run(g.suffix, 0, [child]);
            for (const t of dedupe(targets)) {
              const r = recOf(t);
              if (!r.entries.includes(i)) r.entries.push(i);
            }
          };
          if (byName) for (const i of byName) run(i);
          for (const i of g.any) run(i);
        }
      };
      for (const ctx of m.ctxs) {
        if (m.prefix.length === 0) {
          visit(null, null, ctx.v, ctx);
          continue;
        }
        for (const f of doc.runSegs(m.prefix, ctx)) {
          const v = f.v;
          if (typeof v !== "object" || v === null) continue;
          if (Array.isArray(v)) {
            for (let k = 0; k < v.length; k++) visit(f, k, v[k]);
          } else for (const k in v as Record<string, Json>) visit(f, k, (v as Record<string, Json>)[k]);
        }
      }
    }
    for (const phase of ["index", "other"] as const) {
      for (let i = 0; i < entries.length; i++) {
        const ce = entries[i],
          e = ce.e;
        if ((e.kind === "index") !== (phase === "index")) continue;
        if (ce.group) continue;
        for (const ctx of contexts(ce, i)) {
          const targets = targetsOf(ce, ctx);
          switch (e.kind) {
            case "allowed-values":
              for (const t of targets) {
                const r = recOf(t);
                if (!r.entries.includes(i)) r.entries.push(i);
              }
              break;
            case "matches":
              for (const t of targets) if (!(typeof t.v === "string" && ce.re!.test(t.v))) add(i, pointerOf(t));
              break;
            case "has-cardinality":
              if (
                (e["min-occurs"] !== undefined && targets.length < e["min-occurs"]) ||
                (e["max-occurs"] !== undefined && targets.length > e["max-occurs"])
              )
                add(i, pointerOf(ctx));
              break;
            case "is-unique": {
              const seen = new Set<string>();
              for (const t of targets)
                for (const key of keysOf(ce, t)) {
                  if (seen.has(key)) add(i, pointerOf(t), key);
                  else seen.add(key);
                }
              break;
            }
            case "index": {
              const name = e["index-name"]!;
              const members = indexed.get(name) ?? new Set<F | string>();
              indexed.set(name, members);
              const index = indexes.get(name) ?? new Map();
              indexes.set(name, index);
              for (const t of targets) {
                const nk = nodeKey(t);
                if (members.has(nk)) continue;
                members.add(nk);
                for (const key of keysOf(ce, t)) {
                  const l = index.get(key);
                  if (l) l.push({ t, entry: i });
                  else index.set(key, [{ t, entry: i }]);
                }
              }
              break;
            }
            case "index-has-key": {
              if (e.partial) break;
              const index = indexes.get(e["index-name"]!);
              for (const t of targets) for (const key of keysOf(ce, t)) if (!index?.has(key)) add(i, pointerOf(t), key);
              break;
            }
            case "expect":
              for (const t of targets) if (doc.runOn(ce.test!, t).length === 0) add(i, pointerOf(t));
              break;
          }
        }
      }
    }
    for (const index of indexes.values())
      for (const [key, members] of index)
        for (let j = 1; j < members.length; j++) add(members[j].entry, pointerOf(members[j].t), key);
    for (const { t, value, entries: set } of recs) {
      if (set.some((i) => entries[i].e.values!.includes(String(value)))) continue;
      for (const i of set) if (!entries[i].e["allow-other"]) add(i, pointerOf(t));
    }
    return failures;
  }
}

let compiled: Manifest | undefined;

/** The compiled manifest of the pinned release. The first call compiles it. */
export function loadManifest(): Manifest {
  compiled ??= new Manifest((constraintManifest as unknown as { entries: Entry[] }).entries);
  return compiled;
}

/** The constraint failures of a JSON value that conforms to the schema (CNS-017). */
export function constraintFailures(value: unknown): ConstraintFailure[] {
  return loadManifest().evaluate(value);
}
