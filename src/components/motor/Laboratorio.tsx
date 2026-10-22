"use client";
// Paso 1 en vivo: tres formas de construir el mismo PerfilCiudadano (buscador,
// chat y nube de preguntas) y un botón que busca con él. Para que el equipo vea
// que las tres acaban en el mismo JSON.
import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ruta } from "@/config/sitio";
import type { PerfilCiudadano, RespuestaBuscar } from "@/lib/bdns/tipos";
import type { Pregunta } from "@/lib/opciones";
import { VistaBuscar, resumenPerfil } from "./Vistas";

type Modo = "buscador" | "chat" | "nube";
type Falta = { id: string; pregunta: string };

const VACIO: PerfilCiudadano = {
  ubicacion: { municipio: null, provincia: null, ccaa: null },
  tipoSolicitante: null,
  edad: null,
  situacion: null,
  hijos: null,
  vivienda: null,
  ingresos: null,
  temas: [],
};

async function postJson(path: string, body: unknown) {
  const res = await fetch(ruta(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: "Respuesta no válida" }));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export function Laboratorio() {
  const [modo, setModo] = useState<Modo>("nube");
  const [perfil, setPerfil] = useState<PerfilCiudadano>(VACIO);
  const [faltan, setFaltan] = useState<Falta[]>([]);
  const [busqueda, setBusqueda] = useState<
    { tipo: "inicio" } | { tipo: "cargando" } | { tipo: "hecho"; r: RespuestaBuscar; ms: number } | { tipo: "error"; msg: string }
  >({ tipo: "inicio" });

  async function buscar() {
    setBusqueda({ tipo: "cargando" });
    const desde = Date.now();
    try {
      const r = await postJson("/api/buscar", { perfil });
      setBusqueda({ tipo: "hecho", r, ms: Date.now() - desde });
    } catch (e) {
      setBusqueda({ tipo: "error", msg: (e as Error).message });
    }
  }

  const MODOS: [Modo, string, string][] = [
    ["buscador", "Buscador", "Una caja de texto → POST /api/motor/perfil una vez"],
    ["chat", "Chat", "Varios mensajes → POST /api/motor/perfil en cada uno, con el perfil anterior"],
    ["nube", "Nube de preguntas", "GET /api/motor/perfil/opciones → el front construye el perfil, sin IA"],
  ];

  return (
    <div className="grid gap-6">
      <div role="group" aria-label="Forma de entrada" className="flex flex-wrap gap-2">
        {MODOS.map(([m, etiqueta]) => (
          <Button
            key={m}
            type="button"
            variant={modo === m ? "secondary" : "outline"}
            aria-pressed={modo === m}
            onClick={() => setModo(m)}
          >
            {etiqueta}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setPerfil(VACIO);
            setFaltan([]);
            setBusqueda({ tipo: "inicio" });
          }}
        >
          Vaciar perfil
        </Button>
      </div>
      <p className="font-mono text-sm text-(--text-secondary)">
        {MODOS.find(([m]) => m === modo)?.[2]}
      </p>

      {modo === "buscador" && <Buscador alTerminar={(p, f) => (setPerfil(p), setFaltan(f))} />}
      {modo === "chat" && (
        <Chat perfil={perfil} faltan={faltan} alTerminar={(p, f) => (setPerfil(p), setFaltan(f))} />
      )}
      {modo === "nube" && <Nube perfil={perfil} setPerfil={setPerfil} />}

      <section aria-label="Perfil resultante" className="grid gap-3 rounded-xl bg-muted px-5 py-5">
        <h3 className="text-sm font-medium text-(--text-secondary)">
          PerfilCiudadano (lo mismo venga de donde venga)
        </h3>
        <p className="text-base">{resumenPerfil(perfil) || "Todavía vacío."}</p>
        {faltan.length > 0 && modo !== "nube" && (
          <p className="text-sm">
            <span className="text-(--text-secondary)">Falta: </span>
            {faltan.map((f) => f.id).join(", ")}
          </p>
        )}
        <pre className="max-h-[320px] overflow-auto rounded-lg bg-background px-4 py-3 font-mono text-xs">
          {JSON.stringify(perfil, null, 2)}
        </pre>
        <div>
          <Button
            type="button"
            variant="sunset"
            size="lg"
            onClick={buscar}
            disabled={busqueda.tipo === "cargando"}
          >
            {busqueda.tipo === "cargando" ? "Buscando…" : "Buscar ayudas con este perfil"}
          </Button>
          <p className="mt-2 font-mono text-xs text-(--text-secondary)">
            POST /api/buscar {"{ perfil }"}
          </p>
        </div>
      </section>

      <div aria-live="polite">
        {busqueda.tipo === "cargando" && (
          <p className="text-sm text-(--text-secondary)">Consultando la BDNS. En frío, hasta 20 s.</p>
        )}
        {busqueda.tipo === "error" && <p className="text-destructive">{busqueda.msg}</p>}
        {busqueda.tipo === "hecho" && (
          <div className="grid gap-3">
            <Badge variant="outline">{(busqueda.ms / 1000).toFixed(1)} s</Badge>
            {VistaBuscar(busqueda.r)}
          </div>
        )}
      </div>
    </div>
  );
}

function Buscador({ alTerminar }: { alTerminar: (p: PerfilCiudadano, f: Falta[]) => void }) {
  const [texto, setTexto] = useState(
    "Tengo 24 años, estoy en paro y vivo de alquiler en València, sin hijos.",
  );
  const [estado, setEstado] = useState<string | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEstado("Interpretando…");
    try {
      const r = await postJson("/api/motor/perfil", { mensaje: texto });
      alTerminar(r.perfil, r.faltan);
      setEstado(r.conIa ? "Perfil sacado con IA." : "Sin IA: perfil sacado con reglas sencillas.");
    } catch (err) {
      setEstado((err as Error).message);
    }
  }
  return (
    <form onSubmit={enviar} className="grid gap-3">
      <label htmlFor="lab-buscador" className="text-sm font-medium">
        Cuéntanos tu situación
      </label>
      <Textarea id="lab-buscador" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline">Interpretar</Button>
        {estado && <span className="text-sm text-(--text-secondary)" aria-live="polite">{estado}</span>}
      </div>
    </form>
  );
}

