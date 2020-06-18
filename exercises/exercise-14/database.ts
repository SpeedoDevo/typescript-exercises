import { promises } from "fs";

const { readFile } = promises;

type QueryType<K extends string, V> = { [k in K]: V };

type InQuery<T> = QueryType<"$in", T[]>;
type EqQuery<T> = QueryType<"$eq", T>;
type AnyQuery<T> = InQuery<T> | EqQuery<T>;

type LTQuery = QueryType<"$lt", number>;
type GTQuery = QueryType<"$gt", number>;
type NumberQuery = LTQuery | GTQuery;

type OrQuery<T> = QueryType<"$or", Query<T>[]>;
type AndQuery<T> = QueryType<"$and", Query<T>[]>;
type CombinedQuery<T> = OrQuery<T> | AndQuery<T>;

type TextQuery = QueryType<"$text", string>;

type SimpleQuery<T> = {
  [k in keyof T]?: T[k] extends number
    ? NumberQuery | AnyQuery<T[k]>
    : AnyQuery<T[k]>;
};

type Query<T> = SimpleQuery<T> | CombinedQuery<T> | TextQuery;

const intersect2 = <T>(a: T[], b: T[]): T[] => {
  const set = new Set(a);
  return b.filter((e) => set.has(e));
};
const intersect = <T>(...arrs: T[][]): T[] => {
  if (!arrs.length) return [];

  const [first, ...rest] = arrs;
  return rest.reduce((p, n) => intersect2(p, n), first);
};

const union = <T>(...arrs: T[][]): T[] => {
  return Array.from(new Set(arrs.reduce((p, n) => p.concat(n), [])));
};

interface Options<T> {
  projection?: { [k in keyof T]?: 1 };
  sort?: { [k in keyof T]?: -1 | 1 };
}

export class Database<T> {
  protected filename: string;
  protected fullTextSearchFieldNames: (keyof T)[];

  constructor(filename: string, fullTextSearchFieldNames: (keyof T)[]) {
    this.filename = filename;
    this.fullTextSearchFieldNames = fullTextSearchFieldNames;
  }

  async find<O extends { projection: { [k in keyof T]?: 1 } }>(
    query: Query<T>,
    options?: Options<T> & O
  ): Promise<Pick<T, keyof O["projection"]>[]>;
  async find(query: Query<T>, options?: Options<T>): Promise<T[]>;
  async find(
    query: Query<T>,
    options?: Options<T>
  ): Promise<(T | Partial<T>)[]> {
    const contents = await readFile(this.filename, "utf-8");
    const records: T[] = contents
      .split("\n")
      .filter((r) => r.startsWith("E"))
      .map((r) => r.slice(1))
      .map((r) => JSON.parse(r));

    let result = this._find(records, query);

    if (options?.sort) {
      const { sort } = options;
      result = [...result];
      const keys = Object.keys(sort) as (keyof T)[];

      result.sort((a, b) => {
        const compares = keys.map((key) => {
          const order = sort[key] ?? 0;
          const aValue = a[key];
          const bValue = b[key];
          if (typeof aValue === "string" && typeof bValue === "string") {
            return aValue.localeCompare(bValue) * order;
          }
          if (typeof aValue === "number" && typeof bValue === "number") {
            return (aValue < bValue ? -1 : 1) * order;
          }
          return 0;
        });

        return compares.find((n) => n !== 0) ?? 0;
      });
    }

    if (options?.projection) {
      const { projection } = options;
      return result.map((record) => {
        const keys = Object.keys(projection) as (keyof T)[];
        return keys.reduce<Partial<T>>((p, n) => {
          p[n] = record[n];
          return p;
        }, {});
      });
    }

    return result;
  }

  private _find(records: T[], query: Query<T>): T[] {
    if ("$text" in query) {
      return records.filter((record) =>
        this.fullTextSearchFieldNames.some((key) => {
          const value = record[key];
          if (typeof value !== "string") return false;
          const words = value.split(/\s+/).map((s) => s.toLowerCase());
          return words.includes(query.$text.toLowerCase());
        })
      );
    }

    if ("$and" in query) {
      const subQueries = query.$and.map((q) => this._find(records, q));
      return intersect(...subQueries);
    }

    if ("$or" in query) {
      const subQueries = query.$or.map((q) => this._find(records, q));
      return union(...subQueries);
    }

    return records.filter((record) => {
      const keys = Object.keys(query) as (keyof T)[];

      return keys.every((key) => {
        const queryObject = query[key];
        const value = record[key];
        if ("$in" in queryObject) return queryObject.$in.includes(value);
        if ("$eq" in queryObject) return queryObject.$eq === value;
        if (typeof value === "number") {
          if ("$lt" in queryObject) return queryObject.$lt > value;
          if ("$gt" in queryObject) return queryObject.$gt < value;
        }
        return false;
      });
    });
  }
}
