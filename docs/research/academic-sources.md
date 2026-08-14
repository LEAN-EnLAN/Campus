# Academic sources — real Argentine curriculum data

All data in `docs/research/curricula/*.json` was extracted from documents that were
actually downloaded and read on **2026-08-14**. Nothing on this page or in the JSON
files is reconstructed from memory. Where a fact could not be traced to a document,
it is marked `"verified": false` and listed under **Gaps** below.

---

## 1. UTN — Facultad Regional Rosario — Ingeniería en Sistemas de Información

| field         | value                                       |
| ------------- | ------------------------------------------- |
| institution   | Universidad Tecnológica Nacional (UTN)      |
| academic unit | Facultad Regional Rosario (FRRo)            |
| program       | Ingeniería en Sistemas de Información       |
| curriculum    | **Plan 2023**                               |
| data file     | `docs/research/curricula/utn-frro-isi.json` |
| retrieved_at  | 2026-08-14                                  |

### Sources actually loaded

| #   | document                                                                                            | source_url                                                                                                             | kind            | readable?                                     |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------- |
| S1  | Departamento ISI — sección "Plan de Estudio" (index of the vigente plan)                            | `https://www.frro.utn.edu.ar/26/ingenieria-en-sistemas-de-informacion-utn#utn-887`                                     | html            | yes                                           |
| S2  | **Ordenanza CSU N° 1877/2022** — Diseño Curricular ISI, Plan 2023 (75 pp.)                          | `https://drive.google.com/file/d/1O3UdzDM7-CeKuh_v8Zj2ThOXyp5SZ0vH/view`                                               | pdf             | yes — real text layer, `pdftotext -layout`    |
| S3  | **Ordenanza CSU N° 1878/2022** — Régimen de Correlatividades y Equivalencias ISI Plan 2023 (11 pp.) | `https://drive.google.com/file/d/1M-Vvv4CSoySyS8vE8qprfsynLNjenQrX/view`                                               | pdf             | yes — real text layer                         |
| S4  | FRRo — Horarios de Cursado ISI 2026, 1° a 5° año (5 Google Sheets, one sheet per comisión)          | `https://www.frro.utn.edu.ar/26/ingenieria-en-sistemas-de-informacion-utn#utn-231`                                     | xlsx (exported) | yes                                           |
| S5  | FRRo — Información de Asignaturas Electivas ISI 2026                                                | `https://f.frro.utn.edu.ar/repositorio/departamentos/sistemas/files/horarios/ISI%20Asignaturas%20Electivas%202026.pdf` | pdf             | yes (descriptions only, no year/term mapping) |

Two further documents linked from S1 were checked and **deliberately not used** for this
program, because they belong to the intermediate degree ADUSI, not to ISI:
Ord. CSU N° 1910/2022 (Diseño Curricular ADUSI) and Ord. CSU N° 1939/2023
(Correlatividades ADUSI). The ADUSI régimen introduces an extra subject
("Seminario Integrador", nº 24) that does **not** exist in the ISI plan.

### What is verified, and from where

- **Subject names, official numbering (1–36), year level (nivel I–V) and elective
  hour blocks** — verbatim from S2, section _7.- PLAN DE ESTUDIO_ (pp. 36–38).
- **Prerequisites** — verbatim from S3, _ANEXO I — Régimen de Correlatividades_.
- **Term (`anual` / `1c` / `2c`)** — **not** stated by the Ordenanza. S2 says
  explicitly:

  > "Las Facultades Regionales tienen las atribuciones para modificar el nivel de
  > implementación de cada asignatura del Plan, como así también su desarrollo en
  > forma anual o cuatrimestral; siempre que se respete el régimen de correlatividades."

  Terms in the JSON were therefore derived from **FRRo's own 2026 timetables (S4)**:
  a subject that appears in both the _Primer Cuatrimestre_ and _Segundo Cuatrimestre_
  grids of every comisión is recorded as `anual`; one that appears in only one grid is
  recorded as that cuatrimestre. The signal was unanimous across all 33 comisiones
  except where noted under **Caveats**.

  Result: 27 subjects are `anual`; `1c` = Ingeniería y Sociedad, Sintaxis y Semántica
  de los Lenguajes, Tecnologías para la automatización, Ciencia de Datos, Gestión
  Gerencial; `2c` = Paradigmas de Programación, Sistemas Operativos, Ingeniería y
  Calidad de Software, Seguridad en los Sistemas de Información.

### How Ord. 1878 correlatividades were mapped to `to_take` / `to_pass`

This needs to be read carefully, because **Ord. 1878 does not use UTN's classic
two-block layout**. Its Anexo I has a single heading spanning two sub-columns:

```
                                     PARA CURSAR Y RENDIR
 NIVEL  Nº   ASIGNATURA          Cursadas        Aprobadas
```

