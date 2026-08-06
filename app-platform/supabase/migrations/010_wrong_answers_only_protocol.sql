-- 010: Register the Wrong Answers Only protocol.
insert into public.protocols (slug, name, description, type, min_players, max_players)
values (
  'wrong-answers-only',
  'Wrong Answers Only',
  'Pairs silently agree on which answers to eliminate. Ten options, some correct, no talking.',
  'realtime',
  2,
  20
)
on conflict (slug) do nothing;
