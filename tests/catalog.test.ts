import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCatalog } from "../shared/catalog";
import {
  aggregateStatus,
  parseStatusDocument,
  uncheckedChannels,
} from "../shared/status";
export const catalog =
  '#EXTM3U\n#EXTINF:-1 tvg-id="a" group-title="Nacional",Canal A\nhttps://a.test/live.m3u8\n#EXTINF:-1 tvg-id="b" group-title="Regional",Canal B\nhttps://b.test/live.m3u8\n#EXTINF:-1 tvg-id="a",Otro nombre\nhttps://a.test/backup.m3u8\n#EXTINF:-1 tvg-id="a",Duplicado\nhttps://a.test/live.m3u8\n';
describe("catalog", () => {
  it("groups by tvg-id, preserves first metadata and order, deduplicates URLs", () => {
    const result = parseCatalog(catalog);
    expect(result.map((c) => c.id)).toEqual(["a", "b"]);
    expect(result[0]).toMatchObject({ name: "Canal A", group: "Nacional" });
    expect(result[0]!.sources).toEqual([
      { url: "https://a.test/live.m3u8", priority: 1 },
      { url: "https://a.test/backup.m3u8", priority: 2 },
    ]);
  });
  it("reflects additions, removals, reordering and changed source URLs", () => {
    const next = parseCatalog(
      '#EXTM3U\n#EXTINF:-1 tvg-id="b",B\nhttps://new.test/b.m3u8\n#EXTINF:-1 tvg-id="c",C\nhttps://new.test/c.m3u8',
    );
    expect(next.map((c) => c.id)).toEqual(["b", "c"]);
    expect(next[0]!.sources[0]!.url).toBe("https://new.test/b.m3u8");
  });
  it("validates the real catalog without freezing future channel counts", () => {
    const actual = parseCatalog(readFileSync("canales.m3u", "utf8"));
    expect(actual.length).toBeGreaterThan(0);
    expect(actual.every((c) => c.sources.length > 0)).toBe(true);
  });
  it.each([
    "",
    "#EXTM3U",
    "#EXTM3U\nhttps://a.test",
    "#EXTM3U\n#EXTINF:-1,No id\nhttps://a.test",
    '#EXTM3U\n#EXTINF:-1 tvg-id="a",A',
    '#EXTM3U\n#EXTINF:-1 tvg-id="a",A\nfile:///tmp/a',
  ])("rejects invalid catalog %s", (text) =>
    expect(() => parseCatalog(text)).toThrow(),
  );
});
describe("aggregation", () => {
  it.each([
    [["unavailable", "available"], "available"],
    [["unavailable", "unavailable"], "unavailable"],
    [["unavailable", "restricted"], "restricted"],
    [["restricted", "inconclusive"], "inconclusive"],
    [["unavailable", "unchecked"], "unchecked"],
    [[], "unchecked"],
  ] as const)("aggregates %j to %s", (states, result) =>
    expect(aggregateStatus(states.map((status) => ({ status })))).toBe(result),
  );
  it("rejects malformed documents and incompatible versions", () => {
    expect(() => parseStatusDocument({ schemaVersion: 2 })).toThrow();
    expect(uncheckedChannels(parseCatalog(catalog))[0]!.status).toBe(
      "unchecked",
    );
  });
});
