# H-D01-A — ImageGen nativo · Hoy desktop · «Cuaderno editorial»

> **PROMPT AUTÓNOMO.** Copiar exclusivamente el texto que sigue al separador a ImageGen nativo, en **una sola generación**. No es una imagen ya creada.

---

Generá **una sola imagen original de propuesta de UI web** de **Campus**, pantalla **Hoy** en desktop, en un lienzo de composición frontal **1440 × 900 px** (relación 16:10). Es una **propuesta visual futura basada en funcionalidades existentes**, no una captura de un navegador ni un test real. Dibujá únicamente la interfaz plana de extremo a extremo, sin monitor, marco, ventana de navegador, perspectiva, mockup físico ni collage; sin textos de explicación ni etiquetas de variantes sobre la propia pantalla. Renderización limpia, tipografía nítida y legible.

**Dirección A: «Cuaderno editorial».** Una hoja académica de gran calidad editorial, atmósfera de concentración, márgenes pausados y listas reales. La interfaz debe sentirse como abrir un cuaderno de facultad extremadamente bien organizado, no un panel SaaS. Jerarquía potente mediante **una única cabecera serif** y cuerpo de lista sobrio. Abundante aire entre secciones, pero poca separación entre filas. No hero decorativo ni tarjetas de métricas. La inspiración de Things/Craft se limita a claridad, lectura y jerarquía, sin reproducir identidad visual de ninguna marca.

**Anatomía exacta del canvas:**

- Fondo `paper` lino claro cercano a `#efe6dd`; tinta principal casi negra cálida `#231f20`; tinta secundaria gris cálido oscuro; divisores `rule` beige-gris; acento turquesa atenuado cercano a `#7ebdc2`, con seleccionado de fondo muy pálido. Sin blancos ópticos chillones, neones ni gradientes.
- Columna izquierda de navegación **220 px** ocupando altura completa, borde derecho finísimo, sin tarjetas ni sombra. Marca **Campus** arriba en Newsreader con una línea vertical turquesa pequeña. Destinos con iconos de línea tipo Lucide y nombres exactos **Hoy**, **Plan**, **Materias**, **Calendario**, **Notas**, **Material**, **Ajustes**. El destino **Hoy** tiene resaltado turquesa suave y texto oscuro. Hacia el pie de sidebar colocar **Buscar** con indicador `/` y botón primario contenido **Agregar** con icono `+`. Nada más en navegación.
- Área principal a la derecha de nav: columna de lectura centrada visualmente, máximo aproximado **832 px** y margen generoso. Sin rail derecho, sin panel lateral de productividad, sin tarjetas flotantes.
- Cabecera dentro de esa hoja: epígrafe uppercase pequeño **«SÁBADO 24 DE OCTUBRE»**, debajo gran título Newsreader **«Tenés 3 cosas para hoy.»** en 30–36 px, tinta sólida. No agregar una frase automática inexistente. Debajo, suficiente aire antes de la primera sección.
- Las secciones se dividen mediante etiqueta uppercase minúscula, tracking leve y una regla fina que sigue hasta el borde derecho, coherente con `SectionHeading`. Orden inalterable: **ATRASADAS** (1), **HOY** (2), **PRÓXIMAS** (2), luego **SIN FECHA** (1) si entra verticalmente. Priorizar que toda obligación de Atrasadas/Hoy/Próximas sea visible sin scroll al llegar a 900px. Los grupos «Cursando» y «Final pendiente» pueden continuar por debajo del viewport, no simular un rail a la derecha.
- Cada fila es horizontal, separada solo por línea finísima, área visual de aproximadamente 54–60px: un **círculo de completado vacío de 20px** a la izquierda, pequeña columna alineada con hora, después título principal y abajo metadata de tipo/materia en Inter de 12–13px. El círculo no está seleccionado. No usar checkbox cuadrado industrial ni pills grandes.

**Contenido EXACTO del dataset demo UTN (los nombres de materias provienen del seed de Campus y los títulos de un fixture de QA existente; no son datos personales):**

Sección **Atrasadas (1)**: una sola fila «**TP 2 · atrasado**», hora **18:00**, línea secundaria «Entrega · Arquitectura de Computadoras · Atrasada»; la fecha es **21 de octubre**, tres días antes; «Atrasada» en texto y tono rojo sobrio, no rojo fluorescente.

Sección **Hoy (2)**: primera fila «**Teoría**», hora **09:00**, metadata «Clase · Arquitectura de Computadoras»; segunda fila «**TP 4 · entrega**», hora **18:00**, metadata «Entrega · Sistemas y Procesos de Negocio».

Sección **Próximas (2)**: primera fila «**Primer parcial**», hora **08:00**, metadata «Mañana · Parcial · Análisis Matemático II»; segunda fila «**Informe de laboratorio**», hora **20:00**, metadata «En 4 días (28 de octubre) · Entrega · Sistemas y Procesos de Negocio». Al pie de esta sección, enlace textual turquesa oscuro **«Ver el calendario»**, no botón grande.

Sección **Sin fecha (1)**, si entra: fila «**Pedir apuntes a Belén**», sin hora inventada, metadata «Tarea · Sin fecha». No introducir un registro de final a 21 días porque Hoy solo resume Próximas hasta 14 días.

**Tipografía:** títulos editoriales Newsreader, cuerpo e interacción Inter; títulos de fila en 14–15px; metadata en gris con contraste legible; regla y aire regular. La navegación no debe competir con título. Usar como mucho un solo acento permanente y tonos semánticos para atrasadas. Ninguna tarjeta grande.

**Restricciones estrictas de función y factibilidad:** esta pantalla se implementa hoy con `AcademicShell`, `PageHeader`, `SectionHeading`, `DeadlineRow` y `ProgressLine` usando React/Tailwind. Mantener todas las acciones que existen: abrir una materia haciendo clic en su nombre, completar una obligación con círculo, abrir calendario por el enlace, abrir búsqueda desde sidebar y captura mediante Agregar. No agregar reloj Pomodoro, calendario miniatura, gráficos inventados, IA, animaciones imposibles, prioridad asignada automáticamente ni estadísticas del usuario. No crear un rail secundario. Etiquetas de estado siempre con texto; no representar tareas pendientes como completadas. Si es necesario sacrificar contenido por espacio, recortar naturalmente al final del viewport como página desplazable, **nunca inventar columnas adicionales**.

**Objetivo de evaluación:** que el usuario juzgue si la lectura serena y los márgenes editoriales son adecuados para consultar obligaciones a diario. La única variación respecto de la pantalla original es presentación visual: funcionalidad y significado permanecen iguales.
