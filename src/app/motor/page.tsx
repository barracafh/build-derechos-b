import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BotonAviso } from "@/components/BotonAviso";
import { Fuentes } from "@/components/Fuentes";
import {
  ProbarBuscar,
  ProbarCalentar,
  ProbarConvocatorias,
  ProbarFicha,
  ProbarMunicipios,
  ProbarOpciones,
  ProbarPerfil,
} from "@/components/motor/Endpoints";
import { Laboratorio } from "@/components/motor/Laboratorio";
import ficha from "../../../ficha.json";

export const metadata: Metadata = { title: `Motor · ${ficha.nombre}` };

// Documentación interna del motor: qué entra, qué sale y un formulario para
// probar cada endpoint contra la API real de la BDNS.

const FLUJO = [
  ["Perfil", "Todo empieza en un PerfilCiudadano estructurado. Lo rellena la nube de preguntas (sin IA) o la IA a partir del chat o el buscador (llamada 1). Después se traduce a filtros de la BDNS: temas → finalidades y palabras clave; tipo de solicitante → tipo de beneficiario.", "src/lib/opciones.ts · src/lib/interpretar.ts"],
  ["Territorio", "Municipio, provincia o comunidad → ids de /regiones y /organos de la BDNS, para toda España. El filtro de órganos solo funciona con ids hoja.", "src/lib/bdns/territorio.ts"],
  ["Búsquedas", "Hasta 4 búsquedas: Estado, comunidad, diputación y ayuntamiento, de los últimos 12 meses, para personas físicas (1) y autónomos (3) si toca.", "src/lib/bdns/buscar.ts"],
  ["Fichas y reglas", "Ordena por coincidencia del título y abre fichas hasta tener 10 válidas (máx. 15). Descarta las de concesión directa, las cerradas y las de otro territorio. El estado sale de las fechas.", "src/lib/bdns/buscar.ts · estado.ts"],
  ["Explicación", "La IA (llamada 2) decide el encaje (alto, medio, bajo), escribe el motivo y qué comprobar. Las de encaje bajo se descartan.", "src/lib/explicar.ts"],
] as const;

const SALIDA_BUSCAR: [string, string, string][] = [
  ["perfil", "PerfilCiudadano", "El perfil usado. Para «Hemos entendido…»."],
  ["filtros", "{ temas, finalidades, palabrasClave, tiposBeneficiario }", "Cómo se ha traducido el perfil a la BDNS. Para depurar."],
  ["consultado", "string[]", "Administraciones consultadas. Muéstralo siempre."],
  ["noConsultado", "string[]", "Lo que no se ha podido consultar (p. ej. «Municipio: no indicado»)."],
  ["origen", '"api" | "copia"', "«copia» si la BDNS no respondía y se ha usado la copia del pack."],
  ["consultadoEn", "ISO 8601", "Fecha de consulta. Obligatoria por el aviso legal de la BDNS."],
  ["cita", "string", "«Origen de los datos: IGAE». Obligatoria."],
  ["avisos", "string[]", "Notas: descartadas, IA no disponible, copia…"],
  ["resultados", "Resultado[]", "{ convocatoria, encaje, motivo, aComprobar[] }, ya ordenados."],
  ["sinCoincidencias", "string | null", "Texto para mostrar si no hay resultados."],
  ["peticionesBdns", "{ url, cache, ms, ok, resultados }[]", "Cada petición hecha a la BDNS, en orden. Para depurar."],
];

const PERFIL: [string, string, string][] = [
  ["ubicacion", "{ municipio, provincia, ccaa }", "Texto. Con el municipio basta: provincia y comunidad se deducen. Sin municipio, solo se consultan Estado y comunidad."],
  ["tipoPersona", '"fisica" | "juridica" | null', "Con situacion decide el tipo de beneficiario de la BDNS: física → 1; física con situacion autonomo → 1 y 3; jurídica → 2 y 3. null cuenta como física. A una jurídica no se le preguntan edad, hijos, vivienda, ingresos ni situación."],
  ["edad", "number | null", "Menos de 36 añade «joven»; 65 o más, «mayores»."],
  ["situacion", '"paro" | "empleo" | "autonomo" | "jubilado" | "estudiante" | null', "Añade temas implícitos (paro → empleo, estudiante → educación…)."],
  ["hijos", "number | null", "Más de 0 añade los temas familia y educación."],
  ["vivienda", '"alquiler" | "propiedad" | "otra" | null', "Alquiler añade el tema vivienda."],
  ["ingresos", '"bajos" | "medios" | "altos" | null', "Bajos añade servicios sociales."],
  ["temas", "Tema[]", "vivienda, empleo, educacion, familia, energia, salud, servicios_sociales, emprendimiento, transporte, cultura."],
];

