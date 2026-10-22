import type { Campo, Perfil } from "@/lib/perfil";

import type { Resultado } from "@/lib/bdns/tipos";

// `resultados`: las ayudas que acompañan al mensaje (se pintan plegadas).
export type MensajeChat = { rol: "usuario" | "ayudita"; texto: string; resultados?: Resultado[] };

export type RespuestaChat = {
  texto: string;
  perfil: Perfil;
  rechazados: Campo[];
  completo: boolean;
};
