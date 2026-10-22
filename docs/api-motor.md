# API del motor (BDNS)

Para probarlo desde la web: `http://localhost:3000/derechos-b/motor`. Tiene el laboratorio del paso 1 (buscador, chat y nube de preguntas) y un formulario para cada endpoint.

Tipos en `src/lib/bdns/tipos.ts` y respuesta real de ejemplo en `src/datos/ejemplo-buscar.json`.

## La idea

```
 Buscador ─┐  POST /api/motor/perfil
 Chat ─────┤  (IA, llamada 1)
           ├──► PerfilCiudadano ──► POST /api/buscar { perfil } ──► resultados
 Nube ─────┘  GET /api/motor/perfil/opciones
              (sin IA: el front construye el perfil)
```

El front elige cómo preguntar. La búsqueda solo recibe un `PerfilCiudadano`.

## PerfilCiudadano

```ts
{
  ubicacion: { municipio, provincia, ccaa },   // texto o null; con el municipio basta
  tipoSolicitante: "persona" | "autonomo" | null,
  edad: number | null,
  situacion: "paro" | "empleo" | "autonomo" | "jubilado" | "estudiante" | null,
  hijos: number | null,
  vivienda: "alquiler" | "propiedad" | "otra" | null,
  ingresos: "bajos" | "medios" | "altos" | null,
  temas: ("vivienda" | "empleo" | "educacion" | "familia" | "energia" | "salud"
        | "servicios_sociales" | "emprendimiento" | "transporte" | "cultura")[]
}
```

- **`tipoSolicitante`** decide el tipo de beneficiario que se manda a la BDNS: `persona` → `tiposBeneficiario=1` (personas físicas), `autonomo` → `tiposBeneficiario=3` (autónomos y pymes). Si es `null`, se deduce de `situacion`.
- Todo es opcional, pero `/api/buscar` pide al menos la ubicación o algo de la situación.
- Los valores que no están en el catálogo se ignoran (se quedan en `null`).
- La traducción a la BDNS (temas → finalidades y palabras clave, temas implícitos, edad → «joven» o «mayores») está en `src/lib/opciones.ts`.

## Endpoints

### `GET /api/motor/perfil/opciones`
Para la nube: `{ preguntas: [{ id, pregunta, tipo, opciones? }], perfilVacio }`.
- `id` es el campo del perfil.
- `tipo` es `ubicacion`, `numero`, `opcion` o `multiple`.
- `opciones` son `{ valor, etiqueta }`.

### `GET /api/motor/perfil/municipios?q=gand`
Autocompletado de «¿Dónde vives?»: `{ municipios: [{ municipio, provincia }] }`, hasta 8, de toda España. Usa una pausa de unos 300 ms entre teclas.

### `POST /api/motor/perfil` · `{ mensaje, perfil? }`
Para el chat y el buscador. Devuelve `{ perfil, faltan: [{ id, pregunta }], conIa }`.
- En el chat, manda en cada mensaje el `perfil` de la respuesta anterior: se completa sin perder lo anterior.
- `faltan[0]` es la siguiente pregunta que puede hacer el chat.

### `POST /api/buscar` · `{ perfil }` (o el atajo `{ texto }`)
Tarda **entre 6 y 20 s** en frío, porque la BDNS admite 1 petición por segundo. Lánzalo solo al enviar. Devuelve `RespuestaBuscar`:

| Campo | Para qué |
|---|---|
| `perfil` | Perfil usado, para «Hemos entendido…» |
| `filtros` | Traducción a la BDNS (temas, finalidades, palabras, tipo de beneficiario). Para depurar |
| `consultado` / `noConsultado` | Qué administraciones se han mirado y cuáles no. Muéstralo siempre |
| `resultados[]` | `{ convocatoria, encaje: "alto" \| "medio", motivo, aComprobar[] }`, ya ordenados |
| `convocatoria.estado` | `abierta`, `proxima`, `permanente` o `consultar` (el plazo solo viene en texto: muestra `plazo.textoFin`). Las cerradas no llegan |
| `convocatoria.urlFicha` | El enlace oficial, para `<Fuentes />` |
| `cita` + `consultadoEn` | Obligatorios por el aviso legal de la BDNS |
| `origen` | `"copia"` si la BDNS no respondía. Muestra `avisos[0]` |
| `avisos[]`, `sinCoincidencias` | Notas, y el texto si no hay resultados |
| `peticionesBdns[]` | Cada URL pedida a la BDNS, si vino de la caché y cuántos resultados dio. Para depurar |

Texto: «podrías optar», nunca «tienes derecho».

### Extras sin IA
- `GET /api/motor/convocatorias?municipio=Gandia&claves=alquiler,joven&finalidad=8&beneficiarios=1&limite=5`: la lista filtrada.
- `GET /api/motor/convocatorias/937126`: una ficha.
- `GET /api/calentar`: precarga los 4 perfiles del SETUP antes de la demo (tarda 1–2 min).

## Cómo funciona por dentro

1. **Perfil**: `src/lib/opciones.ts` (catálogo y traducción) y `src/lib/interpretar.ts` (IA). Sin IA, se usan reglas y el municipio se busca en el catálogo de la BDNS.
2. **Territorio**: `src/lib/bdns/territorio.ts`. Municipio, provincia o comunidad → ids de `/regiones` y `/organos`, para toda España.
3. **Búsquedas**: `src/lib/bdns/buscar.ts`. Estado, comunidad, diputación y ayuntamiento, de los últimos 12 meses. Se ordenan por coincidencia del título y se abren fichas hasta tener 10 válidas (máximo 15). Se descartan las instrumentales, las cerradas y las de otro territorio.
4. **Explicación**: `src/lib/explicar.ts`, la IA (llamada 2). Decide el encaje y escribe el motivo; las de encaje `bajo` se quitan.
5. **Caché en memoria**: `src/lib/bdns/cliente.ts`. Fichas 1 h, búsquedas 10 min y catálogos 24 h. Solo datos públicos; el texto del ciudadano ni se guarda ni se registra.

`BDNS_FORZAR_COPIA=1` obliga a usar la copia `datos/bdns-convocatorias-cv.json`.

## Pendiente
- Paso 3: la BDNS solo nos da las 50 convocatorias más recientes por administración. Se puede filtrar en origen por palabras del título (`descripcion` + `descripcionTipoBusqueda=2`).
- La IA no se ha probado: falta `.env.local` con la clave de HelmCode.
