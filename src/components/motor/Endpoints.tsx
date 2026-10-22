"use client";
import { Probador } from "./Probador";
import { VistaBuscar, VistaFicha, VistaLista } from "./Vistas";

// Los 4 perfiles de prueba del SETUP.md.
const PERFILES = [
  { etiqueta: "Joven en paro, València", texto: "Tengo 24 años, estoy en paro y vivo de alquiler en València, sin hijos." },
  { etiqueta: "Madre autónoma, Castelló", texto: "Soy madre autónoma con 2 hijos en Castelló de la Plana y tengo ingresos bajos." },
  { etiqueta: "Jubilado, la Safor", texto: "Tengo 70 años, vivo en un pueblo de la Safor, cobro la pensión mínima y la factura de la luz es alta." },
  { etiqueta: "Familia, 3 hijos", texto: "Somos una familia con 3 hijos en edad escolar en València." },
];

const PERFIL_EJEMPLO = JSON.stringify(
  {
    ubicacion: { municipio: "Castelló de la Plana", provincia: null, ccaa: null },
    tipoSolicitante: "autonomo",
    edad: 38,
    situacion: "autonomo",
    hijos: 2,
    vivienda: null,
    ingresos: "bajos",
    temas: ["emprendimiento"],
  },
  null,
  2,
);

export function ProbarBuscar() {
  return (
    <Probador
      metodo="POST"
      path="/api/buscar"
      campos={[
        {
          nombre: "perfil",
          etiqueta: "PerfilCiudadano (JSON)",
          ayuda: "Lo normal. Si lo dejas vacío, se usa «texto».",
          valor: PERFIL_EJEMPLO,
          largo: true,
          json: true,
        },
        {
          nombre: "texto",
          etiqueta: "Texto libre (atajo)",
          ayuda: "Solo si no hay perfil: hace también el paso 1 con IA.",
          largo: true,
        },
      ]}
      ejemplos={[
        { etiqueta: "Con perfil", valores: { perfil: PERFIL_EJEMPLO, texto: "" } },
        ...PERFILES.map((p) => ({ etiqueta: `Texto: ${p.etiqueta}`, valores: { perfil: "", texto: p.texto } })),
      ]}
      vista={VistaBuscar}
    />
  );
}

export function ProbarPerfil() {
  return (
    <Probador
      metodo="POST"
      path="/api/motor/perfil"
      campos={[
        { nombre: "mensaje", etiqueta: "Mensaje", valor: "Tengo 2 hijos y vivo de alquiler", largo: true },
        {
          nombre: "perfil",
          etiqueta: "Perfil previo (JSON, opcional)",
          ayuda: "En un chat, el perfil que devolvió el mensaje anterior. El nuevo mensaje lo completa.",
          valor: JSON.stringify({ ubicacion: { municipio: "Gandia", provincia: null, ccaa: null }, edad: 41 }),
          largo: true,
          json: true,
        },
      ]}
      ejemplos={PERFILES.map((p) => ({ etiqueta: p.etiqueta, valores: { mensaje: p.texto, perfil: "" } }))}
    />
  );
}

export function ProbarOpciones() {
  return <Probador metodo="GET" path="/api/motor/perfil/opciones" campos={[]} />;
}

export function ProbarMunicipios() {
  return (
    <Probador
      metodo="GET"
      path="/api/motor/perfil/municipios"
      campos={[{ nombre: "q", etiqueta: "Empieza por", valor: "gand", ayuda: "Mínimo 2 letras. Sin acentos también vale." }]}
    />
  );
}

export function ProbarConvocatorias() {
  return (
    <Probador
      metodo="GET"
      path="/api/motor/convocatorias"
      campos={[
        { nombre: "municipio", etiqueta: "Municipio", valor: "Gandia", ayuda: "Cualquier municipio de España. Resuelve diputación y comunidad." },
        { nombre: "provincia", etiqueta: "Provincia", ayuda: "Opcional. Sirve para desambiguar o si no hay municipio." },
        { nombre: "ccaa", etiqueta: "Comunidad autónoma", ayuda: "Opcional, p. ej. «Andalucía» o «Comunitat Valenciana»." },
        { nombre: "claves", etiqueta: "Palabras clave", valor: "alquiler,vivienda,joven", ayuda: "Separadas por comas. Ordenan las candidatas por su título." },
        { nombre: "finalidad", etiqueta: "Finalidad BDNS", ayuda: "Id del catálogo: 8 vivienda, 7 desempleo, 10 educación, 5 servicios sociales…" },
        { nombre: "beneficiarios", etiqueta: "Tipos de beneficiario", valor: "1", ayuda: "1 personas físicas, 3 autónomos y pymes. P. ej. «1,3»." },
        { nombre: "limite", etiqueta: "Límite", valor: "5", ayuda: "Fichas válidas que se devuelven, de 1 a 10." },
        { nombre: "meses", etiqueta: "Meses atrás", valor: "12" },
      ]}
      ejemplos={[
        { etiqueta: "Gandia · vivienda", valores: { municipio: "Gandia", claves: "alquiler,vivienda,joven", finalidad: "" } },
        { etiqueta: "Dos Hermanas · familia", valores: { municipio: "Dos Hermanas", claves: "familia,hijos,becas", finalidad: "" } },
        { etiqueta: "Solo Andalucía", valores: { municipio: "", ccaa: "Andalucía", claves: "empleo", finalidad: "" } },
      ]}
      vista={VistaLista}
    />
  );
}

export function ProbarFicha() {
  return (
    <Probador
      metodo="GET"
      path="/api/motor/convocatorias/[numero]"
      campos={[
        {
          nombre: "numero",
          etiqueta: "Número BDNS",
          valor: "930830",
          enRuta: true,
          ayuda: "937126 es de concesión directa: la búsqueda la descarta, pero la ficha se puede ver.",
        },
      ]}
      vista={VistaFicha}
    />
  );
}

export function ProbarCalentar() {
  return (
    <Probador
      metodo="GET"
      path="/api/calentar"
      campos={[]}
      aviso="Lanza los 4 perfiles uno tras otro: tarda 1–2 minutos y hace unas 60 peticiones a la BDNS y 8 a la IA. Úsalo solo antes de la demo."
    />
  );
}
