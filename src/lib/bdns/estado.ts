import type { Estado } from "./tipos";

// Hoy en España peninsular, como "AAAA-MM-DD" (las fechas de la BDNS van así).
export function hoyMadrid(fecha = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

// El estado sale de las fechas. El campo `abierto` de la BDNS solo significa
// «se puede solicitar indefinidamente», no «abierta hoy».
export function calcularEstado(
  inicio: string | null,
  fin: string | null,
  indefinido: boolean,
  hoy = hoyMadrid(),
): Estado {
  if (fin && fin < hoy) return "cerrada";
  if (inicio && inicio > hoy) return "proxima";
  if (fin) return "abierta";
  if (!fin && indefinido) return "permanente";
  return "consultar";
}
