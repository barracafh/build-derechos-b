// Del municipio, provincia o comunidad que cuenta el ciudadano a los filtros de
// la BDNS, con dos catálogos de la propia API: /regiones (árbol NUTS) y
// /organos?idAdmon=L (provincia → municipio o diputación → órganos).
// El filtro `organos` solo funciona con ids hoja: el id del municipio devuelve 0.
import { pedir, TTL } from "./cliente";

type Nodo = { id: number; descripcion: string; children?: Nodo[] | null };

export type Territorio = {
  nuts: string | null; // el código más fino que conocemos: ES523, ES52…
  ccaa: { nombre: string; regiones: number[] } | null;
  diputacion: { nombre: string; organos: number[] } | null;
  municipio: { nombre: string; organos: number[] } | null;
  noResuelto: string[];
};

export function normalizar(s: string): string[] {
  return s
    .split("/")
    .map((v) =>
      v
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[’`]/g, "'")
        .replace(/^ayuntamiento de /, "")
        // «ESCALA, L'» → «l'escala»; «ROSARIO, EL» → «el rosario»
        .replace(/^(.*), (l'|el|la|els|les|los|las|o|a|as|os)$/, "$2 $1")
        .replace(/[^a-z0-9ñç' ]+/g, " ")
        .replace(/' /g, "'")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

const coincide = (a: string, b: string) => {
  const nb = normalizar(b);
  return normalizar(a).some((x) => nb.includes(x));
};

const hojas = (n: Nodo): number[] =>
  n.children?.length ? n.children.flatMap(hojas) : [n.id];

const nombreBonito = (s: string) =>
  s
    .split("/")[0]
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'(-])\p{L}/gu, (m) => m.toUpperCase())
    .replace(/ (De|Del|La|Las|Los|El|I|Y) /g, (m) => m.toLowerCase());

// Provincias del árbol de órganos que en NUTS se parten en islas.
const PROVINCIA_A_NUTS2: Record<string, string> = {
  "las palmas": "ES70",
  "santa cruz de tenerife": "ES70",
  "illes balears": "ES53",
};

// Nombres con que la gente llama a su comunidad y no salen tal cual en NUTS.
// Nombres cortos con que se llama a una ciudad y que en la BDNS son otro
// municipio o no existen («Castelló» a secas es Castelló de la Ribera).
const ALIAS_MUNICIPIO: Record<string, string> = {
  castellon: "Castellón de la Plana",
  castello: "Castellón de la Plana",
  "castello de la plana": "Castellón de la Plana",
  alicante: "Alicante",
  alacant: "Alicante",
  valencia: "Valencia",
  elche: "Elche",
  elx: "Elche",
  "palmas de gran canaria": "Palmas de Gran Canaria, Las",
  "las palmas": "Palmas de Gran Canaria, Las",
  "palma de mallorca": "Palma",
};

const ALIAS_CCAA: Record<string, string> = {
  "comunitat valenciana": "ES52",
  valencia: "ES52",
  "pais valencia": "ES52",
  catalunya: "ES51",
  "pais vasco": "ES21",
  euskadi: "ES21",
  navarra: "ES22",
  "castilla y leon": "ES41",
  "castilla la mancha": "ES42",
  madrid: "ES30",
  murcia: "ES62",
  asturias: "ES12",
  baleares: "ES53",
  "islas baleares": "ES53",
  galiza: "ES11",
};

type Nuts = { id: number; codigo: string; nombre: string; padre: string | null };

async function catalogos() {
  const [regiones, organos] = await Promise.all([
    pedir<Nodo[]>("/regiones", {}, TTL.catalogo),
    pedir<Nodo[]>("/organos", { idAdmon: "L" }, TTL.catalogo),
  ]);
  const nuts: Nuts[] = [];
  const recorrer = (ns: Nodo[], padre: string | null) => {
    for (const n of ns) {
      const [codigo, ...resto] = n.descripcion.split(" - ");
      const c = codigo.trim();
      nuts.push({ id: n.id, codigo: c, nombre: resto.join(" - ").trim(), padre });
      recorrer(n.children ?? [], c);
    }
  };
  recorrer(regiones ?? [], null);
  return { nuts, organos: organos ?? [] };
}

// Sin IA: busca en el texto el nombre más largo de municipio del catálogo.
export async function detectarMunicipio(texto: string): Promise<string | null> {
  const { organos } = await catalogos();
  const t = ` ${normalizar(texto.replace(/\//g, " ")).join(" ")} `;
  let mejor: { nombre: string; largo: number } | null = null;
  for (const p of organos)
    for (const m of p.children ?? []) {
      if (/^(diputaci|mancomunidad|consorcio|comarca)/i.test(m.descripcion)) continue;
      for (const v of normalizar(m.descripcion))
        if (v.length >= 4 && v.length > (mejor?.largo ?? 0) && t.includes(` ${v} `))
          mejor = { nombre: m.descripcion.split("/")[0].trim(), largo: v.length };
    }
  return mejor?.nombre ?? null;
}

// Autocompletado para la pregunta «¿Dónde vives?»: municipios que empiezan por q.
export async function sugerirMunicipios(q: string, max = 8) {
  const [n] = normalizar(q);
  if (!n || n.length < 2) return [];
  const { organos } = await catalogos();
  const salida: { municipio: string; provincia: string }[] = [];
  for (const p of organos)
    for (const m of p.children ?? []) {
      if (/^(diputaci|mancomunidad|consorcio|comarca)/i.test(m.descripcion)) continue;
      if (normalizar(m.descripcion).some((v) => v.startsWith(n)))
        salida.push({ municipio: nombreBonito(m.descripcion), provincia: nombreBonito(p.descripcion) });
    }
  return salida
    .sort((a, b) => a.municipio.length - b.municipio.length || a.municipio.localeCompare(b.municipio))
    .slice(0, max);
}

export async function precargarTerritorio() {
  await catalogos();
}

export async function resolverTerritorio(lugar: {
  municipio: string | null;
  provincia: string | null;
  ccaa: string | null;
}): Promise<Territorio> {
  const { nuts, organos } = await catalogos();
  const noResuelto: string[] = [];

  // 1. Municipio (y con él, su provincia).
  let provincia: Nodo | undefined;
  let municipio: Nodo | undefined;
  if (lugar.provincia)
    provincia = organos.find((p) => coincide(lugar.provincia!, p.descripcion));
  if (lugar.municipio) {
    const alias = ALIAS_MUNICIPIO[normalizar(lugar.municipio)[0] ?? ""];
    if (alias) lugar = { ...lugar, municipio: alias };
    const enProvincia = (p: Nodo) =>
      (p.children ?? []).find(
        (m) =>
          !/^(diputaci|mancomunidad|consorcio|comarca)/i.test(m.descripcion) &&
          coincide(lugar.municipio!, m.descripcion),
      );
    if (provincia) municipio = enProvincia(provincia);
    if (!municipio)
      for (const p of organos) {
        municipio = enProvincia(p);
        if (municipio) {
          provincia ??= p;
          break;
        }
      }
    if (!municipio) noResuelto.push(`Municipio «${lugar.municipio}»: no está en la BDNS`);
  } else noResuelto.push("Municipio: no indicado");

  // 2. Comunidad autónoma: de la provincia, o del nombre que da el ciudadano.
  let nuts2: Nuts | undefined;
  let nuts3: Nuts | undefined;
  if (provincia) {
    const [nombre] = normalizar(provincia.descripcion);
    nuts3 = nuts.find(
      (n) => n.codigo.length === 5 && n.codigo !== "ES" && coincide(provincia!.descripcion, n.nombre),
    );
    const cod2 = nuts3?.padre ?? PROVINCIA_A_NUTS2[nombre];
    nuts2 = nuts.find((n) => n.codigo === cod2);
  }
  if (!nuts2 && lugar.ccaa) {
    const [n] = normalizar(lugar.ccaa);
    const alias = ALIAS_CCAA[n.replace(/^(comunidad|comunitat|region|principado) (de )?/, "")] ?? ALIAS_CCAA[n];
    nuts2 = nuts.find(
      (x) => x.codigo.length === 4 && (x.codigo === alias || coincide(lugar.ccaa!, x.nombre)),
    );
  }
  if (!nuts2) noResuelto.push("Comunidad autónoma: no indicada");

  const regiones = nuts2
    ? [nuts2.id, ...nuts.filter((n) => n.padre === nuts2!.codigo).map((n) => n.id)]
    : [];

  // 3. Diputación de la provincia (las uniprovinciales no tienen).
  const dip = provincia?.children?.find((m) =>
    /^diputaci[oó]n/i.test(m.descripcion),
  );

  return {
    nuts: nuts3?.codigo ?? nuts2?.codigo ?? null,
    ccaa: nuts2 ? { nombre: nombreBonito(nuts2.nombre), regiones } : null,
    diputacion: dip
      ? { nombre: nombreBonito(dip.descripcion).replace("Prov.", "Provincial"), organos: hojas(dip) }
      : null,
    municipio: municipio
      ? { nombre: `Ayuntamiento de ${nombreBonito(municipio.descripcion)}`, organos: hojas(municipio) }
      : null,
    noResuelto,
  };
}
