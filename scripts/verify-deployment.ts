import { readFile } from "node:fs/promises";
import { parseStatusDocument } from "../shared/status";
const base = new URL(
  process.argv[2] ?? "https://tylordev.github.io/bobtv-canales/",
);
const expected = process.argv[3]
  ? parseStatusDocument(JSON.parse(await readFile(process.argv[3], "utf8")))
  : null;
async function get(url: URL, expectedType: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes(expectedType)
  )
    throw new Error(
      `Recurso inaccesible o tipo inválido: ${url.pathname}, HTTP ${response.status}`,
    );
  return response;
}
async function verify() {
  const html = await (await get(base, "text/html")).text();
  if (!html.includes('<div id="root"></div>'))
    throw new Error("No se recibió el panel.");
  const resources = [
    ...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
  ].map((match) => new URL(match[1]!, base));
  if (
    !resources.some((url) => url.pathname.endsWith(".js")) ||
    !resources.some((url) => url.pathname.endsWith(".css"))
  )
    throw new Error("El HTML no incluye los recursos del panel.");
  for (const resource of resources) {
    if (
      resource.origin !== base.origin ||
      !resource.pathname.startsWith(base.pathname)
    )
      throw new Error("Ruta de recursos incorrecta para Pages.");
    await get(
      resource,
      resource.pathname.endsWith(".css") ? "text/css" : "javascript",
    );
  }
  const report = parseStatusDocument(
    await (
      await get(
        new URL(`data/status.json?t=${Date.now()}`, base),
        "application/json",
      )
    ).json(),
  );
  if (
    expected &&
    (report.generatedAt !== expected.generatedAt ||
      report.catalogSha256 !== expected.catalogSha256)
  )
    throw new Error("Pages aún sirve resultados de otro despliegue.");
  if (
    base.hostname === "tylordev.github.io" &&
    report.origin.name !== "GitHub Actions"
  )
    throw new Error("El informe publicado no procede de GitHub Actions.");
  console.log(
    `HTTP correcto: panel, ${resources.length} recursos y JSON; ${report.channels.length} canales. Generación: ${report.generatedAt}.`,
  );
}
// CDN propagation is not instantaneous. Keep retries bounded.
for (let attempt = 1; ; attempt++) {
  try {
    await verify();
    break;
  } catch (error) {
    if (attempt === 6) throw error;
    console.log(
      `Verificación HTTP pendiente (${attempt}/6): ${error instanceof Error ? error.message : "error"}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}
