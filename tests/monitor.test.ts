import { describe, expect, it, vi } from "vitest";
import { runMonitor } from "../monitor/run";
import { parseStatusDocument, type Attempt } from "../shared/status";
const catalog = '#EXTM3U\n#EXTINF:-1 tvg-id="a",A\nhttps://a.test/live\n';
const attempt = (status: Attempt["status"]): Attempt => ({
  status,
  diagnostic: status,
  durationMs: 12,
  checkedAt: new Date().toISOString(),
});
const options = {
  catalog,
  catalogCommit: "a".repeat(40),
  origin: { name: "Test", runUrl: null },
};
describe("monitor", () => {
  it("confirms conclusive negative results after 15 seconds and records both attempts", async () => {
    const check = vi.fn(async () => attempt("unavailable"));
    const wait = vi.fn(async () => {});
    const report = parseStatusDocument(
      await runMonitor({ ...options, check, wait }),
    );
    expect(wait).toHaveBeenCalledWith(15_000);
    expect(check).toHaveBeenCalledTimes(2);
    expect(report.channels[0]!.status).toBe("unavailable");
    expect(report.channels[0]!.sources[0]!.attempts).toHaveLength(2);
    expect(report.catalogCommit).toBe(options.catalogCommit);
  });
  it.each(["available", "restricted", "inconclusive"] as const)(
    "does not confirm %s as unavailable",
    async (status) => {
      const check = vi
        .fn()
        .mockResolvedValueOnce(attempt("unavailable"))
        .mockResolvedValueOnce(attempt(status));
      const report = await runMonitor({
        ...options,
        check,
        wait: async () => {},
      });
      expect(report.channels[0]!.status).toBe(status);
    },
  );
  it("publishes individual errors but fails the complete run on an unexpected global failure", async () => {
    expect(
      (
        await runMonitor({
          ...options,
          check: async () => attempt("inconclusive"),
        })
      ).channels[0]!.status,
    ).toBe("inconclusive");
    await expect(
      runMonitor({
        ...options,
        check: async () => {
          throw new Error("bug");
        },
      }),
    ).rejects.toThrow("bug");
    await expect(
      runMonitor({ ...options, catalog: "invalid" }),
    ).rejects.toThrow();
  });
  it("limits parallel source checks to four while preserving catalog order", async () => {
    let active = 0;
    let peak = 0;
    const text =
      "#EXTM3U\n" +
      Array.from(
        { length: 11 },
        (_, i) => `#EXTINF:-1 tvg-id="${i}",Canal ${i}\nhttps://a.test/${i}`,
      ).join("\n");
    const report = await runMonitor({
      ...options,
      catalog: text,
      check: async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 3));
        active--;
        return attempt("available");
      },
    });
    expect(peak).toBe(4);
    expect(report.channels.map((c) => c.id)).toEqual(
      Array.from({ length: 11 }, (_, i) => String(i)),
    );
  });
});

it("does not make the confirming attempt until the full 15 second interval has elapsed", async () => {
  vi.useFakeTimers();
  try {
    const check = vi.fn(async () => attempt("unavailable"));
    const pending = runMonitor({ ...options, check });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(check).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
