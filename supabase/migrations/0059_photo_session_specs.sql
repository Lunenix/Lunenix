-- Photography session extras. Do not add contacts.metadata.
-- Session specs and post-production live on photo_* tables.

ALTER TABLE public.photo_shoots
  ADD COLUMN IF NOT EXISTS second_shooter BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.photo_shoots DROP CONSTRAINT IF EXISTS photo_shoots_shoot_type_check;
ALTER TABLE public.photo_shoots
  ADD CONSTRAINT photo_shoots_shoot_type_check
  CHECK (shoot_type IN (
    'wedding', 'engagement', 'family', 'commercial', 'headshots', 'event', 'other'
  ));
