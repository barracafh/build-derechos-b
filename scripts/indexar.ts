// Indexador: BDNS → fichas → prefiltro → IA (requisitos) → src/datos/indice/<ambito>.json
// Se lanza a mano, fuera de la web:
//   bun scripts/indexar.ts                    # València (Generalitat, Diputación, Ayuntamiento y Estado)
//   bun scripts/indexar.ts --limite=20        # prueba con las 20 más recientes
//   bun scripts/indexar.ts --sin-ia           # solo descarga fichas (sin clave de HelmCode)
//   bun scripts/indexar.ts --ambito=alacant --solo-local   # otra ciudad de la CV: solo ayuntamiento y diputación
//   bun scripts/indexar.ts --concurrencia=2 --meses=12
// Reanudable: fichas y requisitos se guardan en scripts/.cache (no se sube).
// Solo datos públicos de la BDNS: aquí no entra nada de ningún ciudadano.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pedir, TTL } from "../src/lib/bdns/cliente";
import { enSuTerritorio } from "../src/lib/bdns/buscar";
import { desdeApi, textoPlano } from "../src/lib/bdns/normalizar";
import { resolverTerritorio } from "../src/lib/bdns/territorio";
import { CITA, type ConvocatoriaIndexada, type Indice, type RequisitosConvocatoria } from "../src/lib/bdns/tipos";
import { extraerRequisitos, VERSION_EXTRACCION } from "../src/lib/indice/extraer";

const arg = (k: string, d?: string) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? (process.argv.includes(`--${k}`) ? "1" : d);

const AMBITO = arg("ambito", "valencia")!;
const LIMITE = Number(arg("limite", "0"));
const SIN_IA = arg("sin-ia") === "1" || !process.env.HELMCODE_API_KEY;
const CONCURRENCIA = Math.max(1, Math.min(4, Number(arg("concurrencia", "2"))));
const MESES = Number(arg("meses", "12"));
// Solo ayuntamiento y diputación: Estado y comunidad se comparten con el índice
// de València (src/lib/indice/buscar.ts los reutiliza para toda la CV).
const SOLO_LOCAL = arg("solo-local") === "1";
const LUGARES: Record<string, { municipio: string; provincia: string | null; ccaa: string | null }> = {
  valencia: { municipio: "València", provincia: "Valencia", ccaa: null },
  castello: { municipio: "Castelló de la Plana / Castellón de la Plana", provincia: null, ccaa: null },
  alacant: { municipio: "Alacant / Alicante", provincia: null, ccaa: null },
};

const CACHE = join(process.cwd(), "scripts", ".cache");
const DIR_FICHAS = join(CACHE, "fichas");
const DIR_REQ = join(CACHE, `requisitos-v${VERSION_EXTRACCION}`);
const SALIDA = arg("salida") ?? join(process.cwd(), "src", "datos", "indice", `${AMBITO}.json`);
for (const d of [DIR_FICHAS, DIR_REQ, join(SALIDA, "..")]) mkdirSync(d, { recursive: true });

const log = (...xs: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...xs);
const leer = (f: string) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : undefined);

const ddmmaaaa = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

type Fila = { numeroConvocatoria: string; fechaRecepcion: string };

async function listar(etiqueta: string, params: Record<string, string>) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - MESES);
  const filas: Fila[] = [];
  for (let page = 0; ; page++) {
    const r = await pedir<{ content: Fila[]; totalElements: number; last?: boolean }>(
      "/convocatorias/busqueda",
      {
        ...params,
        page,
        pageSize: 200,
        order: "fechaRecepcion",
        direccion: "desc",
        fechaDesde: ddmmaaaa(desde),
        // 1 personas físicas, 2 entidades sin actividad económica, 3 autónomos y pymes
        tiposBeneficiario: "1,2,3",
      },
      TTL.busqueda,
    );
    filas.push(...(r?.content ?? []));
    log(`${etiqueta}: ${filas.length}/${r?.totalElements ?? 0}`);
    if (!r?.content?.length || filas.length >= (r.totalElements ?? 0) || r.last) break;
    if (LIMITE && filas.length >= LIMITE) break;
  }
  return filas;
}

async function ficha(n: string): Promise<any | null> {
  const f = join(DIR_FICHAS, `${n}.json`);
  const hay = leer(f);
  if (hay !== undefined) return hay;
  const r = await pedir<unknown>("/convocatorias", { numConv: n }, TTL.ficha);
  writeFileSync(f, JSON.stringify(r));
  return r;
}

