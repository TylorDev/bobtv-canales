import { createServer, type Server } from "node:http";
import { createCipheriv } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkHls, MANIFEST_LIMIT, SAMPLE_LIMIT } from "../monitor/hls";
let server: Server;
let base: string;
const requests: { url: string; range?: string }[] = [];
const ts = Buffer.alloc(188 * 5, 0xff);
for (let n = 0; n < ts.length; n += 188) ts.set([0x47, 0x1f, 0xff, 0x10], n);
const mp4 = (type: string) => {
  const b = Buffer.alloc(16);
  b.writeUInt32BE(16);
  b.write(type, 4);
  return b;
};
const key = Buffer.alloc(16, 7);
const iv = Buffer.alloc(16);
iv.writeUInt32BE(42, 12);
const cipher = createCipheriv("aes-128-cbc", key, iv);
const encrypted = Buffer.concat([cipher.update(ts), cipher.final()]);
const direct = (uri: string) =>
  `#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\n${uri}\n`;
beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url!;
    requests.push({ url: path, range: req.headers.range });
    if (path === "/slow") return; // Client aborts; closed by afterAll.
    if (/^\/http\/\d+$/.test(path)) {
      res.writeHead(Number(path.split("/").at(-1)));
      res.end("Error");
      return;
    }
    if (path === "/redirect") {
      res.writeHead(302, { location: "/nested/master.m3u8" });
      res.end();
      return;
    }
    if (path === "/nested/master.m3u8") {
      res.end("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=900000\n../direct.m3u8\n");
      return;
    }
    if (path === "/direct.m3u8") {
      res.end(direct("segment.ts"));
      return;
    }
    if (path === "/html.m3u8") {
      res.end("<html>Login</html>");
      return;
    }
    if (path === "/empty.m3u8") {
      res.end("#EXTM3U\n#EXT-X-TARGETDURATION:6\n");
      return;
    }
    if (path === "/bad-segment.m3u8") {
      res.end(direct("html.m3u8"));
      return;
    }
    if (path === "/oversize.m3u8") {
      res.end("#EXTM3U\n" + "x".repeat(MANIFEST_LIMIT));
      return;
    }
    if (path === "/segment.ts") {
      res.end(ts);
      return;
    }
    if (path === "/aes.m3u8") {
      res.end(
        '#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:42\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:6,\nencrypted.ts\n',
      );
      return;
    }
    if (path === "/aes-iv.m3u8") {
      res.end(
        '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x0000000000000000000000000000002a\n#EXTINF:6,\nencrypted.ts\n',
      );
      return;
    }
    if (path === "/restricted-segment.m3u8") {
      res.end(direct("http/403"));
      return;
    }
    if (path === "/key") {
      res.end(key);
      return;
    }
    if (path === "/encrypted.ts") {
      res.end(encrypted);
      return;
    }
    if (path === "/drm.m3u8") {
      res.end(
        '#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"\n#EXTINF:6,\nsegment.ts\n',
      );
      return;
    }
    if (path === "/map.m3u8") {
      res.end(
        '#EXTM3U\n#EXT-X-MAP:URI="init.mp4",BYTERANGE="16@8"\n#EXTINF:6,\nmedia.mp4\n',
      );
      return;
    }
    if (path === "/init.mp4") {
      res.writeHead(206, { "content-range": "bytes 8-23/24" });
      res.end(mp4("ftyp"));
      return;
    }
    if (path === "/media.mp4") {
      res.end(mp4("moof"));
      return;
    }
    if (path === "/range.m3u8" || path === "/ignored-range.m3u8") {
      const resource = path === "/range.m3u8" ? "range.ts" : "segment.ts";
      res.end(
        `#EXTM3U\n#EXT-X-BYTERANGE:${ts.length}@100\n#EXTINF:6,\n${resource}\n#EXT-X-BYTERANGE:${ts.length}\n#EXTINF:6,\n${resource}\n#EXT-X-BYTERANGE:${ts.length}\n#EXTINF:6,\n${resource}\n`,
      );
      return;
    }
    if (path === "/range.ts") {
      const start = Number(req.headers.range?.match(/bytes=(\d+)/)?.[1]);
      res.writeHead(206, {
        "content-range": `bytes ${start}-${start + ts.length - 1}/10000`,
      });
      res.end(ts);
      return;
    }
    if (path === "/loop.m3u8") {
      res.end("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nloop.m3u8\n");
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
describe("real HTTP HLS requests", () => {
  it.each([
    "/direct.m3u8",
    "/redirect",
    "/aes.m3u8",
    "/aes-iv.m3u8",
    "/map.m3u8",
    "/range.m3u8",
  ])("accepts %s with actual media bytes", async (path) => {
    const result = await checkHls(base + path);
    expect(result.status, result.diagnostic).toBe("available");
  });
  it("requests init maps and resolves implicit byte ranges", () => {
    expect(requests).toContainEqual({ url: "/init.mp4", range: "bytes=8-23" });
    expect(requests).toContainEqual({
      url: "/range.ts",
      range: `bytes=${100 + ts.length}-${100 + 2 * ts.length - 1}`,
    });
  });
  it.each([
    ["/html.m3u8", "unavailable"],
    ["/bad-segment.m3u8", "unavailable"],
    ["/empty.m3u8", "unavailable"],
    ["/http/401", "restricted"],
    ["/http/403", "restricted"],
    ["/restricted-segment.m3u8", "restricted"],
    ["/http/404", "unavailable"],
    ["/http/500", "inconclusive"],
    ["/http/429", "inconclusive"],
    ["/oversize.m3u8", "inconclusive"],
    ["/drm.m3u8", "inconclusive"],
    ["/ignored-range.m3u8", "inconclusive"],
    ["/loop.m3u8", "unavailable"],
  ])("classifies %s as %s", async (path, status) =>
    expect((await checkHls(base + path)).status).toBe(status),
  );
  it("enforces an overall attempt timeout", async () => {
    const result = await checkHls(base + "/slow", { timeoutMs: 40 });
    expect(result.status).toBe("inconclusive");
    expect(result.diagnostic).toContain("espera");
  });
  it("treats network failures as inconclusive", async () => {
    const result = await checkHls(base, {
      fetcher: async () => {
        throw new TypeError("network");
      },
    });
    expect(result.status).toBe("inconclusive");
  });
  it("bounds the segment request to 64 KiB", () =>
    expect(requests).toContainEqual({
      url: "/segment.ts",
      range: `bytes=0-${SAMPLE_LIMIT - 1}`,
    }));
});

it("cancels a large segment after a 64 KiB sample even when Range is ignored", async () => {
  let cancelled = false;
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    if (calls === 1) return new Response(direct("segment.ts"));
    return new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          const chunk = new Uint8Array(SAMPLE_LIMIT);
          chunk.set(ts);
          controller.enqueue(chunk);
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
  };
  expect(
    (await checkHls("https://fixture.test/live.m3u8", { fetcher })).status,
  ).toBe("available");
  expect(cancelled).toBe(true);
});

it("limits chunked manifests without trusting Content-Length", async () => {
  const fetcher: typeof fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode("#EXTM3U\n" + "x".repeat(MANIFEST_LIMIT)),
          );
          controller.close();
        },
      }),
    );
  expect(
    (await checkHls("https://fixture.test/live.m3u8", { fetcher })).status,
  ).toBe("inconclusive");
});

it("uses the key active at the init map rather than the later segment key", async () => {
  const fetcher: typeof fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/live")
      return new Response(
        '#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:42\n#EXT-X-MAP:URI="init"\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:6,\nsegment',
      );
    if (path === "/init") return new Response(new Uint8Array(mp4("ftyp")));
    if (path === "/key") return new Response(new Uint8Array(key));
    return new Response(new Uint8Array(encrypted));
  };
  const result = await checkHls("https://fixture.test/live", { fetcher });
  expect(result.status, result.diagnostic).toBe("available");
});
