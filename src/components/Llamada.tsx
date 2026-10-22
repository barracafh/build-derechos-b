"use client";
import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agenteVoz } from "@/config/voz";
import { ruta } from "@/config/sitio";
import type { RespuestaBuscar } from "@/lib/bdns/tipos";
import type { RespuestaConvocatorias } from "@/lib/bdns";
import { limpiarPerfil, type Perfil } from "@/lib/perfil";
import { aPerfilCiudadano } from "@/lib/perfil-motor";
import { tituloCorto } from "@/lib/titulo-corto";
import { textoPlazo } from "@/components/ResultadosMotor";

type Linea = { quien: "usuario" | "ayudita"; texto: string };

type Props = {
  bdns: RespuestaConvocatorias | "error" | null;
  onPerfil: (p: Perfil) => void;
  onCompleto: (completo: boolean) => void;
};

const prefiereMenosMovimiento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Lo que la herramienta devuelve al agente: lo mismo que ven el chat y el
// formulario (motor: POST /api/buscar), sin enlaces (esos van en la pantalla).
async function buscarParaVoz(perfil: Perfil) {
  const res = await fetch(ruta("/api/buscar"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ perfil: aPerfilCiudadano(perfil) }),
  });
  if (!res.ok)
    return JSON.stringify({
      error: "Para buscar necesito al menos saber dónde vive o su situación. Pregúntaselo.",
    });
  const r: RespuestaBuscar = await res.json();
  // Mismas claves que espera el prompt del agente (scripts/agente-voz.ts).
  const otra = r.preguntasUtiles?.[0]?.pregunta;
  return JSON.stringify({
    podrias: r.resultados.slice(0, 5).map((x) => ({
      nombre: tituloCorto(x.convocatoria.titulo),
      motivos: [x.motivo],
      plazo: textoPlazo(x.convocatoria),
      aComprobar: x.aComprobar,
    })),
    total: r.resultados.length,
    cerradas: [],
    huecos: [
      ...r.noConsultado,
      ...(r.sinCoincidencias ? [r.sinCoincidencias] : []),
      ...(otra ? [`Para afinar más podrías preguntarle: ${otra}`] : []),
    ],
  });
}

