import { createHash } from "node:crypto";
import { parseCatalog } from "../shared/catalog";
import {
  aggregateStatus,
  type Attempt,
  type SourceResult,
  type StatusDocument,
} from "../shared/status";
import { checkHls } from "./hls";

interface MonitorOptions {
  catalog: string;
  catalogCommit: string;
  origin: StatusDocument["origin"];
  check?: (url: string) => Promise<Attempt>;
  wait?: (ms: number) => Promise<void>;
}
export async function runMonitor(
  options: MonitorOptions,
): Promise<StatusDocument> {
  if (!/^[a-f0-9]{40,64}$/.test(options.catalogCommit))
    throw new Error("Commit del catálogo inválido.");
  const catalog = parseCatalog(options.catalog);
  const jobs = catalog.flatMap((c) =>
    c.sources.map((source) => ({ id: c.id, source })),
  );
  const results = new Map<string, SourceResult>();
  const check = options.check ?? checkHls;
  const wait =
    options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const { id, source } = jobs[cursor++]!;
      const first = await check(source.url);
      const attempts = [first];
      if (first.status === "unavailable") {
        await wait(15_000);
        attempts.push(await check(source.url));
      }
      const last = attempts.at(-1)!;
      // A negative requires two conclusive negatives. A changed outcome stays explicit.
      const confirmed =
        first.status === "unavailable" &&
        last.status === "unavailable" &&
        attempts.length === 2;
      const diagnostic = confirmed
        ? `Indisponibilidad confirmada en dos intentos. ${last.diagnostic}`
        : attempts.length > 1
          ? `Segundo intento: ${last.diagnostic}`
          : last.diagnostic;
      results.set(`${id}\n${source.url}`, {
        ...source,
        ...last,
        diagnostic,
        attempts,
        durationMs: attempts.reduce((sum, a) => sum + a.durationMs, 0),
      });
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, worker));
  const channels = catalog.map((c) => {
    const sources = c.sources.map((s) => results.get(`${c.id}\n${s.url}`)!);
    return { ...c, sources, status: aggregateStatus(sources) };
  });
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    catalogCommit: options.catalogCommit,
    catalogSha256: createHash("sha256").update(options.catalog).digest("hex"),
    origin: options.origin,
    channels,
  };
}
