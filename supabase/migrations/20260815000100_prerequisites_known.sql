-- Unknown correlativas are not the same fact as no correlativas.
--
-- `curriculum_subjects` can have zero prerequisite rows for two completely
-- different reasons: the plan genuinely has none, or the faculty has not
-- published them. Without this column the only way to tell them apart is
-- `count(prerequisites) = 0`, which answers "unknown" for both — and Campus then
-- renders "nothing blocks you" over a plan whose requirements it does not know.
--
-- UNR FCEIA's Texto Ordenado 2024 is the live case: it publishes the plan and
-- says the correlatividades "serán aprobados oportunamente por el Consejo
-- Directivo". The vault format already carries this flag; the database must too,
-- or the two adapters cannot answer the same question the same way.
--
-- Default true because every curriculum seeded before this migration had its
-- prerequisites published; a plan whose requirements are unknown must say so
-- explicitly rather than inherit silence.
alter table public.curricula
  add column prerequisites_known boolean not null default true;

comment on column public.curricula.prerequisites_known is
  'false means the source does not publish correlativas for this plan. An empty prerequisite set then means UNKNOWN, never "none".';

-- Free text, shown to the student, explaining why they are unknown.
alter table public.curricula
  add column prerequisites_note text;

comment on column public.curricula.prerequisites_note is
  'Why the correlativas are unknown. Only meaningful when prerequisites_known is false.';
