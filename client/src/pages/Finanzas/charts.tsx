import { useState } from "react";
import { money } from "../../lib/labels";

export interface BarDatum {
  label: string;
  value: number;
}

/** Gráfico de barras simple en SVG, sin librerías externas. */
export function BarChart({ data, height = 160, color = "#db2777" }: { data: BarDatum[]; height?: number; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 100 / Math.max(1, data.length);
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 20);
          return (
            <g key={i}>
              <rect
                x={i * barWidth + barWidth * 0.15}
                y={height - 20 - h}
                width={barWidth * 0.7}
                height={h}
                fill={color}
                rx={1}
              >
                <title>{`${d.label}: ${money(d.value)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex text-[10px] text-gray-500 mt-1">
        {data.map((d, i) => (
          <div key={i} style={{ width: `${barWidth}%` }} className="text-center truncate px-0.5">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface GroupedBarDatum {
  label: string;
  series: Record<string, number>;
}

const SERIES_COLORS = ["#db2777", "#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

/** `interactive`: la leyenda se vuelve clicable para ocultar/mostrar cada serie
 * (igual que un gráfico de librería), sin depender de ninguna librería externa. */
export function GroupedBarChart({
  data,
  seriesKeys,
  height = 180,
  interactive = false,
}: {
  data: GroupedBarDatum[];
  seriesKeys: string[];
  height?: number;
  interactive?: boolean;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visibleKeys = interactive ? seriesKeys.filter((k) => !hidden.has(k)) : seriesKeys;

  function toggle(k: string) {
    if (!interactive) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const max = Math.max(1, ...data.flatMap((d) => visibleKeys.map((k) => d.series[k] ?? 0)));
  const groupWidth = 100 / Math.max(1, data.length);
  const barWidth = (groupWidth * 0.8) / Math.max(1, visibleKeys.length);
  return (
    <div>
      <div className="flex gap-3 text-[11px] mb-1 flex-wrap">
        {seriesKeys.map((k) => {
          const i = seriesKeys.indexOf(k);
          const isHidden = hidden.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              disabled={!interactive}
              className={`flex items-center gap-1 ${interactive ? "cursor-pointer" : "cursor-default"} ${isHidden ? "opacity-40" : ""}`}
            >
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
              {k}
            </button>
          );
        })}
      </div>
      <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {data.map((d, gi) => (
          <g key={gi}>
            {visibleKeys.map((k, si) => {
              const v = d.series[k] ?? 0;
              const h = (v / max) * (height - 20);
              const colorIdx = seriesKeys.indexOf(k);
              return (
                <rect
                  key={k}
                  x={gi * groupWidth + groupWidth * 0.1 + si * barWidth}
                  y={height - 20 - h}
                  width={barWidth * 0.9}
                  height={h}
                  fill={SERIES_COLORS[colorIdx % SERIES_COLORS.length]}
                >
                  <title>{`${d.label} · ${k}: ${money(v)}`}</title>
                </rect>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="flex text-[10px] text-gray-500 mt-1">
        {data.map((d, i) => (
          <div key={i} style={{ width: `${groupWidth}%` }} className="text-center truncate px-0.5">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
