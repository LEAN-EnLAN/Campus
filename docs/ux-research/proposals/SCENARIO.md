# Escenario único para comparar Hoy A/B/C y móvil

**No son datos personales ni observaciones de uso.** Es una traslación congelada para mockups del fixture `utn-activo` de `scripts/tester.mjs:45-104`, anclada al **sábado 24 de octubre de 2026**. El seed real de `supabase/seed.sql` contiene los nombres de materias de UTN FRRo Ingeniería en Sistemas de Información, Plan 2023. Este fixture se usa para poder comparar únicamente disposición y lenguaje visual, sin que cada imagen genere nuevos contenidos.

## Texto obligatorio común a las cuatro propuestas

- Identidad: **Campus**, español argentino. Pantalla/ruta: **Hoy** (`/today`).
- Fecha textual: **«Sábado 24 de octubre»**. Título exacto: **«Tenés 3 cosas para hoy.»** El número incluye una atrasada y dos del día (`todayHeadline` en `src/features/items/today-model.ts`).
- Sidebar desktop 220 px: Hoy, Plan, Materias, Calendario, Notas, Material, Ajustes; abajo Buscar (`/`) y botón **Agregar**. Hoy seleccionado.
- Móvil: logo Campus y buscar arriba; tabs fijas **Hoy · Plan · Materias · Calendario · Más** abajo; botón flotante `+` sobre tabs.

## Filas y correspondencia fuente

| Sección       | Título EXACTO del item     | Etiqueta de tipo | Materia vinculada              | Fecha / hora visible              |
| ------------- | -------------------------- | ---------------- | ------------------------------ | --------------------------------- |
| Atrasadas (1) | **TP 2 · atrasado**        | Entrega          | Arquitectura de Computadoras   | 21 oct · 18:00 · Atrasada         |
| Hoy (2)       | **Teoría**                 | Clase            | Arquitectura de Computadoras   | 09:00                             |
| Hoy (2)       | **TP 4 · entrega**         | Entrega          | Sistemas y Procesos de Negocio | 18:00                             |
| Próximas (2)  | **Primer parcial**         | Parcial          | Análisis Matemático II         | Mañana · 08:00                    |
| Próximas (2)  | **Informe de laboratorio** | Entrega          | Sistemas y Procesos de Negocio | En 4 días (28 de octubre) · 20:00 |
| Sin fecha (1) | **Pedir apuntes a Belén**  | Tarea            | Sin materia                    | Sin hora y sin fecha              |

Nota: Las horas son del **fixture**, que define `offsetDays` y `hour`. En fecha fija de octubre, el 21/10 corresponde a -3 días, el 25/10 a +1 y el 28/10 a +4. Las etiquetas temporales representan el diseño y pueden abreviarse por ancho; **no agregar otras obligaciones ni fechas**. `DeadlineRow` reserva una columna de 44 px para hora y 20 px para círculo de completado, con área de toque ampliada.

## Materias y otras secciones reales en Hoy

- **Cursando:** Análisis Matemático II; Física II; Ingeniería y Sociedad. Estas tres están marcadas `in_progress` por `scripts/tester.mjs` sobre las tres primeras materias del 2.º año del Plan 2023.
- **Final pendiente:** Arquitectura de Computadoras; Sistemas y Procesos de Negocio. Estas dos están `regularized` según el mismo fixture (cursada aprobada, falta rendir final).
- **Tu carrera:** línea de progreso discreta, conteo de materias aprobadas + equivalentes sobre total del plan (si el generador no puede reproducirlo, ubicar fuera del crop, **no improvisar un porcentaje**).
- **No mostrar:** «Final» de la fixture a +21 días (el modelo Hoy solo muestra próximas a +14 días); un calendario mensual interactivo, IA, notas automáticas, métricas de concentración, proyectos Trello, KPI de productividad, desbloqueos calculados o clases que no figuran en el fixture.

## Semántica visual que no puede cambiar entre variantes

Los ítems son pendientes (`status=open`). El círculo de cada fila es un botón para marcarlos hechos; no está marcado. «Atrasada» debe tener texto además de color. «Regularizada» no se convierte en «Cursando» ni «Aprobada». El tipo de evento y la materia deben estar disponibles como texto secundario. El título de la pantalla no debe mentir, pues hay 3 cosas para hoy por conteo de atrasadas + hoy. «Próximas» va cronológico y solo abarca los siguientes 14 días. «Sin fecha» no recibe hora ficticia. No hay rail derecho real en Hoy: si aparece uno en C, rotularlo como FUTURO en el catálogo, fuera de la imagen.