i.e. the _same_ set of requirements gates **both** enrolling in and sitting the final
of the subject; the two sub-columns distinguish _regularizada_ (cursada) from
_aprobada_. The requested JSON schema only offers a `to_take` / `to_pass` axis, so
each listed requirement is emitted **twice**, once as `to_take` and once as `to_pass`.
That is the literal reading of the document.

The regularizada-vs-aprobada distinction is **not representable** in the given schema
and is therefore recorded here instead (numbers are the official Nº in S2/S3):

| Nº  | Asignatura                                | Cursadas   | Aprobadas  |
| --- | ----------------------------------------- | ---------- | ---------- |
| 1–8 | (todo el primer nivel)                    | —          | —          |
| 9   | Análisis Matemático II                    | 1, 2       | —          |
| 10  | Física II                                 | 1, 3       | —          |
| 11  | Ingeniería y Sociedad                     | —          | —          |
| 12  | Inglés II                                 | 4          | —          |
| 13  | Sintaxis y Semántica de los Lenguajes     | 5, 6       | —          |
| 14  | Paradigmas de Programación                | 5, 6       | —          |
| 15  | Sistemas Operativos                       | 7          | —          |
| 16  | Análisis de Sistemas de Información       | 6, 8       | —          |
| 17  | Probabilidad y Estadística                | 1, 2       | —          |
| 18  | Economía                                  | —          | 1, 2       |
| 19  | Bases de Datos                            | 13, 16     | 5, 6       |
| 20  | Desarrollo de Software                    | 14, 16     | 5, 6       |
| 21  | Comunicación de Datos                     | —          | 3, 7       |
| 22  | Análisis Numérico                         | 9          | 1, 2       |
| 23  | Diseño de Sistemas de Información         | 14, 16     | 4, 6, 8    |
| 24  | Legislación                               | 11         | —          |
| 25  | Ingeniería y Calidad de Software          | 19, 20, 23 | 13, 14     |
| 26  | Redes de Datos                            | 15, 21     | —          |
| 27  | Investigación Operativa                   | 17, 22     | —          |
| 28  | Simulación                                | 17         | 9          |
| 29  | Tecnologías para la automatización        | 10, 22     | 9          |
| 30  | Administración de Sistemas de Información | 18, 23     | 16         |
| 31  | Inteligencia Artificial                   | 28         | 17, 22     |
| 32  | Ciencia de Datos                          | 28         | 17, 19     |
| 33  | Sistemas de Gestión                       | 18, 27     | 23         |
| 34  | Gestión Gerencial                         | 24, 30     | 18         |
| 35  | Seguridad en los Sistemas de Información  | 26, 30     | 20, 21     |
| 36  | Proyecto Final (**para cursar** only)     | 25, 26, 30 | 12, 20, 23 |

Two extra rules quoted verbatim from S3 and encoded in the JSON:

- "Es condición para rendir Proyecto Final, aprobar todas las asignaturas previas del
  Plan de Estudios." → Proyecto Final carries a `to_pass` edge to all 35 numbered
  subjects **and** to the three elective blocks.
- "Es condición previa para iniciar y acreditar la Práctica Profesional Supervisada el
  cumplimiento de los requisitos académicos exigidos para la inscripción a Proyecto
  Final." → PPS reuses Proyecto Final's `to_take` set.

### Caveats

1. **Sintaxis y Semántica de los Lenguajes (13) vs Paradigmas de Programación (14).**
   In 7 of the 8 second-year comisiones (2K01–2K07), Sintaxis runs in the 1st
   cuatrimestre and Paradigmas in the 2nd. **Comisión 2K08 inverts the pair.** The JSON
   records the majority pattern (`13 = 1c`, `14 = 2c`).
2. **Legislación (24)** shows `anual` in the 2026 grids even though it is a 2 h/week
   subject; that is what the timetable shows.
3. **Term of the elective blocks is not established.** The plan defines an hour block
   ("Electivas 3º/4º/5º nivel"), not named subjects, and FRRo runs a rotating catalogue
   in which individual electives are cuatrimestrales. The three elective entries are
   therefore `"verified": false` with `term: "anual"` (the framing used by S2's table,
   which expresses all loads as _dictado anual_).
4. **Práctica Profesional Supervisada** is listed in S2's plan table but _outside_ the
   nivel tables (200 h, no nivel, no term). It is recorded at `year_level: 5`,
   `term: "anual"` with `"verified": false` — the level and term are an editorial
   placement, not a documented fact.
