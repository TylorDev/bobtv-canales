export const STATUS_LABELS = {
  available: "Disponible",
  unavailable: "No disponible",
  restricted: "Acceso restringido",
  inconclusive: "No concluyente",
  unchecked: "Sin comprobar",
} as const;
export type Status = keyof typeof STATUS_LABELS;
export interface CatalogSource {
  url: string;
  priority: number;
}
export interface CatalogChannel {
  id: string;
  name: string;
  group: string;
  sources: CatalogSource[];
}
export interface Attempt {
  status: Exclude<Status, "unchecked">;
  diagnostic: string;
  httpStatus?: number;
  durationMs: number;
  checkedAt: string;
}
export interface SourceResult extends CatalogSource {
  status: Status;
  diagnostic: string;
  httpStatus?: number;
  durationMs: number;
  checkedAt: string | null;
  attempts: Attempt[];
}
export interface ChannelResult extends Omit<CatalogChannel, "sources"> {
  status: Status;
  sources: SourceResult[];
}
export interface StatusDocument {
  schemaVersion: 1;
  generatedAt: string;
  catalogCommit: string;
  catalogSha256: string;
  origin: { name: string; runUrl: string | null };
  channels: ChannelResult[];
}
export function aggregateStatus(
  sources: Pick<SourceResult, "status">[],
): Status {
  if (!sources.length) return "unchecked";
  if (sources.some((s) => s.status === "available")) return "available";
  if (sources.every((s) => s.status === "unavailable")) return "unavailable";
  if (sources.some((s) => s.status === "unchecked")) return "unchecked";
  if (sources.some((s) => s.status === "inconclusive")) return "inconclusive";
  return "restricted";
}
export function uncheckedChannels(catalog: CatalogChannel[]): ChannelResult[] {
  return catalog.map((c) => ({
    ...c,
    status: "unchecked",
    sources: c.sources.map((s) => ({
      ...s,
      status: "unchecked",
      diagnostic: "Aún no hay una comprobación publicada.",
      durationMs: 0,
      checkedAt: null,
      attempts: [],
    })),
  }));
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}
function isStatus(value: unknown): value is Status {
  return typeof value === "string" && Object.hasOwn(STATUS_LABELS, value);
}
function validMeasurement(s: Record<string, unknown>): boolean {
  return (
    typeof s.diagnostic === "string" &&
    typeof s.durationMs === "number" &&
    Number.isFinite(s.durationMs) &&
    s.durationMs >= 0 &&
    (s.httpStatus === undefined ||
      (Number.isInteger(s.httpStatus) &&
        Number(s.httpStatus) >= 100 &&
        Number(s.httpStatus) <= 599))
  );
}
export function parseStatusDocument(value: unknown): StatusDocument {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !validDate(value.generatedAt) ||
    typeof value.catalogCommit !== "string" ||
    !/^[a-f0-9]{40,64}$/.test(value.catalogCommit) ||
    typeof value.catalogSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.catalogSha256) ||
    !isRecord(value.origin) ||
    typeof value.origin.name !== "string" ||
    !(
      value.origin.runUrl === null ||
      (typeof value.origin.runUrl === "string" &&
        /^https:\/\/github\.com\//.test(value.origin.runUrl))
    ) ||
    !Array.isArray(value.channels) ||
    !value.channels.length
  )
    throw new Error("Formato de resultados inválido o no compatible.");
  const ids = new Set();
  for (const c of value.channels) {
    if (
      !isRecord(c) ||
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      typeof c.name !== "string" ||
      !c.name ||
      typeof c.group !== "string" ||
      !isStatus(c.status) ||
      !Array.isArray(c.sources) ||
      !c.sources.length
    )
      throw new Error("Canal inválido en los resultados.");
    ids.add(c.id);
    const urls = new Set();
    for (const [i, s] of c.sources.entries()) {
      if (
        !isRecord(s) ||
        typeof s.url !== "string" ||
        !/^https?:\/\//.test(s.url) ||
        urls.has(s.url) ||
        s.priority !== i + 1 ||
        !isStatus(s.status) ||
        !validMeasurement(s) ||
        !(
          (s.checkedAt === null && s.status === "unchecked") ||
          validDate(s.checkedAt)
        ) ||
        !Array.isArray(s.attempts) ||
        s.attempts.some(
          (a) =>
            !isRecord(a) ||
            !isStatus(a.status) ||
            a.status === "unchecked" ||
            !validDate(a.checkedAt) ||
            !validMeasurement(a),
        )
      )
        throw new Error("Fuente inválida en los resultados.");
      urls.add(s.url);
    }
    if (c.status !== aggregateStatus(c.sources as SourceResult[]))
      throw new Error("Estado de canal inconsistente.");
  }
  return value as unknown as StatusDocument;
}