async function main() {
  const lugar = LUGARES[AMBITO];
  if (!lugar) throw new Error(`Ámbito desconocido: ${AMBITO}. Opciones: ${Object.keys(LUGARES).join(", ")}`);
  log(`Indexando ${AMBITO}${LIMITE ? ` (límite ${LIMITE})` : ""}${SIN_IA ? " SIN IA" : ` con IA ×${CONCURRENCIA}`}`);

  // 1. Listar todas las convocatorias del territorio.
  const t = await resolverTerritorio(lugar);
  LUGAR = { municipio: lugar.municipio, nuts: t.nuts };
  // De lo más cercano a lo más lejano: el índice sirve ya a medio hacer.
  const busquedas: [string, Record<string, string>][] = [];
  if (t.municipio) busquedas.push([t.municipio.nombre, { tipoAdministracion: "L", organos: t.municipio.organos.join(",") }]);
  if (t.diputacion) busquedas.push([t.diputacion.nombre, { tipoAdministracion: "L", organos: t.diputacion.organos.join(",") }]);
  if (!SOLO_LOCAL) {
    if (t.ccaa) busquedas.push([t.ccaa.nombre, { tipoAdministracion: "A", regiones: t.ccaa.regiones.join(",") }]);
    busquedas.push(["Estado", { tipoAdministracion: "C" }]);
  }

  const vistos = new Set<string>();
  let numeros: string[] = [];
  for (const [etiqueta, params] of busquedas)
    for (const f of await listar(etiqueta, params))
      if (!vistos.has(f.numeroConvocatoria)) {
        vistos.add(f.numeroConvocatoria);
        numeros.push(f.numeroConvocatoria);
      }
  if (LIMITE) numeros = numeros.slice(0, LIMITE);
  log(`${numeros.length} convocatorias distintas. Descargando fichas (1 por segundo)…`);

  // 2. Fichas (en serie, 1/s) + 3. prefiltro sin IA; 4. la IA va en paralelo
  // mientras siguen bajando fichas, y 5. comprueba las citas (extraer.ts).
  const salida: ConvocatoriaIndexada[] = [];
  const descartes = { instrumental: 0, cerrada: 0, fuera: 0, error: 0 };
  let enCurso = 0;
  let fallos = 0;
  const pendientes: Promise<void>[] = [];

  async function enriquecer(c: ReturnType<typeof desdeApi>) {
    const f = join(DIR_REQ, `${c.numeroBDNS}.json`);
    let requisitos: RequisitosConvocatoria | null = leer(f) ?? null;
    if (!requisitos && !SIN_IA && c.extracto) {
      try {
        requisitos = await extraerRequisitos(c);
        writeFileSync(f, JSON.stringify(requisitos));
      } catch (e) {
        fallos++;
        log(`IA falló en ${c.numeroBDNS}: ${(e as Error).message}`);
      }
    }
    const { extracto: _, ...publica } = c;
    salida.push({ ...publica, requisitos });
    if (salida.length % 20 === 0) guardar(salida);
  }

  for (const [i, n] of numeros.entries()) {
    try {
      const f = await ficha(n);
      if (f) {
        const c = { ...desdeApi(f), extracto: textoPlano(f.anuncios?.[0]?.texto, 6000) };
        if (/instrumental/i.test(c.tipoConvocatoria ?? "") || /nominativ/i.test(c.titulo)) descartes.instrumental++;
        else if (c.estado === "cerrada") descartes.cerrada++;
        else if (!enSuTerritorio(c, t.nuts)) descartes.fuera++;
        else {
          while (enCurso >= CONCURRENCIA) await new Promise((r) => setTimeout(r, 200));
          enCurso++;
          pendientes.push(enriquecer(c).finally(() => enCurso--));
        }
      }
    } catch {
      descartes.error++;
    }
    if ((i + 1) % 25 === 0)
      log(`fichas ${i + 1}/${numeros.length} · indexadas ${salida.length} · fallos IA ${fallos}`, descartes);
  }
  await Promise.all(pendientes);
  guardar(salida);
  log(`Hecho: ${salida.length} convocatorias, ${salida.filter((c) => c.requisitos).length} con requisitos`, descartes, `→ ${SALIDA}`);
}

let LUGAR: Indice["lugar"] = { municipio: null, nuts: null };

function guardar(convocatorias: ConvocatoriaIndexada[]) {
  const indice: Indice = {
    version: VERSION_EXTRACCION,
    ambito: AMBITO,
    lugar: LUGAR,
    generado: new Date().toISOString(),
    cita: CITA,
    convocatorias: [...convocatorias].sort((a, b) => b.fechaRecepcion.localeCompare(a.fechaRecepcion)),
  };
  writeFileSync(SALIDA, JSON.stringify(indice));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