function Chat({
  perfil,
  faltan,
  alTerminar,
}: {
  perfil: PerfilCiudadano;
  faltan: Falta[];
  alTerminar: (p: PerfilCiudadano, f: Falta[]) => void;
}) {
  const [mensajes, setMensajes] = useState<{ de: "persona" | "motor"; texto: string }[]>([
    { de: "motor", texto: "Hola. Cuéntame un poco tu situación y te digo a qué ayudas podrías optar." },
  ]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    const mensaje = texto;
    setTexto("");
    setMensajes((m) => [...m, { de: "persona", texto: mensaje }]);
    setCargando(true);
    try {
      // En cada mensaje se manda el perfil que ya teníamos.
      const r = await postJson("/api/motor/perfil", { mensaje, perfil });
      alTerminar(r.perfil, r.faltan);
      const siguiente: Falta | undefined = r.faltan[0];
      setMensajes((m) => [
        ...m,
        {
          de: "motor",
          texto: siguiente
            ? `Apuntado. ${siguiente.pregunta}`
            : "Ya tengo lo que necesito. Pulsa «Buscar ayudas con este perfil».",
        },
      ]);
    } catch (err) {
      setMensajes((m) => [...m, { de: "motor", texto: `Error: ${(err as Error).message}` }]);
    } finally {
      setCargando(false);
    }
  }
  return (
    <div className="grid gap-3">
      <ol className="grid max-h-[360px] gap-2 overflow-auto rounded-xl px-1 py-1 ring-1 ring-foreground/10" aria-live="polite">
        {mensajes.map((m, i) => (
          <li
            key={i}
            className={
              m.de === "persona"
                ? "ml-8 justify-self-end rounded-lg bg-muted px-3 py-2 text-base"
                : "mr-8 justify-self-start px-3 py-2 text-base"
            }
          >
            <span className="sr-only">{m.de === "persona" ? "Tú: " : "Motor: "}</span>
            {m.texto}
          </li>
        ))}
        {cargando && <li className="px-3 py-2 text-sm text-(--text-secondary)">Escribiendo…</li>}
      </ol>
      <form onSubmit={enviar} className="flex gap-2">
        <label htmlFor="lab-chat" className="sr-only">Mensaje</label>
        <Input id="lab-chat" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={faltan[0]?.pregunta ?? "Escribe…"} />
        <Button type="submit" variant="outline" disabled={cargando}>Enviar</Button>
      </form>
    </div>
  );
}