5. **The 2026 elective catalogue is not in the JSON** (electives rotate yearly). For
   reference, FRRo's 2026 offer per level was: 3º nivel — _Introducción a la Práctica
   Profesional_, _Lenguaje de Programación JAVA_, _Algoritmos Genéticos_, _Gestión
   Ingenieril_, _Informática Jurídica_, _Desarrollo de Software / IDE_; 4º nivel —
   _Metodologías Ágiles en el Desarrollo de Software_, _Metodología de la
   Investigación_, _Infraestructura Tecnológica_, _Soporte a la Gestión de datos con
   Programación Visual_; 5º nivel — _Informática en la Administración Pública_,
   _Sistemas de Información Integrados para la Industria_, _Fabricación Aditiva_,
   _Dirección de Recursos Humanos_. Titles are truncated as they appear in the
   timetable cells; the full descriptive names are in S5.
6. **No credit system.** UTN Plan 2023 expresses load in clock hours and RTF, not
   credits, so `credits` is `null` everywhere.
7. **The `(integradora)` marker was stripped from subject names.** S2 and S3 print
   subjects 16, 23, 30 and 36 as "Análisis de Sistemas de Información (integradora)",
   "Diseño de Sistemas de Información (integradora)", "Administración de Sistemas de
   Información (integradora)" and "Proyecto Final (integradora)". That parenthesis is a
   role marker, not part of the title, and keeping it would break referential integrity
   with the correlatividad table (which references the same subjects by number). The
   JSON stores the plain names; the four _asignaturas integradoras_ are exactly those
   four codes.

### Not readable

- "Resolución definitiva del Plan de Transición entre el Plan 2008 y el Plan 2023"
  (`https://drive.google.com/file/d/11Y6-bueMLWvg8Gw2XiJRuAEHXf6USd-T/view`) — 2-page
  scanned PDF with **no text layer**. Not OCR'd, not used. Nothing in the JSON depends
  on it.

---

## 2. UNR — FCEIA — Licenciatura en Ciencias de la Computación

| field         | value                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| institution   | Universidad Nacional de Rosario (UNR)                                                                                                  |
| academic unit | Facultad de Ciencias Exactas, Ingeniería y Agrimensura (FCEIA)                                                                         |
| program       | Licenciatura en Ciencias de la Computación                                                                                             |
| curriculum    | **Texto Ordenado 2024** — Res. C.D. N° 850/2023, Expte. CUDI N° 41043/2023, texto ordenado del plan aprobado por Res. C.S. N° 246/2010 |
| data file     | `docs/research/curricula/unr-fceia-lcc.json`                                                                                           |
| retrieved_at  | 2026-08-14                                                                                                                             |

### Sources actually loaded

| #   | document                                                                                                              | source_url                                                                                           | kind | readable?                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| T1  | FCEIA — ficha de la carrera LCC                                                                                       | `https://web.fceia.unr.edu.ar/es/licenciatura-en-ciencias-de-la-computaci%C3%B3n.html`               | html | yes                                                                      |
| T2  | **Plan de Estudio TO 2024** (Res. C.D. 850/2023, 23 pp.)                                                              | `https://web.fceia.unr.edu.ar/images/PDF/planes_de_estudio/Plan_LCC_CD_41043_2023_2.pdf`             | pdf  | **scanned, no text layer** — recovered by OCR + visual check (see below) |
| T3  | FCEIA — Plan de Estudios y carga horaria, **Plan 2010** (Res. C.S. 246/10), the superseded plan still published on T1 | `https://web.fceia.unr.edu.ar/images/PDF/planes_de_estudio/plan_estudios_lcc.pdf`                    | pdf  | yes — real text layer                                                    |
| T4  | Depto. de Ciencias de la Computación — "Materias de la LCC" and "Perfil y Plan"                                       | `https://dcc.fceia.unr.edu.ar/es/lcc/materias` , `https://dcc.fceia.unr.edu.ar/es/lcc/perfil-y-plan` | html | yes                                                                      |

### How T2 was read

`pdftotext` returned **0 lines** — T2 is a 200 dpi bitonal scan (`pdffonts` lists no
fonts). It was rendered with `pdftoppm -r 600` and OCR'd with `tesseract --psm 4`
(only `eng` traineddata is installed on this machine, so accents are lost by OCR).
**Pages 17 and 18 — the plan table in section "6. ASIGNACIÓN HORARIA" — were then
opened as images and read visually**, and every code, name, year and cuatrimestre in
the JSON was confirmed against that rendering. Spanish accents in the JSON come from
the visual reading of the scan, not from OCR output.

Those two rendered pages are kept as evidence at
`docs/research/evidence/unr-lcc-to2024-plan-p17.png` and
`docs/research/evidence/unr-lcc-to2024-plan-p18.png`.

The subject list was independently cross-checked against section 5 of T2
("Asignaturas: Delimitación de Contenidos", one heading per code) and against T4.

### What is verified

- **Codes (R-111 … R-521), names, year (1–5) and cuatrimestre (all `1c` / `2c`)** —
  from T2 §6, visually confirmed. T1 and T4 both state "todas las materias son
  cuatrimestrales", so no subject is `anual`.
