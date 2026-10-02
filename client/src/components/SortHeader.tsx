export type SortDir = "asc" | "desc";

/** Encabezado de columna ordenable (▲/▼), igual al patrón de "filtro por checkbox en encabezados" del mockup. */
export default function SortHeader<T extends string>({
  label,
  sortKey,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  sortKey: T;
  active: T | null;
  dir: SortDir;
  onClick: (key: T) => void;
  className?: string;
}) {
  const isActive = active === sortKey;
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={`flex items-center gap-0.5 hover:text-gray-700 ${className ?? ""}`}
    >
      {label}
      <span className="text-[10px] w-2.5 inline-block">{isActive ? (dir === "asc" ? "▲" : "▼") : ""}</span>
    </button>
  );
}

export function toggleSort<T extends string>(
  key: T,
  active: T | null,
  dir: SortDir,
  setActive: (k: T) => void,
  setDir: (d: SortDir) => void
) {
  if (active === key) {
    setDir(dir === "asc" ? "desc" : "asc");
  } else {
    setActive(key);
    setDir("asc");
  }
}

export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { sensitivity: "base" });
}