const CONVOCATORIA: [string, string, string][] = [
  ["numeroBDNS", "string", "Código de la convocatoria en la BDNS."],
  ["titulo · tituloValenciano", "string", "Título oficial (y en lengua cooficial si lo hay)."],
  ["ambito", '"estatal" | "autonomica" | "local"', "Administración que convoca."],
  ["organo", "{ nivel1, nivel2, nivel3 }", "Órgano convocante, de general a concreto."],
  ["estado", '"abierta" | "proxima" | "permanente" | "consultar"', "Calculado con las fechas. Las cerradas no llegan."],
  ["plazo", "{ inicio, fin, textoInicio, textoFin, indefinido }", "Fechas AAAA-MM-DD y el texto literal de la BDNS."],
  ["finalidad · beneficiarios · regiones", "string · string[]", "Clasificación de la BDNS."],
  ["presupuestoTotal", "number | null", "Presupuesto total de la convocatoria, en euros (no lo que recibe cada persona)."],
  ["bases", "{ titulo, url }", "Bases reguladoras."],
  ["sedeElectronica", "string | null", "Dónde se tramita, si la BDNS lo indica."],
  ["anuncios · documentos", "[]", "Publicaciones en diarios oficiales y PDFs de la convocatoria."],
  ["urlFicha", "string", "Ficha oficial en infosubvenciones.es. Enlázala siempre."],
];

const ESTADOS: [string, string][] = [
  ["abierta", "Hoy está entre la fecha de inicio y la de fin."],
  ["proxima", "La fecha de inicio aún no ha llegado."],
  ["permanente", "Sin fecha de fin y la BDNS la marca como «se puede solicitar indefinidamente»."],
  ["consultar", "El plazo solo viene en texto («quince días hábiles desde la publicación»). Muestra plazo.textoFin y enlaza la ficha: no calculamos fechas que la BDNS no da."],
];

