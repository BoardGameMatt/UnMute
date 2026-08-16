-- Register Cover Story as an async Season Moment.
insert into public.protocols (slug, name, description, type, min_players, max_players)
values (
  'cover-story',
  'Cover Story',
  'A short reading, then weeks of spoken cover words, then a scored reveal.',
  'async',
  6,
  15
)
on conflict (slug) do nothing;
