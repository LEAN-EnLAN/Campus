# H-D01-C — ImageGen nativo · Hoy desktop · «Mesa de estudio contextual»

> **PROMPT AUTÓNOMO.** Copiar exclusivamente el texto que sigue al separador a ImageGen nativo, en **una sola generación**. No es una imagen ya creada.

---

Generá **una sola propuesta de interfaz original** para la aplicación académica argentina **Campus**, pantalla «Hoy», en composición desktop frontal **1440 × 900 px**. Renderizar una imagen plana de producto digital de alta fidelidad, perfectamente enfocada, con textos en español argentino; no un screenshot, marco de dispositivo, browser chrome, collage, wireframe ni perspectiva. Propuesta **FUTURA**, no afirmación de comportamiento ya implementado. Evitar logos de otras marcas. El resultado debe poder reproducirse mediante **React 19 + Tailwind v4, CSS grid/flex, componentes y datos existentes**, sin tecnología adicional.

**Dirección C: «Mesa de estudio contextual».** Crear un lenguaje mucho más espacial que A y B: la organización se parece a una mesa de estudio donde a la izquierda está la **agenda de obligaciones** y a la derecha, como margen de cuaderno, aparece **el contexto académico que el estudiante ya tiene cargado**. La segunda columna **no representa una funcionalidad nueva**: reutiliza los bloques `Cursando`, `Final pendiente` y `Tu carrera` que la pantalla Hoy real ya muestra más abajo. Lo nuevo en esta variante es **solo su disposición visual en desktop**. Compararla con la hoja única A y la agenda compacta B. Sin venderla como actual: el layout de dos columnas requiere aprobación antes de tocar UI.

**Sistema visual Campus canónico:** fondo lino cálido `#efe6dd`, superficie casi blanca cálida solo donde mejora lectura, tinta `#231f20`, secundarios gris cálido, divisores suaves, acento turquesa contenido `#7ebdc2` y tonos semánticos discretos para estado. Títulos/editorial en Newsreader, controles y lista en Inter. Fuera de los pequeños resaltados de navegación y progreso, no pintar cajas de colores. Sin glassmorphism, gradientes, neón, sombras elevadas, tableros de cifras, composiciones 3D, fotos, ilustraciones de campus, tarjetas de productividad ni iconos gigantes. Líneas finas como una agenda impresa contemporánea.

**Maquetación exacta, distinta de las otras dos propuestas:**

- **Sidebar global 220 px** a la izquierda de todo el lienzo, con borde derecho fino. Marca Campus + trazo vertical teal arriba. Navegación exacta **Hoy**, **Plan**, **Materias**, **Calendario**, **Notas**, **Material**, **Ajustes**; Hoy seleccionado con fondo turquesa muy pálido. En pie, **Buscar** (tecla `/`) y botón **Agregar** con `+`. No convertir sidebar en rail 48px porque no corresponde a la navegación existente.
- Dentro del ancho restante (~1220px) crear un **documento de dos zonas** con margen exterior 48–64px: izquierda alrededor de **610–670px** para obligaciones, derecha **260–300px** para estado de carrera, separadas por una **regla vertical muy tenue**, no una caja flotante. El margen derecho deja aire, todo alineado a una misma línea base.
- **Izquierda:** fecha uppercase **«SÁBADO 24 DE OCTUBRE»**, título en Newsreader **«Tenés 3 cosas para hoy.»**, después secciones de tareas **Atrasadas**, **Hoy**, **Próximas** y **Sin fecha** con separadores de regla, títulos Inter pequeños. El título no necesita ocupar toda la fila del canvas; debe caber dentro de la zona izquierda sin quedar ridículamente apretado. El lector sigue pudiendo recorrer cronología de arriba abajo. Filas con círculo vacío 20px, hora tabular, nombre y metadata debajo; cada obligación es una fila distinta.
- **Derecha:** alineado algo más abajo del título, etiqueta uppercase **«CURSANDO»** sobre lista plana de tres materias con un pequeño glyph semántico: **Análisis Matemático II**, **Física II**, **Ingeniería y Sociedad**. Cada renglón enlazable, texto sin truncar si se puede, año o estado secundario solo si es exacto. Luego etiqueta **«FINAL PENDIENTE»** sobre **Arquitectura de Computadoras** y **Sistemas y Procesos de Negocio**, separadas por línea. Más abajo **«TU CARRERA»** y una barra de progreso fina, sin tarjeta, sin porcentaje inventado. Un pequeño enlace **«Ver tu plan»** completa el bloque. Es contenido que ya existe en Hoy; la propuesta solo evita esconderlo tras mucho scroll. **No introducir** «predicciones», «rendimiento», «promedio», «porcentaje de asistencia» ni un calendario semanal independiente.
- Si un bloque de la derecha supera altura, se permite que continúe debajo del pliegue. No ocultar la única acción de captura: está en sidebar y no se duplica en la nueva columna.

**Datos exactos, sin inventar eventos:**

`Atrasadas (1)`: **«TP 2 · atrasado»**, **18:00**, «Entrega · Arquitectura de Computadoras · Atrasada», vencida el **21 de octubre**; estado textual «Atrasada» discreto en tinta roja, además de hora.

`Hoy (2)`: **«Teoría»** a las **09:00**, «Clase · Arquitectura de Computadoras»; **«TP 4 · entrega»** a las **18:00**, «Entrega · Sistemas y Procesos de Negocio».

`Próximas (2)`: **«Primer parcial»** a las **08:00**, «Mañana · Parcial · Análisis Matemático II»; **«Informe de laboratorio»** a las **20:00**, «En 4 días (28 de octubre) · Entrega · Sistemas y Procesos de Negocio». Debajo, acción como link **«Ver el calendario»**.

`Sin fecha (1)`: **«Pedir apuntes a Belén»**, «Tarea · Sin materia», y no se le asigna hora inventada.

`Cursando (3)`: **Análisis Matemático II**, **Física II**, **Ingeniería y Sociedad**. `Final pendiente (2)`: **Arquitectura de Computadoras**, **Sistemas y Procesos de Negocio**. `Tu carrera`: barra de progreso discreta; sin inventar fracción o porcentaje si no hay espacio para verificar. El fixture tiene además un final fuera de ventana (+21 días): **no representarlo** porque Hoy muestra solo Próximas de hasta 14 días.

**Comportamiento real conservado:** círculo de cada tarea pendiente para marcarla hecha, links de materias navegables, link Ver calendario, búsqueda global, botón Agregar para quick capture. Los ítems de la derecha representan estatus académicos, no tareas: **no** dibujarles checkboxes de completado. Regularizada es «Final pendiente», no Cursando. Contraste suficiente sin depender de color.

**Factibilidad visual:** sidebar `AcademicShell` original, lista en `DeadlineRow`/`SectionHeading`, panel de materias mediante `SubjectGroup`, progreso `ProgressLine`, segunda columna opcional solo con grid responsive, no API nueva. Los contenedores admiten scroll de documento y se apilan a una columna en móvil; no representar dos columnas en un teléfono. El rail de contenido derecho es un **bloque real reubicado de manera FUTURA**: no mostrar una barra lateral del sistema inexistente.

**Qué la distingue de A/B:** formato de doble zona que da contexto académico persistente sin inventar nuevas métricas, menos scrolling a costa de ancho en agenda; estética de mesa de trabajo austera y original Campus.
