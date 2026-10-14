import { useState } from "react";
import { Check, Copy, ExternalLink, Radio } from "lucide-react";
import type { ChannelResult } from "../../shared/status";
import { StatusBadge } from "./StatusBadge";
import s from "./ChannelCard.module.scss";
export function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date(value))
    : "Sin comprobar";
}
export function ChannelCard({
  channel,
  index,
}: {
  channel: ChannelResult;
  index: number;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <article className={s.card} aria-label={channel.name}>
      <header className={s.heading}>
        <span className={s.channelIcon}>
          <Radio size={21} aria-hidden="true" />
        </span>
        <div className={s.identity}>
          <div className={s.titleLine}>
            <h3>{channel.name}</h3>
            <span className={s.number}>
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
          <p>
            {channel.group} <span>·</span> {channel.sources.length}{" "}
            {channel.sources.length === 1 ? "fuente" : "fuentes"}
          </p>
        </div>
        <StatusBadge status={channel.status} />
      </header>
      <ol className={s.sources}>
        {channel.sources.map((source) => (
          <li key={source.url} className={s.source}>
            <div className={s.sourceTop}>
              <span className={s.priority}>
                FUENTE {source.priority}{" "}
                <span>
                  {source.priority === 1 ? "Principal" : "Alternativa"}
                </span>
              </span>
              <StatusBadge status={source.status} />
            </div>
            <div className={s.urlLine}>
              <code>{source.url}</code>
              <button
                className={s.copy}
                onClick={() => void copy(source.url)}
                aria-label={`Copiar URL de ${channel.name}, fuente ${source.priority}`}
                title="Copiar URL"
              >
                {copied === source.url ? (
                  <Check size={15} />
                ) : (
                  <Copy size={15} />
                )}
              </button>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir URL de ${channel.name}, fuente ${source.priority}`}
              >
                <ExternalLink size={14} />
              </a>
            </div>
            <p className={s.diagnostic}>{source.diagnostic}</p>
            <div className={s.metadata}>
              <span>
                {source.httpStatus ? `HTTP ${source.httpStatus}` : "HTTP —"}
              </span>
              <span>
                {source.checkedAt
                  ? `${(source.durationMs / 1000).toFixed(2)} s`
                  : "Duración —"}
              </span>
              <span>
                Verificado:{" "}
                <time dateTime={source.checkedAt ?? undefined}>
                  {formatDate(source.checkedAt)}
                </time>
              </span>
              {source.attempts.length > 1 && (
                <span>2 intentos · 15 s de separación</span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <span className="srOnly" role="status">
        {copyError
          ? "No se pudo copiar. Selecciona la URL para copiarla manualmente."
          : copied
            ? "URL copiada"
            : ""}
      </span>
    </article>
  );
}
