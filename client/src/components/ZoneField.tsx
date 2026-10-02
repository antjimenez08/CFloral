import { ZONES, guessZoneFromAddress } from "../pages/Despachos/zoneUtils";

/**
 * Selector cerrado de zona (Norte/Sur/Oeste/Oriente), igual que en el mockup, con
 * autodetección: cuando el usuario todavía no eligió zona a mano, se sugiere una a partir
 * del texto de la dirección mientras se escribe.
 */
export default function ZoneField({
  zone,
  onZoneChange,
  address,
  className,
}: {
  zone: string;
  onZoneChange: (zone: string) => void;
  address: string;
  className?: string;
}) {
  const guessed = !zone ? guessZoneFromAddress(address) : "";
  return (
    <select
      value={zone || guessed}
      onChange={(e) => onZoneChange(e.target.value)}
      className={className ?? "border rounded-md px-3 py-2"}
    >
      <option value="">Zona (sin definir)</option>
      {ZONES.map((z) => (
        <option key={z} value={z}>
          {z}
        </option>
      ))}
    </select>
  );
}
