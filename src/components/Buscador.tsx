"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chat } from "@/components/Chat";
import { PasoAPaso } from "@/components/PasoAPaso";
import { Resultados } from "@/components/Resultados";
import { ruta } from "@/config/sitio";
import { buscarAyudas, type Busqueda } from "@/lib/ayudas";
import type { RespuestaConvocatorias } from "@/lib/bdns";
import {
  perfilVacio,
  resumenPerfil,
  situaciones,
  viviendas,
  zonas,
  type Perfil,
} from "@/lib/perfil";

type Modo = "chat" | "formulario" | "llamada";
const modos: Record<Modo, { nombre: string; texto: string }> = {
  chat: {
    nombre: "Chat",
    texto: "Cuéntanos tu situación con tus palabras, como en un mensaje.",
  },
  formulario: {
    nombre: "Formulario",
    texto: "Responde unas preguntas cortas, sin tener que escribir.",
  },
  llamada: {
    nombre: "Llamada",
    texto: "Háblanos y te decimos en voz alta a qué podrías optar.",
  },
};

const control =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

async function extraerPerfil(texto: string, perfil: Perfil): Promise<Perfil> {
  const res = await fetch(ruta("/api/perfil"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texto, perfil }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.perfil)
    throw new Error(data.error ?? "No hemos podido entender el texto.");
  return data.perfil;
}

function resumenHablado(b: Busqueda): string {
  if (!b.podrias.length)
    return "Con lo que me has contado no encuentro ayudas abiertas que encajen. En pantalla tienes lo que no he podido consultar y dónde preguntar.";
  const titulos = b.podrias.map((r) => r.ayuda.titulo.split(" (")[0]);
  return `Podrías optar a ${titulos.length} ${titulos.length === 1 ? "ayuda" : "ayudas"}: ${titulos.join(", ")}. Comprueba los requisitos: tienes los detalles y los enlaces oficiales en pantalla.`;
}

function hablar(texto: string, alTerminar?: () => void) {
  if (!("speechSynthesis" in window)) return alTerminar?.();
  const voz = new SpeechSynthesisUtterance(texto);
  voz.lang = "es-ES";
  voz.onend = () => alTerminar?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(voz);
}

