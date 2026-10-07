-- Extensions and helpers required by the schema (EXECUTION_PLAN §6).
CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
-- unaccent() is STABLE, so it cannot be used in generated columns or index expressions.
-- This wrapper pins the dictionary, which makes it safe to declare IMMUTABLE.
CREATE OR REPLACE FUNCTION sk_unaccent(text) RETURNS text
	LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
	AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
