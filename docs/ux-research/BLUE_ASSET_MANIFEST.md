# Campus · Propuesta 2 azul — manifiesto de ilustraciones

**Estado:** 8 assets originales de producción, ilustraciones SVG vectoriales deterministas.
**Fecha:** 26 de octubre de 2026.
**Rama:** `feat/campus-proposal2-blue`.
**Alcance:** `public/campus-blue-assets/` y este manifiesto. Sin cambios a componentes ni rutas.

## Identidad gráfica

La familia usa una geometría editorial y académica: planos rectangulares, pequeñas curvas funcionales, un motivo orbital punteado de fondo, contornos navy y una sola familia cromática de azul. Son ilustraciones silenciosas; **el mensaje, las acciones y el estado pertenecen siempre al HTML/React**, no están escritos dentro del SVG.

| Token            | HEX                 | Uso                                                    |
| ---------------- | ------------------- | ------------------------------------------------------ |
| Navy / contorno  | `#1E3976`–`#24417D` | Contorno de pantalla, carpeta, calendario y documentos |
| Navy profundo    | `#101F4C`           | Figura de computadora, siluetas                        |
| Sapphire         | `#416BDE`–`#4D73DB` | Superficie activa y símbolo principal                  |
| Periwinkle       | `#849BF4`–`#9EB0F5` | Superficie secundaria y símbolos complementarios       |
| Ice / papel      | `#F0F5FF`–`#FAFBFF` | Fondo interno; el exterior es transparente             |
| Rule / ornamento | `#CBD9F6`–`#DEE7FC` | Líneas, aros, estructura tenue                         |

Los colores están incorporados en cada SVG para que pueda montarse mediante `<img src>` sin requerir CSS ni inyección de SVG en el DOM. Las formas no tienen degradados, filtros, sombras, CSS externo, fuentes, imágenes raster, animaciones ni elementos de marca de terceros.

## Inventario

Todas las ilustraciones tienen **dimensión intrínseca `640 × 400`**, `viewBox="0 0 640 400"`, fondo exterior transparente, `role="img"` y `<title>` accesible para inserción inline. Pesan menos de 3 KB individualmente.

| Ruta URL pública                                  | Superficie / estado                                           | `alt` recomendado (es-AR)                                             |
| ------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `/campus-blue-assets/workspace-local.svg`         | S00, selector de carpeta local                                | `Ilustración de una carpeta de materias guardada en esta computadora` |
| `/campus-blue-assets/workspace-cloud.svg`         | S00, selector Campus Cloud                                    | `Ilustración de un espacio académico almacenado en Cloud`             |
| `/campus-blue-assets/vault-cloud-unavailable.svg` | S14, Vault inaccesible desde Cloud                            | `Carpeta de apuntes local separada del espacio Cloud`                 |
| `/campus-blue-assets/calendar-empty.svg`          | S09–S11, calendario sin eventos cargados                      | `Calendario académico todavía sin fechas registradas`                 |
| `/campus-blue-assets/material-empty.svg`          | S12, lista de material sin recursos                           | `Libro de estudio con un símbolo de enlace para material académico`   |
| `/campus-blue-assets/notes-empty.svg`             | S13, carpeta local sin archivos de notas                      | `Cuaderno de apuntes preparado para empezar una nota`                 |
| `/campus-blue-assets/onboarding-ready.svg`        | S02–S03, confirmación visual posterior a completar onboarding | `Documento académico con una marca de confirmación`                   |
| `/campus-blue-assets/gentle-error.svg`            | Estados de error recuperable / fallo al cargar                | `Panel de Campus con un símbolo de atención`                          |

**Nota semántica:** si el título adyacente a la imagen explica por completo el estado, se recomienda `alt=""` para evitar que el lector de pantalla anuncie información redundante. No usar `onboarding-ready.svg` antes de confirmar que la operación terminó correctamente, ni sugerir sincronización Cloud↔notas locales con `vault-cloud-unavailable.svg`.

## Integración React

No requiere import de Vite, sprites ni dependencias. Ejemplo con tamaño contenido y ratio nativo:

```tsx
<img
  src="/campus-blue-assets/workspace-local.svg"
  alt="Ilustración de una carpeta de materias guardada en esta computadora"
  width={640}
  height={400}
  loading="lazy"
  decoding="async"
  className="h-auto w-full max-w-72"
/>
```

En tarjetas de selección Local/Cloud usar un tamaño visual comparable para ambos assets (`max-width: 240–280px`). Para los estados vacíos colocar imagen sobre título/acción, ancho recomendable de `176–240px` en 390 px y `220–300px` en 1440 px. Los SVG poseen un margen óptico interno, por lo que no necesitan padding adicional.

Los assets son presentacionales: no incluyen texto de interfaz ni botones. La accesibilidad del componente que los incorpora debe asegurar etiqueta de control, foco, feedback y contraste del texto por separado.

## Procedencia y derechos

- **Origen:** formas vectoriales originales dibujadas por código para la propuesta azul de Campus, en este worktree.
- **Generación nativa ImageGen:** **ninguna**; no se dispone de ese renderizador en esta sesión. Estos archivos **no** son originales nativos ImageGen, screenshots ni generados en Canva.
- **Material de terceros:** ninguno. No incorporan archivos externos, bibliotecas de iconos con licencia separada, tipografías ni logotipos ajenos.
- **Licenciamiento:** recursos encargados para uso, adaptación e incorporación en Campus; el repositorio no contiene en este trabajo una licencia explícita nueva para redistribución independiente. Su eventual publicación sigue la licencia/términos generales que determine el titular del proyecto. No se declara una licencia CC0 o MIT que no haya sido autorizada.
- **Seguridad SVG:** no usan `script`, `foreignObject`, `image`, URLs externas, CSS remoto ni eventos embebidos.

## QA y límites

La familia está diseñada para funcionar en distintos fondos gracias a sus interiores de papel/ice y contornos oscuros. Las validaciones exigidas son parse XML, dimensión `640×400`, ocho nombres únicos y ausencia de texto visible embebido. El tamaño total está dentro de un presupuesto pequeño de descarga.

Queda para el integrador verificar contraste del **texto y los controles React**, reflow en 390/768/1440, carga de todos los recursos en navegador de producto y que la ilustración no desplace la acción principal por debajo del primer viewport. Ninguna ilustración constituye una captura de una pantalla funcionando ni evidencia de cambio de estado del backend.
