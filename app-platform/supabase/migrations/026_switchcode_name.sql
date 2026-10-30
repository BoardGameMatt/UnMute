-- Display name: Code Switch → SwitchCode. Slug stays code-switch.
UPDATE public.protocols
SET name = 'SwitchCode'
WHERE slug = 'code-switch'
  AND name IS DISTINCT FROM 'SwitchCode';
