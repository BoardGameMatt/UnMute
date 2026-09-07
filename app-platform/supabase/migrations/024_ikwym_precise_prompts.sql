-- Rewrite Pack A copy so both check-ins and stimuli elicit a precise, uncommon word.
-- 023 is already applied; do not edit that file.

UPDATE public.ikwym_prompts AS p
SET prompt = v.prompt
FROM public.content_packs AS pack
JOIN public.protocols AS proto ON proto.id = pack.protocol_id,
(
  VALUES
    (1, 'checkin', 'What descriptive adjective would you use for how you''re showing up today?'),
    (2, 'checkin', 'What uncommon word would describe last week?'),
    (3, 'checkin', 'What precise adjective would you use for how you expect this week to go?'),
    (4, 'checkin', 'What descriptive adjective would describe how your energy is today?'),
    (5, 'checkin', 'What specific weather word would you give today, skipping "sunny" and "rainy"?'),
    (1, 'stimulus', 'Name a specific pop culture figure, a person, not a category.'),
    (2, 'stimulus', 'Name a specific historical person, not a period or event.'),
    (3, 'stimulus', 'Name a specific animal, a breed, species, or named creature, not "dog."'),
    (4, 'stimulus', 'Name a specific movie character, not just the film.'),
    (5, 'stimulus', 'Name a specific dish, not a category like "pasta."'),
    (6, 'stimulus', 'Name a specific TV character, not just the show.')
) AS v(sort_order, kind, prompt)
WHERE proto.slug = 'i-know-what-you-meme'
  AND pack.slug = 'a'
  AND p.content_pack_id = pack.id
  AND p.sort_order = v.sort_order
  AND p.kind = v.kind;
