import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses a plain two-column body", () => {
    expect(parseCsv("Alice, @alice\nBob, @bob")).toEqual([
      ["Alice", " @alice"],
      ["Bob", " @bob"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("Alice,@alice\r\nBob,@bob\r\n")).toEqual([
      ["Alice", "@alice"],
      ["Bob", "@bob"],
    ]);
  });

  it("handles quoted fields with commas inside", () => {
    expect(parseCsv('"Chen, Alice","@alice"')).toEqual([
      ["Chen, Alice", "@alice"],
    ]);
  });

  it("handles escaped double-quotes", () => {
    expect(parseCsv('"she said ""hi"""')).toEqual([['she said "hi"']]);
  });

  it("drops fully-blank rows", () => {
    expect(parseCsv("Alice,@alice\n\n\nBob,@bob")).toEqual([
      ["Alice", "@alice"],
      ["Bob", "@bob"],
    ]);
  });

  it("returns trailing row without a newline", () => {
    expect(parseCsv("Alice,@alice")).toEqual([["Alice", "@alice"]]);
  });

  it("returns empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\n\n")).toEqual([]);
  });
});
