// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { parseCatalog } from "../shared/catalog";
import {
  aggregateStatus,
  uncheckedChannels,
  type StatusDocument,
} from "../shared/status";
function report(date = new Date().toISOString()): StatusDocument {
  const channels = uncheckedChannels(
    parseCatalog(readFileSync("canales.m3u", "utf8")),
  );
  channels.forEach((c, i) => {
    c.sources.forEach((s) =>
      Object.assign(s, {
        status: i === 0 ? "available" : "restricted",
        diagnostic:
          i === 0
            ? "Muestra multimedia válida."
            : "HTTP 403: acceso restringido.",
        httpStatus: i === 0 ? 200 : 403,
        durationMs: 123,
        checkedAt: date,
        attempts: [
          {
            status: i === 0 ? "available" : "restricted",
            diagnostic: "Prueba",
            durationMs: 123,
            checkedAt: date,
          },
        ],
      }),
    );
    c.status = aggregateStatus(c.sources);
  });
  return {
    schemaVersion: 1,
    generatedAt: date,
    catalogCommit: "a".repeat(40),
    catalogSha256: "b".repeat(64),
    origin: {
      name: "GitHub Actions",
      runUrl: "https://github.com/TylorDev/bobtv-canales/actions/runs/123",
    },
    channels,
  };
}
const response = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response(report())),
  );
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("panel functional behavior", () => {
  it("renders every source expanded in catalog order, with diagnostics and metadata", async () => {
    const data = report();
    render(<App />);
    await screen.findByText("GitHub Actions");
    const cards = screen.getAllByRole("article");
    expect(cards.map((c) => c.getAttribute("aria-label"))).toEqual(
      data.channels.map((c) => c.name),
    );
    expect(
      screen.getAllByRole("button", { name: /Copiar URL de/ }),
    ).toHaveLength(data.channels.reduce((n, c) => n + c.sources.length, 0));
    expect(within(cards[0]!).getAllByText("HTTP 200").length).toBeGreaterThan(
      0,
    );
    expect(within(cards[0]!).getAllByText("0.12 s").length).toBeGreaterThan(0);
  });
  it("searches names and URLs and resets an empty result", async () => {
    render(<App />);
    await screen.findByText("GitHub Actions");
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar canales" }), {
      target: { value: "GIGAVISIÓN" },
    });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "no-existe" },
    });
    expect(screen.queryByRole("article")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getAllByRole("article")).toHaveLength(
      report().channels.length,
    );
  });
  it("filters by group and state with the Radix selectors", async () => {
    render(<App />);
    await screen.findByText("GitHub Actions");
    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Filtrar por grupo" }),
      { key: "ArrowDown" },
    );
    fireEvent.click(
      await screen.findByRole("option", { name: "Bolivia | Regionales" }),
    );
    expect(screen.getAllByRole("article")).toHaveLength(
      report().channels.filter((c) => c.group === "Bolivia | Regionales")
        .length,
    );
    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Filtrar por estado" }),
      { key: "ArrowDown" },
    );
    fireEvent.click(await screen.findByRole("option", { name: "Disponible" }));
    expect(screen.queryByRole("article")).toBeNull();
  });
  it("copies an individual source URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<App />);
    await screen.findByText("GitHub Actions");
    fireEvent.click(
      screen.getAllByRole("button", { name: /Copiar URL de/ })[0]!,
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        report().channels[0]!.sources[0]!.url,
      ),
    );
    expect(await screen.findByText("URL copiada")).toBeInTheDocument();
  });
  it("warns when results are over 15 minutes old", async () => {
    vi.mocked(fetch).mockResolvedValue(
      response(report(new Date(Date.now() - 16 * 60_000).toISOString())),
    );
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "más de 15 minutos",
    );
  });
  it("retains data and its verification time after a failed or malformed refresh", async () => {
    const old = report("2026-10-13T20:00:00Z");
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(old))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response({ schemaVersion: 999 }));
    render(<App />);
    await screen.findByText("GitHub Actions");
    const time = screen.getAllByText(/13\/10\/26/)[0]!.textContent;
    fireEvent.click(
      screen.getByRole("button", { name: "Actualizar resultados" }),
    );
    await screen.findByText(/Se conservan los últimos datos/);
    expect(screen.getAllByRole("article")).toHaveLength(old.channels.length);
    expect(screen.getAllByText(/13\/10\/26/)[0]!.textContent).toBe(time);
    fireEvent.click(
      screen.getByRole("button", { name: "Actualizar resultados" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(screen.getByText("GitHub Actions")).toBeInTheDocument();
  });
  it("shows the unchecked catalog when the first load fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    render(<App />);
    await screen.findByText(/catálogo se muestra sin comprobar/);
    expect(screen.getAllByRole("article")).toHaveLength(
      report().channels.length,
    );
    expect(screen.getAllByText("Sin comprobar").length).toBeGreaterThan(0);
  });
  it("refreshes automatically every 30 seconds and accepts updated catalog results", async () => {
    vi.useFakeTimers();
    const next = report();
    next.channels = next.channels.slice(0, 2);
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(report()))
      .mockResolvedValueOnce(response(next));
    render(<App />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("article")).toHaveLength(
      report().channels.length,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
  it("marks data stale as time passes and clears its polling on unmount", async () => {
    vi.useFakeTimers();
    const data = report(new Date(Date.now() - 14.9 * 60_000).toISOString());
    vi.mocked(fetch).mockImplementation(async () => response(data));
    const view = render(<App />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("más de 15 minutos");
    const calls = vi.mocked(fetch).mock.calls.length;
    view.unmount();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
});
