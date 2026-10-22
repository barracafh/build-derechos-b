// Pipeline de datos, sin IA: búsquedas por ámbito → preselección por título →
// fichas → reglas (instrumental, cerrada, ámbito). Si la API cae, usa la copia.
import copia from "../../../datos/bdns-convocatorias-cv.json";
import { forzarCopia, pedir, TTL } from "./cliente";
import { desdeApi, desdeCopia } from "./normalizar";
import { normalizar, type Territorio } from "./territorio";
import type { ConvocatoriaInterna } from "./tipos";

export type Filtros = {
  palabrasClave: string[];
  finalidades: number[];
  tiposBeneficiario: number[]; // 1 personas físicas, 3 autónomos y pymes
  limite: number; // fichas que se piden (máximo 10)
  meses: number;
};

type Fila = {
  numeroConvocatoria: string;
  descripcion: string;
  descripcionLeng: string | null;
  fechaRecepcion: string;
  nivel1: string;
};

type Busqueda = { etiqueta: string; params: Record<string, string> };

export type SalidaDatos = {
  origen: "api" | "copia";
  consultado: string[];
  avisos: string[];
  total: number;
  convocatorias: ConvocatoriaInterna[];
};

const ddmmaaaa = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

function busquedas(t: Territorio, f: Filtros): Busqueda[] {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - f.meses);
  const comun = {
    page: "0",
    pageSize: "50",
    order: "fechaRecepcion",
    direccion: "desc",
    fechaDesde: ddmmaaaa(desde),
    tiposBeneficiario: f.tiposBeneficiario.join(","),
  };
  const lista: Busqueda[] = [
    { etiqueta: "Estado", params: { ...comun, tipoAdministracion: "C" } },
  ];
  if (t.ccaa)
    lista.push({
      etiqueta: t.ccaa.nombre,
      params: { ...comun, tipoAdministracion: "A", regiones: t.ccaa.regiones.join(",") },
    });
  if (t.diputacion)
    lista.push({
      etiqueta: t.diputacion.nombre,
      params: { ...comun, tipoAdministracion: "L", organos: t.diputacion.organos.join(",") },
    });
  if (t.municipio)
    lista.push({
      etiqueta: t.municipio.nombre,
      params: { ...comun, tipoAdministracion: "L", organos: t.municipio.organos.join(",") },
    });
  return lista;
}

// Palabras de 4+ letras sin acentos, para comparar títulos.
const raices = (s: string) =>
  normalizar(s)
    .join(" ")
    .split(" ")
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, 6));

function puntuar(titulo: string, claves: string[]) {
  const t = new Set(raices(titulo));
  return claves.reduce((n, c) => n + (t.has(c) ? 1 : 0), 0);
}

// Excluye las del Estado limitadas a otras comunidades: se queda si alguna región
// de la convocatoria contiene el territorio del ciudadano (ES ⊂ ES5 ⊂ ES52 ⊂ ES523).
function enSuTerritorio(c: ConvocatoriaInterna, nuts: string | null) {
  if (!nuts || c.regiones.length === 0) return true;
  return c.regiones.some((r) => {
    const cod = r.split(" - ")[0].trim();
    return nuts.startsWith(cod) || cod.startsWith(nuts);
  });
}

type Descarte = "instrumental" | "cerrada" | "fuera";

function descarte(c: ConvocatoriaInterna, t: Territorio): Descarte | null {
  if (/instrumental/i.test(c.tipoConvocatoria ?? "")) return "instrumental";
  if (c.estado === "cerrada") return "cerrada";
  if (!enSuTerritorio(c, t.nuts)) return "fuera";
  return null;
}

const TEXTO_DESCARTE: Record<Descarte, string> = {
  instrumental: "de concesión directa (no se pueden solicitar)",
  cerrada: "con el plazo ya cerrado",
  fuera: "limitadas a otro territorio",
};

function avisarDescartes(cuenta: Partial<Record<Descarte, number>>, avisos: string[]) {
  for (const [k, n] of Object.entries(cuenta))
    if (n) avisos.push(`Se han descartado ${n} ${TEXTO_DESCARTE[k as Descarte]}.`);
}

