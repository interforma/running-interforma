alter table public.runs add column coach_useful boolean;
comment on column public.runs.coach_useful is 'Opinión del corredor sobre el comentario: true me sirvió, false no me sirvió, null sin opinar.';
