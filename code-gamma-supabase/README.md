# Code Gamma (Supabase Edition)

This folder contains a Supabase-first migration target for Code Gamma.

## Included

- `supabase/schema.sql`: PostgreSQL/Supabase schema compatible with current domain tables.
- `server/`: New Express API that validates Supabase bearer tokens and uses Supabase as the data store.
  - `GET /api/health`
  - `GET /api/users/me`
  - `PATCH /api/users/me`
  - `GET /api/shifts?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in SQL Editor.
3. Copy `.env.example` to `.env` and fill keys.
4. Install dependencies and run:

```bash
npm install
npm run dev
```

## Notes

- This is a clean migration baseline (new repo layout) rather than a direct in-place replacement of every legacy SQLite route.
- Existing frontend can be pointed to this API once corresponding endpoints are ported.