function Nube({
  perfil,
  setPerfil,
}: {
  perfil: PerfilCiudadano;
  setPerfil: (p: PerfilCiudadano) => void;
}) {
  const [preguntas, setPreguntas] = useState<Pregunta[] | null>(null);
  const [sugerencias, setSugerencias] = useState<{ municipio: string; provincia: string }[]>([]);
  const [lugar, setLugar] = useState(perfil.ubicacion.municipio ?? "");

  useEffect(() => {
    fetch(ruta("/api/motor/perfil/opciones"))
      .then((r) => r.json())
      .then((j) => setPreguntas(j.preguntas))
      .catch(() => setPreguntas([]));
  }, []);

  // Autocompletado con pausa, para no llamar por cada tecla.
  useEffect(() => {
    if (lugar.trim().length < 2 || lugar === perfil.ubicacion.municipio) return setSugerencias([]);
    const t = setTimeout(() => {
      fetch(ruta(`/api/motor/perfil/municipios?q=${encodeURIComponent(lugar)}`))
        .then((r) => r.json())
        .then((j) => setSugerencias(j.municipios ?? []))
        .catch(() => setSugerencias([]));
    }, 300);
    return () => clearTimeout(t);
  }, [lugar, perfil.ubicacion.municipio]);

  if (!preguntas) return <p className="text-sm text-(--text-secondary)">Cargando preguntas…</p>;

  const chip = (activo: boolean) => (activo ? "secondary" : "outline") as "secondary" | "outline";

  return (
    <div className="grid gap-6">
      {preguntas.map((q) => (
        <fieldset key={q.id} className="grid gap-2">
          <legend className="mb-2 text-base font-medium">
            {q.pregunta} <span className="font-mono text-xs text-(--text-secondary)">{q.id}</span>
          </legend>
          {q.tipo === "ubicacion" && (
            <div className="grid gap-2">
              <label htmlFor="lab-lugar" className="sr-only">Municipio</label>
              <Input
                id="lab-lugar"
                value={lugar}
                placeholder="Empieza a escribir tu municipio"
                onChange={(e) => {
                  setLugar(e.target.value);
                  setPerfil({ ...perfil, ubicacion: { municipio: e.target.value || null, provincia: null, ccaa: null } });
                }}
              />
              {sugerencias.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sugerencias.map((s) => (
                    <Button
                      key={`${s.municipio}-${s.provincia}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLugar(s.municipio);
                        setSugerencias([]);
                        setPerfil({ ...perfil, ubicacion: { municipio: s.municipio, provincia: s.provincia, ccaa: null } });
                      }}
                    >
                      {s.municipio} <span className="text-(--text-secondary)">· {s.provincia}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {q.tipo === "numero" && (
            <Input
              type="number"
              inputMode="numeric"
              min={q.min}
              max={q.max}
              aria-label={q.pregunta}
              className="max-w-32"
              value={perfil[q.id] ?? ""}
              onChange={(e) =>
                setPerfil({ ...perfil, [q.id]: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          )}
          {q.tipo === "opcion" && (
            <div className="flex flex-wrap gap-2">
              {q.opciones.map((o) => {
                const activo = perfil[q.id] === o.valor;
                return (
                  <Button
                    key={o.valor}
                    type="button"
                    variant={chip(activo)}
                    aria-pressed={activo}
                    onClick={() => setPerfil({ ...perfil, [q.id]: activo ? null : o.valor })}
                  >
                    {o.etiqueta}
                  </Button>
                );
              })}
            </div>
          )}
          {q.tipo === "multiple" && (
            <div className="flex flex-wrap gap-2">
              {q.opciones.map((o) => {
                const activo = perfil.temas.includes(o.valor);
                return (
                  <Button
                    key={o.valor}
                    type="button"
                    variant={chip(activo)}
                    aria-pressed={activo}
                    onClick={() =>
                      setPerfil({
                        ...perfil,
                        temas: activo ? perfil.temas.filter((t) => t !== o.valor) : [...perfil.temas, o.valor],
                      })
                    }
                  >
                    {o.etiqueta}
                  </Button>
                );
              })}
            </div>
          )}
        </fieldset>
      ))}
    </div>
  );
}
