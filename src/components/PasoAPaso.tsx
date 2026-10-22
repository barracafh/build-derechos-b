"use client";
import { useEffect, useRef, useState } from "react";
import {
  Armchair,
  ArrowLeft,
  Baby,
  Banknote,
  Briefcase,
  Ellipsis,
  EyeOff,
  GraduationCap,
  HandCoins,
  House,
  KeyRound,
  Map as Mapa,
  MapPin,
  MapPinned,
  PiggyBank,
  RotateCcw,
  School,
  SearchX,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { perfilesEjemplo } from "@/datos/perfiles-ejemplo";
import { resumenPerfil, type Perfil } from "@/lib/perfil";

type Opcion = { valor: string; texto: string; icono: LucideIcon };
type Paso = {
  id: string;
  pregunta: string;
  ayuda: string;
  // Sin opciones, el paso es un número (la edad).
  opciones?: Opcion[];
  valor: (p: Perfil) => string | undefined;
  aplicar: (p: Perfil, v: string | undefined) => Perfil;
  saltar: string;
};

function con<K extends keyof Perfil>(
  p: Perfil,
  k: K,
  v: Perfil[K] | undefined,
) {
  const nuevo = { ...p, [k]: v };
  if (v === undefined) delete nuevo[k];
  return nuevo;
}
const siNo = (v?: boolean) => (v === undefined ? undefined : v ? "si" : "no");
const aSiNo = (v?: string) => (v === undefined ? undefined : v === "si");

// Las preguntas que dependen de otra solo aparecen si esa respuesta lo pide.
function pasosPara(p: Perfil): Paso[] {
  const pasos: Paso[] = [
    {
      id: "zona",
      pregunta: "¿Dónde vives?",
      ayuda: "Muchas ayudas las convocan la Generalitat o tu ayuntamiento.",
      opciones: [
        { valor: "valencia", texto: "València ciudad", icono: MapPin },
        {
          valor: "cv",
          texto: "Otro municipio de la Comunitat Valenciana",
          icono: MapPinned,
        },
        {
          valor: "fuera",
          texto: "Fuera de la Comunitat Valenciana",
          icono: Mapa,
        },
      ],
      valor: (p) => p.zona,
      aplicar: (p, v) => {
        const nuevo = con(p, "zona", v as Perfil["zona"]);
        return v === "cv" ? nuevo : con(nuevo, "municipio", undefined);
      },
      saltar: "Prefiero no decirlo",
    },
    {
      id: "edad",
      pregunta: "¿Cuántos años tienes?",
      ayuda:
        "Algunas ayudas piden una edad mínima o máxima, como 23 o 35 años.",
      valor: (p) => (p.edad === undefined ? undefined : String(p.edad)),
      aplicar: (p, v) => con(p, "edad", v ? Number(v) : undefined),
      saltar: "Prefiero no decirlo",
    },
    {
      id: "situacion",
      pregunta: "¿Cuál es tu situación?",
      ayuda: "Si ahora mismo encajas en más de una, elige la principal.",
      opciones: [
        { valor: "paro", texto: "En paro", icono: SearchX },
        {
          valor: "trabaja",
          texto: "Trabajo por cuenta ajena",
          icono: Briefcase,
        },
        { valor: "autonomo", texto: "Autónomo o autónoma", icono: Store },
        { valor: "jubilado", texto: "Jubilado o pensionista", icono: Armchair },
        { valor: "estudia", texto: "Estudio", icono: GraduationCap },
        { valor: "otra", texto: "Otra situación", icono: Ellipsis },
      ],
      valor: (p) => p.situacion,
      aplicar: (p, v) => {
        const nuevo = con(p, "situacion", v as Perfil["situacion"]);
        return v === "jubilado"
          ? nuevo
          : con(nuevo, "pensionMinima", undefined);
      },
      saltar: "Prefiero no decirlo",
    },
  ];
  if (p.situacion === "jubilado")
    pasos.push({
      id: "pension",
      pregunta: "¿Cobras la pensión mínima?",
      ayuda:
        "Algunas ayudas, como el bono social eléctrico, la tienen en cuenta.",
      opciones: [
        { valor: "si", texto: "Sí", icono: HandCoins },
        { valor: "no", texto: "No", icono: Banknote },
      ],
      valor: (p) => siNo(p.pensionMinima),
      aplicar: (p, v) => con(p, "pensionMinima", aSiNo(v)),
      saltar: "No lo sé",
    });
  pasos.push(
    {
      id: "vivienda",
      pregunta: "¿Cómo es tu vivienda?",
      ayuda: "Hay ayudas para quien vive de alquiler.",
      opciones: [
        { valor: "alquiler", texto: "De alquiler", icono: KeyRound },
        { valor: "propiedad", texto: "En propiedad", icono: House },
        { valor: "otra", texto: "Otra situación", icono: Ellipsis },
      ],
      valor: (p) => p.vivienda,
      aplicar: (p, v) => con(p, "vivienda", v as Perfil["vivienda"]),
      saltar: "Prefiero no decirlo",
    },
    {
      id: "hijos",
      pregunta: "¿Tienes hijos o hijas menores a cargo?",
      ayuda:
        "Hay ayudas para la infancia, el comedor y los libros del colegio.",
      opciones: [
        { valor: "0", texto: "Ninguno", icono: UserRound },
        { valor: "1", texto: "1", icono: Baby },
        { valor: "2", texto: "2", icono: Baby },
        { valor: "3", texto: "3", icono: Baby },
        { valor: "4", texto: "4 o más", icono: Baby },
      ],
      valor: (p) => (p.hijos === undefined ? undefined : String(p.hijos)),
      aplicar: (p, v) => {
        const nuevo = con(p, "hijos", v === undefined ? undefined : Number(v));
        return Number(v) > 0 ? nuevo : con(nuevo, "hijosEscolares", undefined);
      },
      saltar: "Prefiero no decirlo",
    },
  );
  if (p.hijos)
    pasos.push({
      id: "colegio",
      pregunta: "¿Alguno va al colegio o al instituto?",
      ayuda: "De Primaria a Bachillerato, en un centro público o concertado.",
      opciones: [
        { valor: "si", texto: "Sí", icono: School },
        { valor: "no", texto: "No", icono: Baby },
      ],
      valor: (p) => siNo(p.hijosEscolares),
      aplicar: (p, v) => con(p, "hijosEscolares", aSiNo(v)),
      saltar: "Prefiero no decirlo",
    });
  pasos.push({
    id: "ingresos",
    pregunta: "¿Cómo son los ingresos de tu hogar?",
    ayuda:
      "Cada ayuda tiene su propio límite de ingresos: lo verás en sus requisitos.",
    opciones: [
      { valor: "si", texto: "Bajos o ninguno", icono: PiggyBank },
      { valor: "no", texto: "No especialmente bajos", icono: Banknote },
    ],
    valor: (p) => siNo(p.ingresosBajos),
    aplicar: (p, v) => con(p, "ingresosBajos", aSiNo(v)),
    saltar: "Prefiero no decirlo",
  });
  return pasos;
}

const opcionClase =
  "flex min-h-16 w-full items-center gap-4 rounded-xl bg-background px-5 py-3 text-left text-lg ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-muted aria-pressed:ring-2 aria-pressed:ring-foreground";

export function PasoAPaso({
  perfil,
  onChange,
  listo,
  onListo,
}: {
  perfil: Perfil;
  onChange: (p: Perfil) => void;
  listo: boolean;
  onListo: (listo: boolean) => void;
}) {
  const [indice, setIndice] = useState(0);
  const [edad, setEdad] = useState(perfil.edad?.toString() ?? "");
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeraVez = useRef(true);
  const pasos = pasosPara(perfil);
  const paso = pasos[Math.min(indice, pasos.length - 1)];
  const n = pasos.indexOf(paso) + 1;

  // Al cambiar de pregunta, el foco va al título para lectores de pantalla.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    titulo.current?.focus();
  }, [indice, listo]);

  function avanzar(nuevo: Perfil) {
    onChange(nuevo);
    const siguientes = pasosPara(nuevo);
    const actual = siguientes.findIndex((p) => p.id === paso.id);
    if (actual + 1 >= siguientes.length) onListo(true);
    else setIndice(actual + 1);
  }

  function responder(v: string | undefined) {
    const nuevo = paso.aplicar(perfil, v);
    // Con otro municipio de la Comunitat se pregunta cuál antes de seguir.
    if (paso.id === "zona" && v === "cv") onChange(nuevo);
    else avanzar(nuevo);
  }

  if (listo)
    return (
      <div className="grid gap-4 rounded-xl bg-muted px-6 py-5 text-base">
        <div>
          <h3
            ref={titulo}
            tabIndex={-1}
            className="text-sm font-medium text-(--text-secondary) outline-none"
          >
            Tus respuestas
          </h3>
          <p className="mt-1 text-lg">{resumenPerfil(perfil) || "Sin datos"}</p>
        </div>
        <div>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setIndice(0);
              onListo(false);
            }}
            className="h-11 gap-2 px-4 text-base"
          >
            <RotateCcw aria-hidden="true" />
            Cambiar respuestas
          </Button>
        </div>
      </div>
    );

  const elegido = paso.valor(perfil);

  return (
    <div className="grid gap-8 text-base">
      <div>
        <div className="flex min-h-11 items-center justify-between gap-4">
          <p className="text-(--text-secondary)">
            Pregunta {n} de {pasos.length}
          </p>
          {n > 1 && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setIndice(n - 2)}
              className="h-11 gap-2 px-3 text-base"
            >
              <ArrowLeft aria-hidden="true" />
              Atrás
            </Button>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="Progreso del formulario"
          aria-valuemin={1}
          aria-valuemax={pasos.length}
          aria-valuenow={n}
          className="mt-3 h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(n / pasos.length) * 100}%` }}
          />
        </div>
      </div>

      <div>
        <h3
          ref={titulo}
          tabIndex={-1}
          className="text-[clamp(26px,4vw,32px)] leading-tight font-medium tracking-[-0.02em] outline-none"
        >
          {paso.pregunta}
        </h3>
        <p className="mt-2 text-(--text-secondary)">{paso.ayuda}</p>
      </div>

      {paso.opciones ? (
        <div
          role="group"
          aria-label={paso.pregunta}
          className={cn(
            "grid gap-3",
            paso.opciones.length > 3 && "sm:grid-cols-2",
          )}
        >
          {paso.opciones.map(({ valor, texto, icono: Icono }) => (
            <button
              key={valor}
              type="button"
              aria-pressed={elegido === valor}
              onClick={() => responder(valor)}
              className={opcionClase}
            >
              <Icono
                aria-hidden="true"
                className="size-5 shrink-0 text-(--text-secondary)"
              />
              {texto}
            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(edad);
            if (edad && Number.isInteger(v) && v >= 0 && v <= 120)
              avanzar(paso.aplicar(perfil, edad));
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="grid gap-2">
            <span className="font-medium">Edad</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              autoFocus
              value={edad}
              onChange={(e) => setEdad(e.target.value)}
              className="h-14 w-32 px-4 text-2xl md:text-2xl"
            />
          </label>
          <Button
            type="submit"
            variant="sunset"
            size="lg"
            disabled={!edad}
            className="h-14 px-6 text-base"
          >
            Continuar
          </Button>
        </form>
      )}

      {paso.id === "zona" && perfil.zona === "cv" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            avanzar(perfil);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="grid min-w-0 flex-[1_1_220px] gap-2">
            <span className="font-medium">¿Qué municipio? (opcional)</span>
            <Input
              value={perfil.municipio ?? ""}
              maxLength={60}
              autoFocus
              onChange={(e) =>
                onChange(con(perfil, "municipio", e.target.value || undefined))
              }
              aria-describedby="ayuda-municipio"
              className="h-12 px-4 md:text-base"
            />
            <span id="ayuda-municipio" className="text-(--text-secondary)">
              Solo el municipio, sin dirección.
            </span>
          </label>
          <Button
            type="submit"
            variant="sunset"
            size="lg"
            className="mb-8 h-12 px-6 text-base"
          >
            Continuar
          </Button>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
        <button
          type="button"
          onClick={() => avanzar(paso.aplicar(perfil, undefined))}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-(--text-secondary) underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <EyeOff aria-hidden="true" className="size-4" />
          {paso.saltar}
        </button>
        {n === 1 && (
          <details className="text-(--text-secondary)">
            <summary className="min-h-11 cursor-pointer content-center rounded-lg outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
              Probar con un perfil de ejemplo
            </summary>
            <div className="mt-3 grid gap-2">
              {perfilesEjemplo.map((ej) => (
                <Button
                  key={ej.nombre}
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    onChange(ej.perfil);
                    onListo(true);
                  }}
                  className="h-11 justify-start px-4 text-base"
                >
                  {ej.nombre}
                </Button>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
