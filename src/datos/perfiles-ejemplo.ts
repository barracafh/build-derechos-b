import type { Perfil } from "@/lib/perfil";

// Los perfiles de prueba de SETUP.md, ya rellenos, para el formulario.
export const perfilesEjemplo: { nombre: string; perfil: Perfil }[] = [
  {
    nombre: "Joven en paro en València",
    perfil: {
      edad: 24,
      situacion: "paro",
      vivienda: "alquiler",
      hijos: 0,
      zona: "valencia",
    },
  },
  {
    nombre: "Madre autónoma en Castelló",
    perfil: {
      situacion: "autonomo",
      hijos: 2,
      ingresosBajos: true,
      zona: "cv",
      municipio: "Castelló de la Plana",
    },
  },
  {
    nombre: "Jubilado en la Safor",
    perfil: {
      edad: 70,
      situacion: "jubilado",
      pensionMinima: true,
      ingresosBajos: true,
      zona: "cv",
      municipio: "la Safor",
    },
  },
  {
    nombre: "Familia con 3 hijos en València",
    perfil: { hijos: 3, hijosEscolares: true, zona: "valencia" },
  },
];
