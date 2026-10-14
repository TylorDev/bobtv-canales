import type { CatalogChannel } from "./status";

/** Strict catalog parser shared by the monitor and the initial, unchecked web view. */
export function parseCatalog(text: string): CatalogChannel[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.shift()?.trim() !== "#EXTM3U")
    throw new Error("El catálogo debe empezar por #EXTM3U.");
  const channels = new Map<string, CatalogChannel>();
  let pending: { id: string; name: string; group: string } | undefined;
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      if (pending) throw new Error(`Falta URL antes de la línea ${index + 2}.`);
      const separator = line.search(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const meta = line.slice(0, separator);
      const id = /\btvg-id="([^"]+)"/.exec(meta)?.[1]?.trim();
      const name = separator >= 0 ? line.slice(separator + 1).trim() : "";
      if (!id || !name)
        throw new Error(`EXTINF inválido en línea ${index + 2}.`);
      pending = {
        id,
        name,
        group: /\bgroup-title="([^"]*)"/.exec(meta)?.[1] || "Sin grupo",
      };
    } else if (!line.startsWith("#")) {
      if (!pending) throw new Error(`URL sin EXTINF en línea ${index + 2}.`);
      let url: URL;
      try {
        url = new URL(line);
      } catch {
        throw new Error(`URL inválida en línea ${index + 2}.`);
      }
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("Solo se admiten URLs HTTP/HTTPS sin credenciales.");
      const channel = channels.get(pending.id) ?? { ...pending, sources: [] };
      if (!channel.sources.some((s) => s.url === url.href))
        channel.sources.push({
          url: url.href,
          priority: channel.sources.length + 1,
        });
      channels.set(channel.id, channel);
      pending = undefined;
    }
  }
  if (pending || !channels.size)
    throw new Error("Catálogo vacío o incompleto.");
  return [...channels.values()];
}