function LlamadaEnCurso({ bdns, onPerfil, onCompleto }: Props) {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [aviso, setAviso] = useState("");
  const [silenciado, setSilenciado] = useState(false);
  // Con los resultados en pantalla se cuelga: el agente no los lee en voz alta
  // y la transcripción se oculta.
  const [terminada, setTerminada] = useState(false);
  const colgar = useRef<() => void>(() => {});
  const bdnsActual = useRef(bdns);
  const anillo = useRef<HTMLDivElement>(null);
  const transcripcion = useRef<HTMLOListElement>(null);
  bdnsActual.current = bdns;

  const conversacion = useConversation({
    micMuted: silenciado,
    clientTools: {
      buscar_ayudas: async (parametros: Record<string, unknown>) => {
        const perfil = limpiarPerfil(parametros);
        onPerfil(perfil);
        onCompleto(true);
        const respuesta = await buscarParaVoz(perfil);
        setTerminada(true);
        colgar.current();
        return respuesta;
      },
    },
    onMessage: ({ message, role }) =>
      setLineas((l) => [
        ...l,
        { quien: role === "user" ? "usuario" : "ayudita", texto: message },
      ]),
    onError: () =>
      setAviso("Se ha cortado la llamada. Prueba de nuevo o usa el chat."),
    onDisconnect: (detalles) => {
      if (detalles.reason === "error") {
        console.warn("Llamada cortada:", detalles.message, detalles.closeReason);
        setAviso("Se ha cortado la llamada. Prueba de nuevo o usa el chat.");
      }
    },
  });

  useEffect(() => {
    colgar.current = () => conversacion.endSession();
  });
  const { status, isSpeaking } = conversacion;
  const conectada = status === "connected";

  // El anillo late con la voz de quien habla, sin volver a renderizar.
  useEffect(() => {
    if (!conectada || prefiereMenosMovimiento()) return;
    let cuadro = 0;
    const latir = () => {
      const volumen = isSpeaking
        ? conversacion.getOutputVolume()
        : conversacion.getInputVolume();
      anillo.current?.style.setProperty(
        "--latido",
        String(1 + Math.min(volumen, 1) * 0.35),
      );
      cuadro = requestAnimationFrame(latir);
    };
    cuadro = requestAnimationFrame(latir);
    return () => cancelAnimationFrame(cuadro);
  }, [conectada, isSpeaking, conversacion]);

  useEffect(() => {
    const t = transcripcion.current;
    if (t) t.scrollTop = t.scrollHeight;
  }, [lineas.length]);

  async function llamar() {
    setAviso("");
    setLineas([]);
    setTerminada(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setAviso(
        "Necesito permiso para usar el micrófono. Actívalo en el navegador o usa el chat.",
      );
      return;
    }
    // WebSocket: en las pruebas, WebRTC se cortaba al conectar y este no.
    conversacion.startSession({ agentId: agenteVoz, connectionType: "websocket" });
  }

  const estado =
    status === "connecting"
      ? "Conectando…"
      : conectada
        ? isSpeaking
          ? "Ayudita está hablando"
          : silenciado
            ? "Micrófono silenciado"
            : "Te escucho"
        : "Pulsa para llamar";

  return (
    <div className="grid gap-8 text-base">
      <div className="grid justify-items-center gap-5 pt-2 text-center">
        <div
          ref={anillo}
          aria-hidden="true"
          className="grid size-36 place-items-center rounded-full bg-muted transition-transform duration-75 [transform:scale(var(--latido,1))] motion-reduce:transition-none"
        >
          <div className="grid size-28 place-items-center rounded-full bg-background ring-1 ring-foreground/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
            <img
              src={ruta("/ayudita-isotipo.svg")}
              alt=""
              width={36}
              height={36}
              className="size-16"
            />
          </div>
        </div>
        <p role="status" className="text-lg font-medium">
          {estado}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {conectada || status === "connecting" ? (
            <>
              <Button
                variant="outline"
                size="lg"
                aria-pressed={silenciado}
                disabled={!conectada}
                onClick={() => setSilenciado((s) => !s)}
                className="h-12 gap-2 px-5 text-base"
              >
                {silenciado ? (
                  <MicOff aria-hidden="true" />
                ) : (
                  <Mic aria-hidden="true" />
                )}
                {silenciado ? "Activar micrófono" : "Silenciar"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => conversacion.endSession()}
                className="h-12 gap-2 px-5 text-base"
              >
                <PhoneOff aria-hidden="true" />
                Colgar
              </Button>
            </>
          ) : (
            <Button
              variant="sunset"
              size="lg"
              onClick={llamar}
              className="h-12 gap-2 px-6 text-base"
            >
              <Phone aria-hidden="true" />
              {lineas.length ? "Volver a llamar" : "Llamar a Ayudita"}
            </Button>
          )}
        </div>
        {terminada && !conectada && (
          <p role="status" className="max-w-md">
            Listo. Abajo tienes las ayudas a las que podrías optar.
          </p>
        )}
        {aviso && (
          <p role="alert" className="max-w-md">
            {aviso}
          </p>
        )}
      </div>

      {lineas.length > 0 && !terminada && (
        <section aria-label="Transcripción de la llamada">
          <h3 className="text-sm font-medium text-(--text-secondary)">
            Transcripción
          </h3>
          <ol
            ref={transcripcion}
            aria-live="polite"
            className="mt-3 grid max-h-64 gap-3 overflow-y-auto rounded-xl bg-muted px-4 py-4"
          >
            {lineas.map((l, i) => (
              <li key={i}>
                <span className="font-medium">
                  {l.quien === "usuario" ? "Tú" : "Ayudita"}:
                </span>{" "}
                {l.texto}
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-center text-(--text-secondary)">
        La llamada usa tu micrófono. No grabamos ni guardamos la conversación.
      </p>
    </div>
  );
}

export function Llamada(props: Props) {
  return (
    <ConversationProvider>
      <LlamadaEnCurso {...props} />
    </ConversationProvider>
  );
}
