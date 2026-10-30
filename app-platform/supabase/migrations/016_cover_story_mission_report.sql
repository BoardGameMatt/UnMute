-- Sitting B mission report: 50-char context per word, and a pre-guess subphase.

ALTER TABLE public.cover_story_word_logs
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';

ALTER TABLE public.cover_story_word_logs
  DROP CONSTRAINT IF EXISTS cover_story_word_logs_note_len_check;

ALTER TABLE public.cover_story_word_logs
  ADD CONSTRAINT cover_story_word_logs_note_len_check
  CHECK (char_length(note) <= 50);

ALTER TABLE public.cover_story_sessions
  DROP CONSTRAINT IF EXISTS cover_story_sessions_reveal_subphase_check;

ALTER TABLE public.cover_story_sessions
  ADD CONSTRAINT cover_story_sessions_reveal_subphase_check CHECK (
    reveal_subphase IN (
      'mission',
      'guess',
      'gallery',
      'mark',
      'board',
      'points',
      'final'
    )
  );
