# H-M01-A — ImageGen nativo · Hoy móvil · «Cuaderno editorial»

> **PROMPT AUTÓNOMO.** Copiar exclusivamente el texto que sigue al separador a ImageGen nativo, en **una sola generación**. No es una imagen ya creada.

---

Generá **una única imagen original de propuesta UI** de Campus para **móvil 390 × 844 px** en formato vertical, plana y ortográfica, sin marco de teléfono, navegador, perspectiva ni fotografía. Es la **adaptación móvil de la dirección desktop A «Cuaderno editorial»**: exactamente el mismo lenguaje visual, eventos, fecha, contenidos y marca. Se construirá con React/Tailwind después de revisar con el usuario; no fingir una captura actual ni añadir funciones de móvil inexistentes. Interfaz de alta fidelidad para estudiante universitario argentino, tipografía legible, uso real del ancho y contraste.

**Sistema visual:** papel lino claro `#efe6dd`, blanco cálido elevado apenas diferenciado, texto tinta `#231f20`, metadatos gris cálido, líneas divisorias muy suaves, acento turquesa `#7ebdc2`. Títulos Newsreader, cuerpo y navegación Inter, iconos outline sencillos tipo Lucide. Sin gradientes, sombras de cards, KPIs, stickers, avatares, glassmorphism, dark-mode inventado, gamificación ni estética AI. Diseño con mucha atención a microtipografía, espacios consistentes 4/8/12/16/24px y botones táctiles.

**Regiones exactas de pantalla:**

1. **Top bar fija o sticky de Campus** (alto ~52–56px) con logo tipográfico pequeño Campus precedido de trazo vertical teal a la izquierda y botón de lupa **Buscar** a la derecha. Sin sidebar desktop, sin hamburger inventado y sin selector de workspace no existente.
2. **Área de lectura de una sola columna** con padding lateral 16–20px, sin scroll horizontal ni carrusel. Fecha uppercase pequeña **«SÁBADO 24 DE OCTUBRE»**; título Newsreader **«Tenés 3 cosas para hoy.»** en 26–29px, visible completo sin recortar. Es contenido de un fixture de demostración, no datos de una persona.
3. Seguido, encabezados pequeños **ATRASADAS (1)**, **HOY (2)** y **PRÓXIMAS (2)** con hairline. Las filas usan círculos de completado vacíos de 20px (área de toque 44px), hora en columna de 42–48px, texto principal de 14–15px, metadatos debajo en tamaño 12px. Algunos nombres de materias se pueden partir en dos líneas, **nunca truncar el título principal** de la tarea; la hora debe seguir alineada. Mantener el orden cronológico y la diferencia explícita de atrasadas.
4. **Bottom nav fija** de cinco slots con icono lineal sobre etiqueta exacta: **Hoy**, **Plan**, **Materias**, **Calendario**, **Más**. Hoy activo en turquesa de texto contrastado. No mostrar Notas/Material/Ajustes como tabs directas porque están detrás de Más.
5. **Botón flotante `+` circular** con acento sobrio de ~52px, a la derecha justo por encima de bottom nav; no superponerlo a la última fila visible. Este es el acceso real de quick-capture en móvil; no dibujar un botón Agregar duplicado en el encabezado.

**Datos de prueba exactos para 24 de octubre de 2026:**

- Atrasadas (1): **«TP 2 · atrasado»**, **18:00**, metadata «Entrega · Arquitectura de Computadoras · Atrasada», venció el 21/10. La palabra «Atrasada» en rojo sobrio no depende solo del color.
- Hoy (2): **«Teoría»**, **09:00**, metadata «Clase · Arquitectura de Computadoras»; **«TP 4 · entrega»**, **18:00**, metadata «Entrega · Sistemas y Procesos de Negocio».
- Próximas (2): **«Primer parcial»**, **08:00**, metadata «Mañana · Parcial · Análisis Matemático II»; **«Informe de laboratorio»**, **20:00**, metadata «En 4 días (28 de octubre) · Entrega · Sistemas y Procesos de Negocio». Si el viewport corta el segundo item, mantener la continuidad natural de una página desplazable, sin comprimir todo a letra microscópica.
- Más abajo del viewport, en el mismo orden de página desplazable, siguen **Sin fecha** («Pedir apuntes a Belén», tarea sin horario ni materia), **Cursando**, **Final pendiente** y **Tu carrera**. Solo dibujarlos si entran sin sacrificar la legibilidad de las obligaciones. El evento «Final» a +21 días del fixture queda fuera de la ventana Hoy de 14 días: no mostrarlo.

**Responsive verdadero:** pensar en el canvas a 390×844; no insertar el diseño desktop reducido a 390. Las áreas táctiles deben ser 44px o más aunque el círculo dibujado sea de 20px. La barra inferior reserva espacio y safe area; la última línea no queda tapada por FAB. El scroll pertenece al contenido. Si la cantidad real de filas no entra, que se perciba un corte natural al borde y no una pantalla saturada. No presentar popovers abiertos, teclado virtual, controles de fecha en grilla ni animaciones porque el estado pedido es **Hoy normal**.

**Interacciones existentes:** pulsar círculo completa obligación; título de materia abre detalle; «Ver el calendario» (si entra) navega calendario; botón de lupa abre búsqueda; `+` abre captura rápida. No inventar botón flotante de asistente, calendario de Google, interfaz de tutor IA, tareas recurrentes, notificaciones activas ni chat académico.

**Meta comparativa:** versión móvil fiel a A editorial, sin rail y con las cinco tabs reales. Mantener la identidad del desktop Cuaderno, pero adaptar jerarquía, largo de nombres y zonas de toque a pantalla angosta.
