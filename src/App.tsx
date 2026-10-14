import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Globe2,
  Layers3,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import catalogText from "../canales.m3u?raw";
import { parseCatalog } from "../shared/catalog";
import {
  parseStatusDocument,
  STATUS_LABELS,
  uncheckedChannels,
  type StatusDocument,
} from "../shared/status";
import { ChannelCard, formatDate } from "./components/ChannelCard";
import { FilterSelect } from "./components/FilterSelect";
import s from "./App.module.scss";
const initial = uncheckedChannels(parseCatalog(catalogText));
const POLL_MS = 30_000;
const STALE_MS = 15 * 60_000;
export default function App() {
  const [report, setReport] = useState<StatusDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [now, setNow] = useState(Date.now());
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}data/status.json?t=${Date.now()}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = parseStatusDocument(await response.json());
      if (mounted.current) {
        setReport(data);
        setError(null);
        setNow(Date.now());
      }
    } catch {
      if (mounted.current)
        setError(
          "No se pudieron actualizar los resultados. Se conservan los últimos datos recibidos con su fecha de verificación.",
        );
    } finally {
      clearTimeout(timeout);
      active.current = null;
      if (mounted.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const poll = setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(poll);
      active.current?.abort();
    };
  }, [refresh]);
  const channels = report?.channels ?? initial;
  const sources = channels.flatMap((c) => c.sources);
  const available = channels.filter((c) => c.status === "available").length;
  const availableSources = sources.filter(
    (source) => source.status === "available",
  ).length;
  const attention = channels.filter(
    (c) => !["available", "unchecked"].includes(c.status),
  ).length;
  const groups = [...new Set(channels.map((c) => c.group))];
  const filtered = useMemo(
    () =>
      channels.filter(
        (c) =>
          (group === "all" || c.group === group) &&
          (status === "all" || c.status === status) &&
          `${c.name} ${c.group} ${c.id} ${c.sources.map((source) => source.url).join(" ")}`
            .toLocaleLowerCase("es")
            .includes(query.toLocaleLowerCase("es").trim()),
      ),
    [channels, group, status, query],
  );
  const stale = report && now - Date.parse(report.generatedAt) > STALE_MS;
  return (
    <>
      <header className={s.topbar}>
        <div className={s.nav}>
          <a
            className={s.brand}
            href={import.meta.env.BASE_URL}
            aria-label="BOBTV, inicio"
          >
            <span className={s.logo}>
              <Radio size={20} />
            </span>
            BOB<span>TV</span>
            <span className={s.navDivider} />
            <span className={s.navLabel}>Monitor de disponibilidad</span>
          </a>
          <a
            className={s.repo}
            href="https://github.com/TylorDev/bobtv-canales"
            target="_blank"
            rel="noreferrer"
          >
            Ver repositorio <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <main className={s.main}>
        <div className={s.breadcrumb}>
          BOBTV <span>/</span> Estado de las señales
        </div>
        <section className={s.intro}>
          <div>
            <div className={s.eyebrow}>
              <span /> MONITOREO IPTV
            </div>
            <h1>Disponibilidad de canales</h1>
            <p>El estado de tus señales, en un solo lugar.</p>
          </div>
          <button
            className={s.refresh}
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? s.spinning : ""} />
            {loading ? "Actualizando…" : "Actualizar resultados"}
          </button>
        </section>
        <div className={s.updateLine}>
          <span>
            <Clock3 size={13} />
            Última verificación:{" "}
            <strong>{formatDate(report?.generatedAt ?? null)}</strong>
          </span>
          <span>
            Comprobación cada 5 min <i /> Consulta automática cada 30 s
          </span>
        </div>
        {error && (
          <div className={`${s.notice} ${s.error}`} role="alert">
            <AlertCircle size={18} />
            <p>
              {report
                ? error
                : "No se pudieron cargar resultados. El catálogo se muestra sin comprobar. Vuelve a actualizar en unos momentos."}
            </p>
          </div>
        )}
        {stale && (
          <div className={`${s.notice} ${s.warning}`} role="alert">
            <Clock3 size={18} />
            <p>
              Resultados antiguos: la última verificación tiene más de 15
              minutos. Los estados pueden haber cambiado.
            </p>
          </div>
        )}
        <section className={s.metrics} aria-label="Resumen de disponibilidad">
          <div className={s.metric}>
            <span>
              CANALES DISPONIBLES <Radio size={16} />
            </span>
            <p>
              {available}
              <small>/ {channels.length}</small>
            </p>
            <div>
              <span className={s.greenDot} />
              {channels.length
                ? Math.round((available / channels.length) * 100)
                : 0}
              % del catálogo
            </div>
            <div className={s.meter}>
              <i
                style={{
                  width: `${channels.length ? (available / channels.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className={s.metric}>
            <span>
              FUENTES DISPONIBLES <Layers3 size={16} />
            </span>
            <p>
              {availableSources}
              <small>/ {sources.length}</small>
            </p>
            <div>Principales y alternativas</div>
          </div>
          <div className={s.metric}>
            <span>
              CANALES CON INCIDENCIAS <Activity size={16} />
            </span>
            <p>{attention.toString().padStart(2, "0")}</p>
            <div>Sin fuente disponible confirmada</div>
          </div>
          <div className={s.metric}>
            <span>
              ORIGEN DE COMPROBACIÓN <Globe2 size={16} />
            </span>
            <p className={s.origin}>
              {report?.origin.name ?? "Sin resultados"}
            </p>
            <div>
              {report?.origin.runUrl ? (
                <a href={report.origin.runUrl} target="_blank" rel="noreferrer">
                  Ver ejecución <ArrowUpRight size={12} />
                </a>
              ) : (
                "Esperando una comprobación publicada"
              )}
            </div>
          </div>
        </section>
        <section className={s.catalog} aria-labelledby="catalog-title">
          <div className={s.catalogHeading}>
            <div>
              <h2 id="catalog-title">
                Catálogo de canales <span>{channels.length}</span>
              </h2>
              <p>
                Todos los canales y sus fuentes, en el orden de la lista M3U.
              </p>
            </div>
            <span className={s.catalogTag}>
              <ShieldCheck size={13} /> Catálogo público
            </span>
          </div>
          <div className={s.filters}>
            <label className={s.search}>
              <Search size={17} />
              <input
                aria-label="Buscar canales"
                placeholder="Buscar canal, grupo o URL…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className={s.selects}>
              <FilterSelect
                label="Filtrar por grupo"
                value={group}
                onChange={setGroup}
                options={[
                  { value: "all", label: "Todos los grupos" },
                  ...groups.map((g) => ({ value: g, label: g })),
                ]}
              />
              <FilterSelect
                label="Filtrar por estado"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "Todos los estados" },
                  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
            </div>
          </div>
          <div className={s.resultLine} aria-live="polite">
            <span>
              Mostrando <strong>{filtered.length}</strong> de {channels.length}{" "}
              canales
            </span>
            <span>
              <CheckCircle2 size={12} /> Fuentes visibles · Prioridad de la
              lista
            </span>
          </div>
          <div className={s.grid}>
            {filtered.map((c) => (
              <ChannelCard key={c.id} channel={c} index={channels.indexOf(c)} />
            ))}
          </div>
          {!filtered.length && (
            <div className={s.empty}>
              <Search size={28} />
              <h3>No encontramos canales</h3>
              <p>Prueba otro nombre o cambia los filtros.</p>
              <button
                onClick={() => {
                  setQuery("");
                  setGroup("all");
                  setStatus("all");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </section>
        <aside className={s.disclaimer}>
          <ShieldCheck size={19} />
          <div>
            <strong>Qué significa «Disponible»</strong>
            <p>
              El manifiesto HLS y una muestra de segmento son accesibles desde
              el origen indicado. Esta comprobación no certifica decodificación
              ni reproducción en el TV Box. La disponibilidad puede variar según
              tu red y ubicación.
            </p>
          </div>
        </aside>
        <footer className={s.footer}>
          <span>
            <strong>BOBTV</strong> · Estado de las señales
          </span>
          <span>
            {report ? (
              <>
                Catálogo{" "}
                <a
                  href={`https://github.com/TylorDev/bobtv-canales/commit/${report.catalogCommit}`}
                >
                  {report.catalogCommit.slice(0, 7)}
                </a>{" "}
                ·{" "}
              </>
            ) : null}
            Horarios en tu zona local
          </span>
        </footer>
      </main>
    </>
  );
}
