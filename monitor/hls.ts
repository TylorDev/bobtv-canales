import { createDecipheriv } from "node:crypto";
import { Parser } from "m3u8-parser";
import type { Attempt } from "../shared/status";

export const MANIFEST_LIMIT = 1024 * 1024;
export const SAMPLE_LIMIT = 64 * 1024;
export class CheckFailure extends Error {
  constructor(
    public status: Attempt["status"],
    message: string,
    public httpStatus?: number,
  ) {
    super(message);
  }
}
interface ByteRange {
  length: number;
  offset?: number;
}
interface Key {
  method: string;
  uri?: string;
  iv?: Uint32Array;
}
interface InitMap {
  uri: string;
  byterange?: ByteRange;
  key?: Key;
}
interface Segment {
  uri: string;
  byterange?: ByteRange;
  key?: Key;
  map?: InitMap;
}
interface Manifest {
  playlists?: { uri: string; attributes?: { BANDWIDTH?: number } }[];
  segments: Segment[];
  mediaSequence?: number;
}
export interface CheckOptions {
  timeoutMs?: number;
  fetcher?: typeof fetch;
}
const failureForHttp = (code: number) =>
  code === 401 || code === 403
    ? "restricted"
    : code >= 500 || code === 408 || code === 429
      ? "inconclusive"
      : code >= 400 && code < 500
        ? "unavailable"
        : "inconclusive";
