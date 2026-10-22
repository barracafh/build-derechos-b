// Cliente de la API pública de la BDNS. Solo servidor: la API no envía CORS.
// Buenas prácticas de la BDNS: como mucho una petición por segundo. La caché
// guarda respuestas públicas por URL; nunca el texto del ciudadano.

import { AsyncLocalStorage } from "node:async_hooks";

export const BASE = "https://www.infosubvenciones.es/bdnstrans/api";
export const urlFicha = (n: string) =>
  `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${n}`;

export const TTL = {
  ficha: 60 * 60_000,
  busqueda: 10 * 60_000,
  catalogo: 24 * 60 * 60_000,
};

const cache = new Map<string, { hasta: number; valor: Promise<unknown> }>();
let cola: Promise<void> = Promise.resolve();
const INTERVALO = 1000;

// Encadena las peticiones para que haya al menos INTERVALO entre una y otra.
function turno(): Promise<void> {
  const mio = cola.then(() => new Promise<void>((r) => setTimeout(r, INTERVALO)));
  const listo = cola;
  cola = mio;
  return listo;
}

async function descargar(url: string): Promise<unknown> {
  for (let intento = 0; ; intento++) {
    await turno();
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`BDNS respondió ${res.status}`);
      return await res.json();
    } catch (e) {
      if (intento >= 1) throw e;
    }
  }
}

// Registro de lo que se manda a la BDNS en una petición del motor, para poder
// revisarlo (campo `peticionesBdns`). Solo URLs públicas, sin texto del ciudadano.
export type PeticionBdns = {
  url: string;
  cache: boolean;
  ms: number | null;
  ok: boolean | null;
  resultados: number | null;
};
const registro = new AsyncLocalStorage<PeticionBdns[]>();

export async function conRegistro<T>(fn: () => Promise<T>) {
  const peticiones: PeticionBdns[] = [];
  const resultado = await registro.run(peticiones, fn);
  return { resultado, peticiones };
}

function anotar(url: string, cache: boolean, valor: Promise<unknown>) {
  const lista = registro.getStore();
  if (!lista) return;
  const p: PeticionBdns = { url, cache, ms: null, ok: null, resultados: null };
  lista.push(p);
  const desde = Date.now();
  valor.then(
    (v) => {
      p.ms = Date.now() - desde;
      p.ok = true;
      const o = v as { totalElements?: number } | unknown[] | null;
      p.resultados = Array.isArray(o) ? o.length : o ? (o.totalElements ?? 1) : 0;
    },
    () => {
      p.ms = Date.now() - desde;
      p.ok = false;
    },
  );
}

export function pedir<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  ttl: number,
): Promise<T> {
  const qs = new URLSearchParams({ vpd: "GE" });
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== "") qs.set(k, String(v));
  const url = `${BASE}${path}?${qs}`;
  const hit = cache.get(url);
  if (hit && hit.hasta > Date.now()) {
    anotar(url, true, hit.valor);
    return hit.valor as Promise<T>;
  }
  const valor = descargar(url);
  anotar(url, false, valor);
  cache.set(url, { hasta: Date.now() + ttl, valor });
  // Un fallo no se queda en caché.
  valor.catch(() => cache.delete(url));
  return valor as Promise<T>;
}

export function forzarCopia() {
  return process.env.BDNS_FORZAR_COPIA === "1";
}