function Tabla({ filas, columnas }: { filas: string[][]; columnas: string[] }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted">
          <tr>
            {columnas.map((c) => (
              <th key={c} scope="col" className="px-4 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {filas.map((f) => (
            <tr key={f[0]}>
              {f.map((celda, i) => (
                <td
                  key={i}
                  className={
                    i < f.length - 1
                      ? "px-4 py-2 align-top font-mono text-xs [overflow-wrap:anywhere]"
                      : "px-4 py-2 align-top"
                  }
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Endpoint({
  id,
  metodo,
  path,
  titulo,
  children,
  probador,
}: {
  id: string;
  metodo: string;
  path: string;
  titulo: string;
  children: ReactNode;
  probador: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-6 border-t pt-12">
      <div>
        <p className="flex flex-wrap items-center gap-2 font-mono text-sm">
          <Badge variant="outline">{metodo}</Badge>
          <span className="[overflow-wrap:anywhere]">/derechos-b{path}</span>
        </p>
        <h2 id={id} className="mt-3 text-[clamp(28px,4vw,36px)] leading-[1.15]">
          {titulo}
        </h2>
      </div>
      <div className="grid gap-4 text-base">{children}</div>
      <Card render={<section aria-label={`Probar ${path}`} />} className="px-5 py-5 text-base">
        {probador}
      </Card>
    </section>
  );
}

export default function Motor() {
  return (
    <>
      <header className="mx-auto flex min-h-20 max-w-(--container-content) flex-wrap items-center justify-between gap-4 px-(--page-gutter) py-4">
        <span className="inline-flex items-center gap-3 text-lg leading-tight font-semibold tracking-tight">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand font-mono text-xl text-white"
          >
            {ficha.icono}
          </span>
          {ficha.nombre}
        </span>
        <Badge variant="outline">Documentación interna</Badge>
      </header>

      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto grid max-w-[860px] gap-12 px-(--page-gutter) pt-12 pb-20 outline-none md:pt-16"
      >
        <div>
          <p className="font-mono text-xs tracking-[0.06em] text-(--text-secondary) uppercase">
            Motor · API BDNS
          </p>
          <h1 className="mt-4 text-[clamp(36px,4.5vw,56px)] leading-[1.1] tracking-[-0.02em]">
            ¿Cómo funciona el motor de ayudas?
          </h1>
          <p className="mt-6 text-lg text-(--text-secondary)">
            Recibe lo que cuenta el ciudadano y devuelve las convocatorias de la
            Base de Datos Nacional de Subvenciones a las que podría optar, con el
            motivo, qué comprobar, el estado del plazo y el enlace oficial. Cada
            formulario de esta página llama al endpoint real.
          </p>
        </div>

        <section aria-labelledby="flujo" className="grid gap-6">
          <h2 id="flujo" className="text-[clamp(28px,4vw,36px)] leading-[1.15]">
            Qué pasa en una búsqueda
          </h2>
          <ol className="grid gap-5 text-base">
            {FLUJO.map(([titulo, texto, archivo], i) => (
              <li key={titulo} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3">
                <span className="text-[24px] leading-[1.1] font-light text-brand tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{titulo}</p>
                  <p className="mt-1">{texto}</p>
                  <p className="mt-1 font-mono text-xs text-(--text-secondary)">{archivo}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
            <Card className="gap-2 bg-muted px-5 py-5 text-base ring-0">
              <h3 className="text-sm font-medium text-(--text-secondary)">Llamadas a la IA</h3>
              <p>2 por búsqueda, nunca por tecla.</p>
            </Card>
            <Card className="gap-2 px-5 py-5 text-base ring-0 [background:radial-gradient(120%_90%_at_100%_0%,#ffd34d_0%,rgba(255,211,77,0)_60%),var(--brand-yellow)]">
              <h3 className="text-sm font-medium">Tiempo de respuesta</h3>
              <p className="font-heading text-3xl">6–20 s</p>
              <p className="text-sm">La BDNS admite 1 petición por segundo. Con caché, mucho menos.</p>
            </Card>
            <Card className="gap-2 bg-muted px-5 py-5 text-base ring-0">
              <h3 className="text-sm font-medium text-(--text-secondary)">Caché en memoria</h3>
              <p>Fichas 1 h, búsquedas 10 min y catálogos 24 h. Solo datos públicos.</p>
            </Card>
          </div>
        </section>

        <section aria-labelledby="paso1" className="grid gap-6 border-t pt-12">
          <div>
            <p className="font-mono text-sm text-(--text-secondary)">Paso 1</p>
            <h2 id="paso1" className="mt-3 text-[clamp(28px,4vw,36px)] leading-[1.15]">
              Tres formas de entrada, un solo perfil
            </h2>
          </div>
          <p className="text-base">
            El front elige cómo preguntar: un buscador de una caja, un chat o una
            nube de preguntas. Las tres acaban en el mismo{" "}
            <span className="font-mono text-sm">PerfilCiudadano</span>, y la búsqueda
            solo recibe ese JSON. Pruébalo: cambia de forma y verás que el perfil
            de abajo es el mismo objeto.
          </p>
          <Card render={<section aria-label="Laboratorio del paso 1" />} className="px-5 py-5 text-base">
            <Laboratorio />
          </Card>
          <h3 className="text-lg font-medium">PerfilCiudadano</h3>
          <Tabla columnas={["Campo", "Valores", "Qué hace en la búsqueda"]} filas={PERFIL} />
          <p className="text-sm text-(--text-secondary)">
            Todo es opcional, pero <span className="font-mono">/api/buscar</span> pide
            al menos la ubicación o algo de la situación. Los valores que no están
            en el catálogo se ignoran (se quedan en null). Traducción a la BDNS en{" "}
            <span className="font-mono">src/lib/opciones.ts</span>.
          </p>
        </section>

        <Endpoint
          id="opciones"
          metodo="GET"
          path="/api/motor/perfil/opciones"
          titulo="Preguntas y opciones del perfil"
          probador={<ProbarOpciones />}
        >
          <p>
            Lo que necesita la nube de preguntas para pintarse: cada pregunta con
            su <span className="font-mono text-sm">id</span> (el campo del perfil), el
            texto, el tipo (<span className="font-mono text-sm">ubicacion</span>,{" "}
            <span className="font-mono text-sm">numero</span>,{" "}
            <span className="font-mono text-sm">opcion</span>,{" "}
            <span className="font-mono text-sm">multiple</span>) y las opciones con valor
            y etiqueta. También devuelve un perfil vacío de partida. No usa IA.
          </p>
        </Endpoint>

        <Endpoint
          id="municipios"
          metodo="GET"
          path="/api/motor/perfil/municipios"
          titulo="Autocompletar el municipio"
          probador={<ProbarMunicipios />}
        >
          <p>
            Para la pregunta «¿Dónde vives?». Devuelve hasta 8 municipios de toda
            España que empiezan por <span className="font-mono text-sm">q</span>, con su
            provincia, sacados del catálogo de órganos de la BDNS. Úsalo con una pausa
            de unos 300 ms entre teclas.
          </p>
          <p>
            Salida: <span className="font-mono text-sm">{"{ municipios: [{ municipio, provincia }] }"}</span>.
            Mete los dos en <span className="font-mono text-sm">perfil.ubicacion</span>.
          </p>
        </Endpoint>

        <Endpoint
          id="perfil"
          metodo="POST"
          path="/api/motor/perfil"
          titulo="Convertir un mensaje en perfil"
          probador={<ProbarPerfil />}
        >
          <p>
            Para el chat y el buscador. La IA (llamada 1) lee el mensaje y devuelve el
            perfil. En un chat, manda en cada mensaje el perfil anterior: el nuevo lo
            completa y no borra lo que ya sabíamos.
          </p>
          <p>
            Entrada: <span className="font-mono text-sm">{"{ mensaje, perfil? }"}</span>. Salida:{" "}
            <span className="font-mono text-sm">{"{ perfil, faltan: [{ id, pregunta }], conIa }"}</span>.{" "}
            <span className="font-mono text-sm">faltan</span> trae las preguntas sin
            responder, en orden: la primera es la siguiente que puede hacer el chat.
          </p>
        </Endpoint>

        <Endpoint
          id="buscar"
          metodo="POST"
          path="/api/buscar"
          titulo="Buscar ayudas para una persona"
          probador={<ProbarBuscar />}
        >
          <p>
            Pasos 2 a 6: del perfil a las convocatorias explicadas. Es lo que pinta
            la pantalla de resultados.
          </p>
          <h3 className="font-medium">Entrada</h3>
          <pre className="overflow-x-auto rounded-xl bg-muted px-4 py-3 font-mono text-xs">
{`// Lo normal: el perfil de la nube o del chat
fetch(ruta("/api/buscar"), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ perfil }),
})

// Atajo para un buscador de una caja (hace también el paso 1)
body: JSON.stringify({ texto: "Tengo 24 años, estoy en paro…" })`}
          </pre>
          <h3 className="font-medium">Salida · RespuestaBuscar</h3>
          <Tabla columnas={["Campo", "Tipo", "Para qué"]} filas={SALIDA_BUSCAR} />
          <p className="text-sm text-(--text-secondary)">
            Errores: 400 si el perfil está vacío o el texto falta o supera 2.000 caracteres; 502 si la
            búsqueda falla. Los dos con {"{ error }"}. Tipos en{" "}
            <span className="font-mono">src/lib/bdns/tipos.ts</span>; ejemplo real en{" "}
            <span className="font-mono">src/datos/ejemplo-buscar.json</span>.
          </p>
        </Endpoint>

        <Endpoint
          id="convocatorias"
          metodo="GET"
          path="/api/motor/convocatorias"
          titulo="Listar convocatorias sin IA"
          probador={<ProbarConvocatorias />}
        >
          <p>
            Los pasos 2 a 4, con filtros explícitos en lugar de texto libre. Útil
            para depurar territorio y reglas, o para una vista de «todas las
            convocatorias de mi municipio».
          </p>
          <h3 className="font-medium">Salida</h3>
          <p>
            <span className="font-mono text-sm">
              {"{ origen, consultadoEn, cita, consultado, noConsultado, avisos, total, convocatorias: Convocatoria[] }"}
            </span>
            . <span className="font-mono text-sm">total</span> es lo que encontró la
            búsqueda antes de abrir fichas y descartar.
          </p>
        </Endpoint>

        <Endpoint
          id="ficha"
          metodo="GET"
          path="/api/motor/convocatorias/[numero]"
          titulo="Ver una convocatoria"
          probador={<ProbarFicha />}
        >
          <p>
            La ficha completa de una convocatoria por su número BDNS, ya
            normalizada. No aplica reglas: devuelve también las cerradas y las de
            concesión directa.
          </p>
          <p>
            Salida:{" "}
            <span className="font-mono text-sm">{"{ origen, consultadoEn, cita, convocatoria }"}</span>;
            404 si no existe; 502 si la BDNS no responde.
          </p>
        </Endpoint>

        <Endpoint
          id="calentar"
          metodo="GET"
          path="/api/calentar"
          titulo="Calentar la caché antes de la demo"
          probador={<ProbarCalentar />}
        >
          <p>
            Precarga los catálogos de territorio y lanza los 4 perfiles de prueba
            del SETUP para que, en la demo, respondan desde la caché. La caché
            vive en la memoria de cada instancia: si el servidor se reinicia, hay
            que volver a calentarla.
          </p>
          <p>
            Salida:{" "}
            <span className="font-mono text-sm">{"{ ms, perfiles: [{ texto, resultados, ms }] }"}</span>.
          </p>
        </Endpoint>

        <section aria-labelledby="referencia" className="grid gap-6 border-t pt-12">
          <h2 id="referencia" className="text-[clamp(28px,4vw,36px)] leading-[1.15]">
            Referencia
          </h2>
          <h3 className="text-lg font-medium">Convocatoria</h3>
          <Tabla columnas={["Campo", "Tipo", "Qué es"]} filas={CONVOCATORIA} />
          <h3 className="text-lg font-medium">Estados del plazo</h3>
          <Tabla columnas={["Estado", "Cuándo"]} filas={ESTADOS} />
          <h3 className="text-lg font-medium">Reglas que cumple el motor</h3>
          <ul className="grid list-disc gap-2 pl-5 text-base">
            <li>Dice «podrías optar», nunca «tienes derecho». No inventa importes, plazos ni requisitos.</li>
            <li>El texto del ciudadano no se guarda ni se registra; la caché usa como clave las URL de la BDNS.</li>
            <li>El estado sale de las fechas de la ficha, no del campo <span className="font-mono text-sm">abierto</span>.</li>
            <li>Se descartan las de concesión directa instrumental: la ciudadanía no puede pedirlas.</li>
            <li>Si la BDNS no responde, usa la copia del pack (Estado, Comunitat Valenciana y Ayuntamiento de València, a 18/10/2026) y lo dice en <span className="font-mono text-sm">avisos</span>.</li>
            <li>
              <span className="font-mono text-sm">BDNS_FORZAR_COPIA=1</span> en el entorno obliga a usar la copia para probar el respaldo.
            </li>
          </ul>
          <Fuentes
            fuentes={[
              { nombre: "API de la BDNS (Swagger)", url: "https://www.infosubvenciones.es/bdnstrans/doc/swagger" },
              { nombre: "Aviso legal de la BDNS", url: "https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal" },
              { nombre: "Buenas prácticas de la API", url: "https://www.infosubvenciones.es/bdnstrans/estaticos/ayuda/Buenas%20pr%C3%A1cticas%20API%20SNPSAP.pdf" },
            ]}
          />
        </section>
      </main>

      <footer className="p-2">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] px-(--page-gutter) py-12 [background:radial-gradient(80%_70%_at_50%_-12%,#ffe58f_0%,rgba(255,229,143,0)_70%),linear-gradient(180deg,#ffd34d_0%,var(--brand-yellow)_46%,var(--brand-orange)_100%)] md:px-12">
          <p className="text-[15px]">
            Una pieza del squad <span className="font-mono">{ficha.equipo}</span> · Build night
          </p>
          <BotonAviso />
        </div>
      </footer>
    </>
  );
}
