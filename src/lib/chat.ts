import type { Campo, Perfil } from "@/lib/perfil";

export type MensajeChat = { rol: "usuario" | "ayudita"; texto: string };

export type RespuestaChat = {
  texto: string;
  perfil: Perfil;
  rechazados: Campo[];
  completo: boolean;
};
