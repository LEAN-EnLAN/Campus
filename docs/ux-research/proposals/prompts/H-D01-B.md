# H-D01-B — ImageGen nativo · Hoy desktop · «Agenda de precisión»

> **PROMPT AUTÓNOMO.** Copiar exclusivamente el texto que sigue al separador a ImageGen nativo, en **una sola generación**. No es una imagen ya creada.

---

Generá **una única imagen original de alta fidelidad** de la app web universitaria argentina **Campus**, pantalla **Hoy** en desktop, tamaño objetivo **1440 × 900 px**, vista ortográfica frontal de interfaz web completa sin navegador, dispositivo, perspectiva o elementos fuera del lienzo. No se trata de una captura de UI existente ni de evidencia de un test. Debe ser una propuesta de rediseño **implementable con React/Tailwind v4**, con datos del mismo fixture universitario que usan las otras direcciones. No usar Canva, logos ajenos ni marca de autor.

**Dirección B: «Agenda de precisión».** Una alternativa considerablemente **más densa y operacional** que una hoja editorial: el usuario reconoce en menos de dos segundos qué ya venció, qué es a las 09:00 y qué es a las 18:00, sin leer grandes párrafos. Inspiración comportamental de Things para atención temporal y Supernotes para metadatos compactos; diseño visual original Campus. Usa una fuerte columna de hora, microetiquetas tipográficas y separadores regulares, como agenda de papel cuidadosamente compuesta. No convertirlo en un calendario de grilla ni en software de gestión empresarial. Mismo idioma, misma semántica, **sin agregar funciones**.

**Sistema visual fijo de Campus:** fondo de papel lino `#efe6dd`, superficies mínimas de papel elevado muy próximo, tinta `#231f20`, metadatos gris cálido con contraste suficiente, líneas finas neutras, acento teal tenue `#7ebdc2`; marca tipográfica Campus con línea vertical teal. Dos familias de letra: Newsreader para el título del día y algunas cifras de cabecera, Inter para controles, horas, títulos de tareas y metadatos. Sin glassmorphism, sin gradientes, sin fotografías, sin tarjetas blancas flotantes, sin sombras, sin iconos volumétricos, sin gráficos estadísticos, sin exceso de radio. Una paleta sobria, pocas jerarquías bien distintas.

**Composición:**

1. Sidebar de navegación **220 px** a la izquierda, siempre visible y a toda altura, separado por hairline. Arriba `Campus`; navegación exacta **Hoy** (seleccionado), **Plan**, **Materias**, **Calendario**, **Notas**, **Material**, **Ajustes**, con iconos Lucide lineales. Abajo **Buscar / ** y botón turquesa moderado **Agregar** con `+`. No inventar más destinos ni rail de iconos.
2. En el resto de la ventana, una columna de trabajo de lectura máxima **832 px**, alineada al centro; usar mejor el ancho de esa columna que en una composición editorial aireada. Arriba a la izquierda fecha pequeña uppercase **«SÁBADO 24 DE OCTUBRE»**; debajo título serif **«Tenés 3 cosas para hoy.»** alrededor de 30px. En un borde discreto debajo del título, un subtítulo visual que diga «Obligaciones y próximas fechas» **solo si queda claro que es texto decorativo propuesto**, no nueva función. No poner CTA adicional en cabecera: la captura ya está en la sidebar.
3. Línea divisora inmediatamente después de la cabecera. Lista compacta **de tres grupos**: **ATRASADAS** (1), **HOY** (2), **PRÓXIMAS** (2). Cada encabezado en mayúscula 11–12px, contador discreto en el extremo, borde inferior fino. Un ligero fondo más claro solo detrás de la sección Hoy para jerarquizar el presente; nada de cards por ítem ni grandes bloques coloreados.
4. Cada ítem es una fila de 47–52px con **cuatro zonas visualmente estables**: [check redondo 20px, touch target 44px] [hora 52–64px, cifras tabulares] [nombre en Inter 14–15px y segunda línea de metadata] [fecha relativa o estado al final, solo si no duplica la metadata]. Las horas 09:00, 18:00, 08:00 y 20:00 alineadas perfectamente. Línea gris suave al final de cada fila. Los hover/selected no se muestran porque el mockup es estado inicial, no animación.
5. Debajo de Próximas, el vínculo **«Ver el calendario»** como texto de acción. Luego **Sin fecha** con una sola tarea y, al aproximarse al borde inferior, al menos el rótulo **«Cursando»** con resumen de las tres materias puede estar parcialmente visible, indicando que la página continúa con scroll. Evitar tanto espacio vertical inútil como esconder contenido importante tras componentes inventados.

**Dataset exacto, consistente con fixture `utn-activo`, fecha de referencia sábado 24/10/2026:**

- **ATRASADAS (1):** «**TP 2 · atrasado**» — **18:00** — «Entrega · Arquitectura de Computadoras» — indicador textual pequeño **«Atrasada · 21 oct»** en rojo oscuro muy puntual.
- **HOY (2):** «**Teoría**» — **09:00** — «Clase · Arquitectura de Computadoras»; «**TP 4 · entrega**» — **18:00** — «Entrega · Sistemas y Procesos de Negocio».
- **PRÓXIMAS (2):** «**Primer parcial**» — **08:00** — «Parcial · Análisis Matemático II» — **Mañana**; «**Informe de laboratorio**» — **20:00** — «Entrega · Sistemas y Procesos de Negocio» — **En 4 días (28 de octubre)**.
- **SIN FECHA (1):** «**Pedir apuntes a Belén**» — hora «—» — «Tarea · Sin materia». No asignarle día ni hora.
- **CURSANDO:** Análisis Matemático II, Física II, Ingeniería y Sociedad. **FINAL PENDIENTE:** Arquitectura de Computadoras, Sistemas y Procesos de Negocio. Son bloques de la parte inferior de Hoy, no KPI cards; si no entran completos en la altura, se entiende que siguen por scroll.

**Semántica obligatoria:** el encabezado cuenta tres cosas porque hay una atrasada y dos que vencen hoy. Todos los checks están vacíos. El final del fixture a más de 14 días **no se muestra**; las correlativas no aparecen como un grafo calculado en Hoy. «Cursando» y «Final pendiente» no se mezclan. Ningún indicador decorativo de «urgencia IA» o scoring predictivo. Separar metas visuales por tiempo y por tipo de evaluación sin codificar todo exclusivamente con color.

**Implementabilidad:** sidebar = `AcademicShell` real; las listas pueden implementarse con `DeadlineRow` y CSS grid/flex, media queries de Tailwind v4, tokens de `globals.css`. La dirección B propone ajustar densidad, jerarquía temporal y alineación de metadatos, **no crear un backend nuevo**. No usar motion graphics ni visualizaciones imposibles. Textos españoles correctos y alineaciones geométricas limpias, legibles a tamaño natural en 1440×900.

**Qué debe diferenciarla claramente de A:** menor blanco entre grupos, ritmo de agenda casi tabular, horas y fechas como eje dominante, mucha información útil antes del fold; sigue siendo Campus y no una planilla ni una interfaz de tickets.
