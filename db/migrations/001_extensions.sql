-- 001_extensions.sql
-- Core Postgres extensions used throughout the schema.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email storage
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- needed for exclusion constraints on availability
