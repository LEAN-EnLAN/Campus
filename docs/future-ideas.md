# Future ideas — recorded, deliberately not built

Ideas that surfaced while building the POC. They are written down here so they stop
occupying attention, and so the scope guard stays honest. **None of these are in scope**
(PRD §16).

## Explicitly out of scope for the POC

| Idea                                                 | Why it is parked                                                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared cátedra spaces / study groups                 | Personal before social (P-06). The single-player experience has to be good first                                                                          |
| Chat, comments, forums                               | Same. Also a moderation surface Campus cannot carry yet                                                                                                   |
| Cátedra or professor reviews                         | Reputational content needs governance the POC has no answer for                                                                                           |
| Apuntes marketplace                                  | Commercial + copyright surface, entirely orthogonal to the core loop                                                                                      |
| Job board / internships                              | Different product                                                                                                                                         |
| Automatic enrolment (inscripción a materias/finales) | Requires institutional credentials. PRD §13 forbids storing them, and automation against university systems is out                                        |
| Storing autogestión credentials                      | Hard no. Stated to the student in `/settings`                                                                                                             |
| Telegram/WhatsApp bot                                | Capture surface, not a product problem, until the core loop is proven                                                                                     |
| AI tutor / chat / RAG over apuntes                   | P-09: AI is optional infrastructure, not a student-facing feature in this POC                                                                             |
| Billing / premium tiers                              | Free core (P-07)                                                                                                                                          |
| Organisations / teams / institutional accounts       | Campus is personal software                                                                                                                               |
| Nationwide curriculum database                       | The provenance cost is enormous. Two institutions prove the model; a national dataset is a separate project with its own funding and verification process |
| Admin CMS for curricula                              | Curricula are seeded from official documents via reviewed migrations. A CMS invites unsourced edits, which breaks P-05                                    |
| Gamification (streaks, badges, XP)                   | Wrong emotional register. Campus should feel like a notebook, not a game                                                                                  |
| Complex analytics / study-time dashboards            | Giant KPI cards are explicitly banned by `docs/design.md`                                                                                                 |

## Worth revisiting after the POC

These are not non-goals, just not now.

- **File upload for resources.** The schema already carries `storage_path`. It ships when
  owner, size, content-type and path validation are proven — not before.
- **UNR correlativas.** Not published in the Texto Ordenado 2024; the plan says they "serán
  aprobados oportunamente por el Consejo Directivo". Revisit when the resolution appears.
  Do **not** backfill from Plan 2010: the subject codes were renumbered.
- **Plan transition mapping (UTN 2008 → 2023).** The official transition table is a scanned
  PDF with no text layer. Needs a human or better OCR.
- **Regularidad expiry.** A regularizada has a validity window that varies by institution.
  Modelling it properly needs per-institution rules, not a global constant.
- **Notes on subjects.** `user_subject_states.notes` exists and is unused by the UI.
- **Import from a screenshot of the plan.** Tempting, and exactly where hallucinated
  academic facts would enter. Would need the same provenance discipline as the seed.
- **Offline / PWA.** A student on the subte is a real use case.
- **Dark theme.** The token layer is ready for it; the editorial light theme comes first.