- **Structure**: 33 rows = 28 materias obligatorias + Examen de Suficiencia de Inglés
  (R-314) + Práctica Profesional (R-512) + Tesina (R-521) + two "Horas electivas"
  blocks (75 h in 5º-1c, 150 h in 5º-2c; 225 h total, matching T4).

### Prerequisites: NOT PUBLISHED — `prerequisites: []`

T2 states verbatim, immediately after the plan table:

> "Los requisitos de correlatividades serán aprobados oportunamente por el Consejo
> Directivo de la Facultad."

No correlatividad table exists in TO 2024, and none was found on T1 or T4. Every
subject in `unr-fceia-lcc.json` therefore has `"prerequisites": []`.

**Do not backfill these from the Plan 2010 table.** T3 (Plan 2010) _does_ publish a
full correlatividad column, but the code space was **renumbered** between the two
plans — e.g. in Plan 2010 `R-313` = Análisis de Lenguajes de Programación and `R-322`
= Sistemas Operativos I, while in TO 2024 `R-313` = Sistemas Operativos I and `R-322`
= Análisis de Lenguajes de Programación; Seguridad Informática, Práctica Profesional
and Taller de Tesina also moved. Transposing the 2010 edges onto TO 2024 would be an
inference, not a source fact.

For reference only, here is the **Plan 2010** correlatividad table exactly as printed
in T3 (superseded — not loaded into any JSON):

```
R-121 ← R-111        R-311 ← R-122                R-411 ← R-223, R-312, R-314
R-122 ← R-112        R-312 ← R-212, R-221         R-412 ← R-222, R-314, R-322
R-123 ← R-113        R-313 ← R-223                R-413 ← R-223, R-312, R-314, R-324
R-211 ← R-121        R-321 ← R-311                R-421 ← R-411
R-212 ← R-123        R-322 ← R-223, R-312, R-313  R-422 ← R-213, R-312, R-313, R-314
R-213 ← R-123        R-323 ← R-222                R-423 ← R-122, R-211, R-223, R-314
R-221 ← R-211, R-212 R-324 ← R-312, R-223
R-222 ← R-212                                     R-512/R-521 ← "Según Optativa"
R-223 ← R-123                                     R-511 ← R-411
R-224 ← R-122, R-211

Plan 2010, 5º año (note the different codes and placements):
  R-511 Seguridad Informática  ← R-411
  R-512 Optativa I             ← "Según Optativa"
  R-513 Práctica Profesional   ┐ "Aprobadas o regularizadas todas las materias
  R-514 Taller de Tesina       ┘  hasta el 7º cuatrimestre inclusive"
  R-521 Optativa II            ← "Según Optativa"
  R-522 Optativa III           ← "Según Optativa"
  R-523 Tesina                 ← "Aprobadas todas las restantes Materias"
```

### Caveats

1. **Name variants inside T2.** Section 5 and section 6 of the same document disagree
   on two names: `R-212` is "Estructura de Datos y Algoritmos I" in the plan table but
   "Estructuras de datos y Algoritmos I" in the contents section; `R-324` is "Teoría de
   Base de Datos" in the table but "Teoría de Bases de Datos" in the contents section.
   The JSON uses the **plan table (§6)** spelling in both cases.
2. **T4 disagrees with T2 on exactly one placement.** The department's "Materias de la
   LCC" page lists _Seguridad Informática_ under 5º año / segundo cuatrimestre, while
   T2's plan table puts `R-511 Seguridad Informática` in 5º año / **1° cuatrimestre**.
   Every other year/cuatrimestre placement on T4 matches T2. The JSON follows **T2**,
   the Consejo Directivo resolution.
3. **No credits.** Load is expressed in weekly and total clock hours; `credits` is
   `null`.
4. The two `Horas electivas` rows are hour blocks, not named subjects; they are
   emitted with `code: null`, `elective: true`.

---

## Gaps summary

| item                                                     | status                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| UTN ISI — subject list, levels, prerequisites            | verified from Ord. 1877/2022 + Ord. 1878/2022                      |
| UTN ISI — term (anual/1c/2c)                             | derived from FRRo 2026 timetables; **not** stated by the Ordenanza |
| UTN ISI — term of the 3 elective blocks                  | `verified: false`                                                  |
| UTN ISI — level/term of Práctica Profesional Supervisada | `verified: false`                                                  |
| UTN ISI — Plan de Transición 2008→2023                   | scanned, no text layer, **not read**                               |
| UNR LCC — subject list, codes, year, cuatrimestre        | verified from TO 2024 (OCR + visual check of the scan)             |
| UNR LCC — prerequisites                                  | **not published** in TO 2024 → `[]`                                |
| UNR LCC — credits                                        | not applicable (hours only)                                        |
