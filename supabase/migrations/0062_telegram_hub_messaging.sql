-- Replace Twilio SMS settings with Telegram chat threads.
-- Safe if 0061 already ran. Hub messaging uses TELEGRAM_BOT_TOKEN only.

DROP TABLE IF EXISTS public.workspace_sms_settings;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sms_threads'
      AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE public.sms_threads RENAME COLUMN contact_phone TO telegram_chat_id;
  END IF;
END $$;

ALTER TABLE public.sms_threads
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

ALTER TABLE public.sms_threads
  DROP CONSTRAINT IF EXISTS sms_threads_workspace_id_contact_phone_key;

CREATE UNIQUE INDEX IF NOT EXISTS sms_threads_workspace_telegram_chat
  ON public.sms_threads (workspace_id, telegram_chat_id);

CREATE UNIQUE INDEX IF NOT EXISTS sms_threads_telegram_chat_id
  ON public.sms_threads (telegram_chat_id);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;
