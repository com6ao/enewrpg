-- enewrpg: fix schema for characters, profiles, gear view
-- Safe to run multiple times.

BEGIN;

-- 1) characters: campos faltantes
ALTER TABLE IF EXISTS public.characters
  ADD COLUMN IF NOT EXISTS surname TEXT,
  ADD COLUMN IF NOT EXISTS universe TEXT,
  ADD COLUMN IF NOT EXISTS energy TEXT;

-- 1.1) Garantir RLS básica (ignora se já existir)
ALTER TABLE IF EXISTS public.characters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='characters' AND policyname='own characters'
  ) THEN
    CREATE POLICY "own characters" ON public.characters
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- 2) profiles: criar se não existir
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.set_profiles_updated_at();

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='own profile all'
  ) THEN
    CREATE POLICY "own profile all" ON public.profiles
      FOR ALL
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END$$;

-- RPC opcional: garantir que o perfil exista
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;
END$$;

REVOKE ALL ON FUNCTION public.ensure_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

-- 3) Índices úteis (idempotentes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_gear_items_owner') THEN
    CREATE INDEX idx_gear_items_owner ON public.gear_items(owner_user);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_gear_items_char') THEN
    CREATE INDEX idx_gear_items_char ON public.gear_items(character_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_gear_items_slot') THEN
    CREATE INDEX idx_gear_items_slot ON public.gear_items(slot);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_gear_items_rarity') THEN
    CREATE INDEX idx_gear_items_rarity ON public.gear_items(rarity);
  END IF;
END$$;

-- 4) View para alinhar shape do JSON de gear (key→stat)
CREATE OR REPLACE VIEW public.gear_items_view AS
SELECT
  gi.id,
  gi.owner_user,
  gi.character_id,
  gi.slot,
  gi.rarity,
  jsonb_build_object('stat', gi.base->>'key', 'value', COALESCE((gi.base->>'value')::int, 0)) AS base,
  (
    SELECT jsonb_agg(
      jsonb_build_object('stat', s->>'key', 'value', COALESCE((s->>'value')::int, 0))
    )
    FROM jsonb_array_elements(COALESCE(gi.substats, '[]'::jsonb)) AS s
  ) AS substats,
  gi.score,
  gi.created_at
FROM public.gear_items gi;

COMMENT ON VIEW public.gear_items_view IS
  'Mapeia {key,value}→{stat,value} para compatibilidade com o front.';

COMMIT;