function Formulario({
  perfil,
  onChange,
}: {
  perfil: Perfil;
  onChange: (p: Perfil) => void;
}) {
  const poner = <K extends keyof Perfil>(k: K, v: Perfil[K] | undefined) => {
    const nuevo = { ...perfil, [k]: v };
    if (v === undefined) delete nuevo[k];
    // Las preguntas que dependen de otra se borran si esa deja de aplicar.
    if (k === "hijos" && !v) delete nuevo.hijosEscolares;
    if (k === "situacion" && v !== "jubilado") delete nuevo.pensionMinima;
    onChange(nuevo);
  };
  const numero = (v: string) => (v === "" ? undefined : Number(v));
  const siNo = (v: string) => (v === "" ? undefined : v === "si");
  const valorSiNo = (v?: boolean) => (v === undefined ? "" : v ? "si" : "no");

  return (
    <div className="grid gap-8 text-base">
      <form
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-5 sm:grid-cols-2"
      >
        <label className="grid content-start gap-2">
          <span className="font-medium">Edad</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={perfil.edad ?? ""}
            onChange={(e) => poner("edad", numero(e.target.value))}
            className="h-11 px-3 md:text-base"
          />
        </label>
        <label className="grid content-start gap-2">
          <span className="font-medium">Situación laboral</span>
          <select
            className={control}
            value={perfil.situacion ?? ""}
            onChange={(e) =>
              poner(
                "situacion",
                (e.target.value || undefined) as Perfil["situacion"],
              )
            }
          >
            <option value="">Sin indicar</option>
            {Object.entries(situaciones).map(([k, v]) => (
              <option key={k} value={k}>
                {v[0].toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
        {perfil.situacion === "jubilado" && (
          <label className="grid content-start gap-2">
            <span className="font-medium">¿Cobras la pensión mínima?</span>
            <select
              className={control}
              value={valorSiNo(perfil.pensionMinima)}
              onChange={(e) => poner("pensionMinima", siNo(e.target.value))}
            >
              <option value="">Sin indicar</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </label>
        )}
        <label className="grid content-start gap-2">
          <span className="font-medium">Vivienda</span>
          <select
            className={control}
            value={perfil.vivienda ?? ""}
            onChange={(e) =>
              poner(
                "vivienda",
                (e.target.value || undefined) as Perfil["vivienda"],
              )
            }
          >
            <option value="">Sin indicar</option>
            <option value="alquiler">De alquiler</option>
            <option value="propiedad">
              {viviendas.propiedad[0].toUpperCase() +
                viviendas.propiedad.slice(1)}
            </option>
            <option value="otra">Otra</option>
          </select>
        </label>
        <label className="grid content-start gap-2">
          <span className="font-medium">Ingresos del hogar</span>
          <select
            className={control}
            value={valorSiNo(perfil.ingresosBajos)}
            onChange={(e) => poner("ingresosBajos", siNo(e.target.value))}
            aria-describedby="ayuda-ingresos"
          >
            <option value="">Prefiero no decirlo</option>
            <option value="si">Bajos o ninguno</option>
            <option value="no">No especialmente bajos</option>
          </select>
          <span id="ayuda-ingresos" className="text-(--text-secondary)">
            Cada ayuda tiene su propio límite de ingresos: lo verás en sus
            requisitos.
          </span>
        </label>
        <label className="grid content-start gap-2">
          <span className="font-medium">Hijos o hijas menores a cargo</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={perfil.hijos ?? ""}
            onChange={(e) => poner("hijos", numero(e.target.value))}
            className="h-11 px-3 md:text-base"
          />
        </label>
        {perfil.hijos !== undefined && perfil.hijos > 0 && (
          <label className="grid content-start gap-2">
            <span className="font-medium">
              ¿Alguno va al colegio o instituto?
            </span>
            <select
              className={control}
              value={valorSiNo(perfil.hijosEscolares)}
              onChange={(e) => poner("hijosEscolares", siNo(e.target.value))}
            >
              <option value="">Sin indicar</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </label>
        )}
        <label className="grid content-start gap-2">
          <span className="font-medium">Dónde vives</span>
          <select
            className={control}
            value={perfil.zona ?? ""}
            onChange={(e) =>
              poner("zona", (e.target.value || undefined) as Perfil["zona"])
            }
          >
            <option value="">Sin indicar</option>
            {Object.entries(zonas).map(([k, v]) => (
              <option key={k} value={k}>
                {v[0].toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
        {perfil.zona && perfil.zona !== "valencia" && (
          <label className="grid content-start gap-2">
            <span className="font-medium">Municipio</span>
            <Input
              value={perfil.municipio ?? ""}
              maxLength={60}
              onChange={(e) => poner("municipio", e.target.value || undefined)}
              aria-describedby="ayuda-municipio"
              className="h-11 px-3 md:text-base"
            />
            <span id="ayuda-municipio" className="text-(--text-secondary)">
              Solo el municipio, sin dirección.
            </span>
          </label>
        )}
      </form>
    </div>
  );
}

type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type ConstructorReconocimiento = new () => Reconocimiento;

function Llamada({
  perfil,
  hayResultado,
  onPerfil,
}: {
  perfil: Perfil;
  hayResultado: boolean;
  onPerfil: (p: Perfil) => void;
}) {
  const [soportado, setSoportado] = useState<boolean | null>(null);
  const [fase, setFase] = useState<
    "lista" | "saludo" | "escuchando" | "pensando"
  >("lista");
  const [transcripcion, setTranscripcion] = useState("");
  const [aviso, setAviso] = useState("");
  const reconocimiento = useRef<Reconocimiento | null>(null);
  const texto = useRef("");

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: ConstructorReconocimiento;
      webkitSpeechRecognition?: ConstructorReconocimiento;
    };
    setSoportado(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
    return () => {
      reconocimiento.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  async function procesar() {
    const t = texto.current.trim();
    if (!t) {
      setFase("lista");
      setAviso("No te he oído. Pulsa de nuevo y cuéntamelo.");
      return;
    }
    setFase("pensando");
    try {
      const nuevo = await extraerPerfil(t, perfil);
      onPerfil(nuevo);
      hablar(resumenHablado(buscarAyudas(nuevo)));
    } catch (err) {
      setAviso((err as Error).message);
    } finally {
      setFase("lista");
    }
  }

  function escuchar() {
    const w = window as unknown as {
      SpeechRecognition?: ConstructorReconocimiento;
      webkitSpeechRecognition?: ConstructorReconocimiento;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "es-ES";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      texto.current = Array.from(e.results, (res) => res[0].transcript).join(
        " ",
      );
      setTranscripcion(texto.current);
    };
    r.onerror = () =>
      setAviso(
        "No he podido usar el micrófono. Revisa los permisos del navegador.",
      );
    r.onend = procesar;
    reconocimiento.current = r;
    setFase("escuchando");
    r.start();
  }

  function empezar() {
    setAviso("");
    setTranscripcion("");
    texto.current = "";
    setFase("saludo");
    hablar(
      "Hola. Cuéntame tu situación: tu edad, si trabajas, dónde vives, si vives de alquiler y si tienes hijos. Cuando termines, pulsa Terminar.",
      escuchar,
    );
  }

  if (soportado === false)
    return (
      <p className="text-base">
        Tu navegador no permite hablar con la herramienta. Prueba en Chrome o
        usa el chat.
      </p>
    );

  return (
    <div className="grid gap-5 text-base">
      <p>
        Habla como en una llamada: te escuchamos, te decimos en voz alta a qué
        ayudas podrías optar y te dejamos el detalle en pantalla. No grabamos ni
        guardamos lo que dices.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {fase === "escuchando" ? (
          <Button
            variant="outline"
            size="lg"
            onClick={() => reconocimiento.current?.stop()}
            className="h-11 px-4 text-base"
          >
            Terminar
          </Button>
        ) : (
          <Button
            variant={hayResultado ? "outline" : "sunset"}
            size="lg"
            onClick={empezar}
            disabled={fase !== "lista" || soportado === null}
            className="h-11 px-4 text-base"
          >
            {hayResultado ? "Volver a hablar" : "Empezar la llamada"}
          </Button>
        )}
        <p role="status" className="text-(--text-secondary)">
          {fase === "saludo" && "Escucha las instrucciones…"}
          {fase === "escuchando" && "Te escucho…"}
          {fase === "pensando" && "Buscando ayudas…"}
        </p>
      </div>
      {transcripcion && (
        <Card className="gap-2 bg-muted px-6 py-5 text-base ring-0">
          <p className="text-sm font-medium text-(--text-secondary)">
            Has dicho
          </p>
          <p>{transcripcion}</p>
        </Card>
      )}
      {aviso && <p role="alert">{aviso}</p>}
    </div>
  );
}

// Pregunta antes de cerrar: al cerrar se borra lo que la persona ha contado.
function Confirmar({
  abierta,
  onSeguir,
  onCerrar,
}: {
  abierta: boolean;
  onSeguir: () => void;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirmar-titulo"
      onClose={onSeguir}
      onClick={(e) => e.target === ref.current && onSeguir()}
      className="m-auto w-[min(420px,calc(100%-32px))] rounded-2xl bg-background p-0 text-foreground shadow-(--shadow-overlay) backdrop:bg-foreground/40"
    >
      <div className="grid gap-4 p-6 text-base">
        <h2
          id="confirmar-titulo"
          className="text-2xl leading-tight tracking-[-0.01em]"
        >
          ¿Seguro que quieres cerrar?
        </h2>
        <p className="text-(--text-secondary)">
          Se borrará lo que nos has contado y las ayudas encontradas.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="lg"
            autoFocus
            onClick={onSeguir}
            className="h-11 px-4 text-base"
          >
            Seguir aquí
          </Button>
          <Button
            variant="sunset"
            size="lg"
            onClick={onCerrar}
            className="h-11 px-4 text-base"
          >
            Sí, cerrar
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export function Buscador() {
  const [modo, setModo] = useState<Modo | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  // En el formulario, los resultados salen al terminar las preguntas.
  const [formularioListo, setFormularioListo] = useState(false);
  const [chatListo, setChatListo] = useState(false);
  const [perfil, setPerfil] = useState<Perfil>({});
  const [bdns, setBdns] = useState<RespuestaConvocatorias | "error" | null>(
    null,
  );
  const ventana = useRef<HTMLDialogElement>(null);
  const busqueda = useMemo(() => buscarAyudas(perfil), [perfil]);
  const hayResultado = !perfilVacio(perfil);

  // Son datos públicos, no del usuario: se cargan una vez y se filtran aquí.
  useEffect(() => {
    fetch(ruta("/api/convocatorias"))
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setBdns)
      .catch(() => setBdns("error"));
  }, []);

  useEffect(() => {
    const d = ventana.current;
    if (!d) return;
    if (modo && !d.open) d.showModal();
    if (!modo && d.open) d.close();
  }, [modo]);

  function cerrar() {
    setConfirmando(false);
    setModo(null);
    setPerfil({});
    setFormularioListo(false);
    setChatListo(false);
  }

  return (
    <>
      <nav
        aria-label="Elige cómo contarnos tu situación"
        className="grid gap-3 md:grid-cols-3"
      >
        {(Object.keys(modos) as Modo[]).map((m) => (
          <Card
            key={m}
            render={<button type="button" onClick={() => setModo(m)} />}
            className="cursor-pointer gap-1 px-5 py-4 text-left text-base ring-0 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:gap-2 md:px-6 md:py-6"
          >
            <span className="text-xl font-medium">{modos[m].nombre}</span>
            <span className="text-(--text-secondary) max-md:sr-only">
              {modos[m].texto}
            </span>
            <span className="font-medium max-md:sr-only md:mt-2">
              Empezar <span aria-hidden="true">→</span>
            </span>
          </Card>
        ))}
      </nav>

      {/* Esc o un clic fuera piden confirmación en vez de cerrar sin más. */}
      <dialog
        ref={ventana}
        aria-labelledby="ventana-titulo"
        onCancel={(e) => {
          e.preventDefault();
          setConfirmando(true);
        }}
        onClick={(e) => e.target === ventana.current && setConfirmando(true)}
        className="mx-auto mt-[4dvh] mb-auto w-[min(860px,calc(100%-24px))] rounded-2xl bg-background p-0 text-foreground shadow-(--shadow-overlay) backdrop:bg-foreground/40"
      >
        {modo && (
          <div className="max-h-[92dvh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background px-(--page-gutter) py-3 md:px-8">
              <h2
                id="ventana-titulo"
                className="text-2xl leading-tight tracking-[-0.01em]"
              >
                {modos[modo].nombre}
              </h2>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setConfirmando(true)}
                className="h-11 px-4 text-base"
              >
                Cerrar
              </Button>
            </div>

            <div className="px-(--page-gutter) py-8 md:px-8 [&>*+*]:mt-12">
              <section aria-label={modos[modo].nombre} className="[&>*+*]:mt-8">
                {modo === "chat" && (
                  <Chat
                    perfil={perfil}
                    onPerfil={setPerfil}
                    completo={chatListo}
                    onCompleto={setChatListo}
                  />
                )}
                {modo === "formulario" && (
                  <PasoAPaso
                    perfil={perfil}
                    onChange={setPerfil}
                    listo={formularioListo}
                    onListo={setFormularioListo}
                  />
                )}
                {modo === "llamada" && (
                  <Llamada
                    perfil={perfil}
                    hayResultado={hayResultado}
                    onPerfil={setPerfil}
                  />
                )}

                {hayResultado && (modo === "llamada" || chatListo) && (
                  <details className="rounded-xl px-5 py-4 text-base ring-1 ring-foreground/10">
                    <summary className="cursor-pointer rounded-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      Corregir lo que he entendido
                    </summary>
                    <div className="mt-5">
                      <Formulario perfil={perfil} onChange={setPerfil} />
                    </div>
                  </details>
                )}
              </section>

              {hayResultado &&
                (modo === "llamada" ||
                  (modo === "chat" && chatListo) ||
                  (modo === "formulario" && formularioListo)) && (
                  <Resultados perfil={perfil} busqueda={busqueda} bdns={bdns} />
                )}
            </div>
          </div>
        )}
      </dialog>

      <Confirmar
        abierta={confirmando}
        onSeguir={() => setConfirmando(false)}
        onCerrar={cerrar}
      />
    </>
  );
}