// Ordena por coincidencias con las palabras clave; si ninguna coincide, por fecha.
function preseleccionar<T>(xs: T[], texto: (x: T) => string, fecha: (x: T) => string, claves: string[]) {
  const puntuadas = xs
    .map((x) => ({ x, p: puntuar(texto(x), claves) }))
    .sort((a, b) => b.p - a.p || fecha(b.x).localeCompare(fecha(a.x)));
  const con = puntuadas.filter((y) => y.p > 0);
  return (con.length ? con : puntuadas).map((y) => y.x);
}

// Fichas que se piden como mucho por búsqueda (a 1 por segundo).
const MAX_FICHAS = 15;

export async function buscarConvocatorias(
  t: Territorio,
  f: Filtros,
): Promise<SalidaDatos> {
  const avisos: string[] = [];
  const consultado: string[] = [];
  const limite = Math.min(Math.max(f.limite, 1), 10);
  const claves = f.palabrasClave.flatMap(raices);

  if (!forzarCopia()) {
    const filas = new Map<string, Fila>();
    let total = 0;
    for (const b of busquedas(t, f)) {
      try {
        const r = await pedir<{ content: Fila[]; totalElements: number }>(
          "/convocatorias/busqueda",
          f.finalidades.length === 1 ? { ...b.params, finalidad: String(f.finalidades[0]) } : b.params,
          TTL.busqueda,
        );
        consultado.push(b.etiqueta);
        total += r?.totalElements ?? 0;
        for (const fila of r?.content ?? []) filas.set(fila.numeroConvocatoria, fila);
      } catch {
        avisos.push(`No se ha podido consultar: ${b.etiqueta}.`);
      }
    }

    if (consultado.length > 0) {
      const candidatas = preseleccionar(
        [...filas.values()],
        (x) => `${x.descripcion} ${x.descripcionLeng ?? ""}`,
        (x) => x.fechaRecepcion,
        claves,
      );
      const elegidas: ConvocatoriaInterna[] = [];
      const cuenta: Partial<Record<Descarte, number>> = {};
      let pedidas = 0;
      for (const fila of candidatas) {
        if (elegidas.length >= limite || pedidas >= MAX_FICHAS) break;
        pedidas++;
        try {
          const ficha = await pedir<unknown>(
            "/convocatorias",
            { numConv: fila.numeroConvocatoria },
            TTL.ficha,
          );
          if (!ficha) continue;
          const c = desdeApi(ficha);
          const d = descarte(c, t);
          if (d) cuenta[d] = (cuenta[d] ?? 0) + 1;
          else elegidas.push(c);
        } catch {
          avisos.push(`No se ha podido abrir la ficha ${fila.numeroConvocatoria}.`);
        }
      }
      avisarDescartes(cuenta, avisos);
      return { origen: "api", consultado, avisos, total, convocatorias: elegidas };
    }
  }

  // Respaldo: copia del pack (BDNS a 18/10/2026; solo Estado, CV y Ayuntamiento de València).
  avisos.unshift(
    `La API de la BDNS no responde: se muestra una copia del ${copia.version.split("-").reverse().join("/")}, que solo cubre el Estado, la Comunitat Valenciana y el Ayuntamiento de València. Revisa el plazo en la ficha oficial.`,
  );
  const grupos = ["estatal"];
  if (t.ccaa?.regiones.includes(54)) grupos.push("autonomica_cv");
  if (t.municipio?.organos.includes(2903)) grupos.push("local_ayuntamiento_valencia");
  const cuenta: Partial<Record<Descarte, number>> = {};
  const elegidas = preseleccionar(
    copia.convocatorias.filter((c) => grupos.includes(c.grupoConsulta)).map(desdeCopia),
    (c) => c.titulo,
    (c) => c.fechaRecepcion,
    claves,
  )
    .filter((c) => {
      const d = descarte(c, t);
      if (d) cuenta[d] = (cuenta[d] ?? 0) + 1;
      return !d;
    })
    .slice(0, limite);
  avisarDescartes(cuenta, avisos);
  return {
    origen: "copia",
    consultado: ["Copia de respaldo de la BDNS"],
    avisos,
    total: copia.convocatorias.length,
    convocatorias: elegidas,
  };
}