function httpUrl(raw: string, base?: string): string {
  const url = new URL(raw, base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new CheckFailure(
      "inconclusive",
      "El HLS requiere un protocolo o credenciales no admitidos.",
    );
  return url.href;
}
async function request(
  url: string,
  signal: AbortSignal,
  fetcher: typeof fetch,
  range?: string,
): Promise<{ response: Response; url: string }> {
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetcher(url, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": "BOBTV-Monitor/1.0",
        ...(range ? { Range: range } : {}),
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 5)
        throw new CheckFailure(
          "inconclusive",
          "Redirección HLS inválida o excesiva.",
          response.status,
        );
      url = httpUrl(location, url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new CheckFailure(
        failureForHttp(response.status),
        `El servidor respondió HTTP ${response.status}.`,
        response.status,
      );
    }
    return { response, url };
  }
  throw new CheckFailure("inconclusive", "Demasiadas redirecciones.");
}
async function readBytes(
  response: Response,
  limit: number,
  complete: boolean,
): Promise<Uint8Array> {
  if (!response.body)
    throw new CheckFailure("unavailable", "Respuesta vacía.", response.status);
  if (complete && Number(response.headers.get("content-length")) > limit) {
    await response.body.cancel();
    throw new CheckFailure(
      "inconclusive",
      "El manifiesto o clave supera el límite permitido.",
      response.status,
    );
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (complete && size + value.length > limit)
        throw new CheckFailure(
          "inconclusive",
          "Respuesta mayor que el límite permitido.",
          response.status,
        );
      const part = value.subarray(0, limit - size);
      chunks.push(part);
      size += part.length;
      if (!complete && size === limit) break;
    }
  } finally {
    await reader.cancel();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
function isMedia(bytes: Uint8Array): boolean {
  // MPEG-TS, fragmented MP4, WebVTT, ADTS AAC and MP3. Access check, no decoding.
  const b = Buffer.from(bytes);
  let start = 0;
  if (b.subarray(0, 3).toString() === "ID3" && b.length >= 10)
    start =
      10 +
      ((b[6]! & 127) * 2097152 +
        (b[7]! & 127) * 16384 +
        (b[8]! & 127) * 128 +
        (b[9]! & 127));
  for (let i = start; i < Math.min(start + 188, b.length - 376); i++)
    if (b[i] === 0x47 && b[i + 188] === 0x47 && b[i + 376] === 0x47)
      return true;
  if (
    b.length >= 8 &&
    ["ftyp", "styp", "moof", "mdat", "sidx"].includes(
      b.subarray(4, 8).toString(),
    ) &&
    (b.readUInt32BE(0) === 0 || b.readUInt32BE(0) >= 8)
  )
    return true;
  if (b.subarray(start, start + 6).toString() === "WEBVTT") return true;
  return (
    b.length > start + 7 && b[start] === 255 && (b[start + 1]! & 0xe0) === 0xe0
  );
}
function ivBuffer(iv: Uint32Array | undefined, sequence: number): Buffer {
  if (
    !Number.isSafeInteger(sequence) ||
    sequence < 0 ||
    (iv && iv.length !== 4)
  )
    throw new CheckFailure("unavailable", "Secuencia o IV AES-128 inválidos.");
  const buffer = Buffer.alloc(16);
  if (iv) for (let i = 0; i < 4; i++) buffer.writeUInt32BE(iv[i]!, i * 4);
  else buffer.writeBigUInt64BE(BigInt(sequence), 8);
  return buffer;
}
async function sample(
  uri: string,
  range: ByteRange | undefined,
  base: string,
  key: Key | undefined,
  sequence: number,
  signal: AbortSignal,
  fetcher: typeof fetch,
  isMap = false,
): Promise<number> {
  const start = range?.offset ?? 0;
  const size = Math.min(range?.length ?? SAMPLE_LIMIT, SAMPLE_LIMIT);
  if (
    !Number.isSafeInteger(start) ||
    start < 0 ||
    !Number.isSafeInteger(size) ||
    size <= 0
  )
    throw new CheckFailure("unavailable", "Rango de bytes HLS inválido.");
  const { response } = await request(
    httpUrl(uri, base),
    signal,
    fetcher,
    `bytes=${start}-${start + size - 1}`,
  );
  if (response.status === 206) {
    const match = /^bytes (\d+)-(\d+)\/(?:\d+|\*)$/.exec(
      response.headers.get("content-range") || "",
    );
    if (
      !match ||
      Number(match[1]) !== start ||
      Number(match[2]) > start + size - 1 ||
      Number(match[2]) < start
    ) {
      await response.body?.cancel();
      throw new CheckFailure(
        "inconclusive",
        "El servidor devolvió un rango de bytes incorrecto.",
        response.status,
      );
    }
  } else if (start !== 0) {
    await response.body?.cancel();
    throw new CheckFailure(
      "inconclusive",
      "El servidor ignora el rango de bytes requerido.",
      response.status,
    );
  }
  let bytes = await readBytes(response, size, false);
  if (key && key.method !== "NONE") {
    if (key.method !== "AES-128" || !key.uri || (isMap && !key.iv))
      throw new CheckFailure(
        "inconclusive",
        "Cifrado HLS no compatible o mapa cifrado sin IV explícito.",
      );
    const keyResponse = await request(httpUrl(key.uri, base), signal, fetcher);
    const keyBytes = await readBytes(keyResponse.response, 16, true);
    if (keyBytes.length !== 16)
      throw new CheckFailure(
        "unavailable",
        "La clave AES-128 no tiene 16 bytes.",
        keyResponse.response.status,
      );
    const blockLength = Math.floor(bytes.length / 16) * 16;
    if (!blockLength)
      throw new CheckFailure(
        "unavailable",
        "Segmento AES-128 vacío o truncado.",
        response.status,
      );
    const decipher = createDecipheriv(
      "aes-128-cbc",
      keyBytes,
      ivBuffer(key.iv, sequence),
    );
    decipher.setAutoPadding(false);
    bytes = Buffer.concat([
      decipher.update(bytes.subarray(0, blockLength)),
      decipher.final(),
    ]);
  }
  if (!isMedia(bytes))
    throw new CheckFailure(
      "unavailable",
      isMap
        ? "El mapa de inicialización no contiene datos multimedia reconocibles."
        : "El segmento no contiene datos multimedia reconocibles (vacío, HTML o formato inválido).",
      response.status,
    );
  return response.status;
}
export async function checkHls(
  url: string,
  options: CheckOptions = {},
): Promise<Attempt> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 10_000,
  );
  const fetcher = options.fetcher ?? fetch;
  try {
    let current = httpUrl(url);
    const visited = new Set<string>();
    for (let depth = 0; depth < 5; depth++) {
      if (visited.has(current))
        throw new CheckFailure("unavailable", "Bucle entre manifiestos HLS.");
      visited.add(current);
      const { response, url: finalUrl } = await request(
        current,
        controller.signal,
        fetcher,
      );
      const bytes = await readBytes(response, MANIFEST_LIMIT, true);
      const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
      if (!text.trimStart().startsWith("#EXTM3U"))
        throw new CheckFailure(
          "unavailable",
          "La respuesta no es un manifiesto HLS (posible HTML).",
          response.status,
        );
      const parser = new Parser();
      try {
        parser.push(text);
        parser.end();
      } catch {
        throw new CheckFailure(
          "unavailable",
          "No se puede interpretar el manifiesto HLS.",
          response.status,
        );
      }
      const manifest = parser.manifest as unknown as Manifest;
      if (manifest.playlists?.length) {
        // Deterministic lowest-bandwidth variant bounds monitoring traffic.
        const variants = [...manifest.playlists].sort(
          (a, b) =>
            (a.attributes?.BANDWIDTH ?? Infinity) -
            (b.attributes?.BANDWIDTH ?? Infinity),
        );
        if (!variants[0]?.uri)
          throw new CheckFailure(
            "unavailable",
            "Manifiesto maestro sin variante válida.",
          );
        current = httpUrl(variants[0].uri, finalUrl);
        continue;
      }
      if (!manifest.segments?.length)
        throw new CheckFailure(
          "unavailable",
          "El manifiesto HLS no contiene segmentos completos.",
          response.status,
        );
      // Resolve implicit byte offsets in catalog order before choosing a recent full segment.
      let previous: { uri: string; end: number } | undefined;
      for (const segment of manifest.segments) {
        if (segment.byterange) {
          if (segment.byterange.offset === undefined) {
            if (!previous || previous.uri !== segment.uri)
              throw new CheckFailure(
                "unavailable",
                "Rango implícito sin segmento previo del mismo recurso.",
              );
            segment.byterange.offset = previous.end;
          }
          previous = {
            uri: segment.uri,
            end: segment.byterange.offset + segment.byterange.length,
          };
        } else previous = undefined;
      }
      const index = Math.max(0, manifest.segments.length - 2);
      const segment = manifest.segments[index]!;
      if (!segment.uri)
        throw new CheckFailure("unavailable", "Segmento sin URL.");
      const sequence = (manifest.mediaSequence ?? 0) + index;
      if (segment.map) {
        await sample(
          segment.map.uri,
          segment.map.byterange,
          finalUrl,
          segment.map.key,
          sequence,
          controller.signal,
          fetcher,
          true,
        );
      }
      const httpStatus = await sample(
        segment.uri,
        segment.byterange,
        finalUrl,
        segment.key,
        sequence,
        controller.signal,
        fetcher,
      );
      return {
        status: "available",
        diagnostic:
          "Manifiesto HLS y muestra real de segmento accesibles. No certifica decodificación.",
        httpStatus,
        durationMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      };
    }
    throw new CheckFailure(
      "inconclusive",
      "Se superó el límite de manifiestos anidados.",
    );
  } catch (error) {
    let failure: CheckFailure;
    if (error instanceof CheckFailure) failure = error;
    else if (controller.signal.aborted)
      failure = new CheckFailure(
        "inconclusive",
        "Tiempo de espera agotado durante la comprobación.",
      );
    else if (
      error instanceof TypeError ||
      (error instanceof Error &&
        ["AbortError", "TimeoutError"].includes(error.name))
    )
      failure = new CheckFailure(
        "inconclusive",
        "Error de red al acceder al HLS.",
      );
    else throw error; // Programming/global failures must not replace a valid deployment.
    return {
      status: failure.status,
      diagnostic: failure.message,
      ...(failure.httpStatus ? { httpStatus: failure.httpStatus } : {}),
      durationMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}
