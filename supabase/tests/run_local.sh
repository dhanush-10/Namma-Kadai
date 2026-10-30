#!/usr/bin/env bash
# Runs migrations + tests against a throwaway local PostgreSQL (no Supabase needed).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${DB:-namma_test}
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -c "create schema if not exists extensions"
psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
psql -v ON_ERROR_STOP=1 -d $DB -f supabase/tests/ledger.test.sql 2>&1 | grep -E "PASS|FAIL|ERROR|ALL LEDGER"
