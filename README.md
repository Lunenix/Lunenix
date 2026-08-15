# Lunenix

Lunenix is a **private CRM & business management platform** — an internal tool
used to run multiple businesses (each as an isolated workspace) as a replacement
for Dubsado. It is not a public SaaS product.

This repository contains **Phase 1**: the application foundation — authentication,
multi-workspace support, and the dashboard shell.

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** (Radix UI primitives, `lucide-react` icons)
- **Supabase** for Postgres, authentication, and Row Level Security
  - `@supabase/supabase-js` + `@supabase/ssr` (cookie-based sessions)

## Features (Phase 1)

- Email/password **sign up** and **sign in** with Supabase Auth
- Email confirmation callback that upserts the user's profile
- **Route protection** middleware — everything under `/dashboard` requires a session
- **Workspace switcher** — users pick between the workspaces they belong to
  (persisted per-user in `localStorage`)
- **Dashboard shell** — collapsible sidebar, top bar, and placeholder stat cards
  (Contacts, Active Projects, Upcoming Appointments, Outstanding Invoices)
- Dark-mode-friendly, clean, professional UI

## Project Structure

```
src/
  app/
    (auth)/            # login, signup, auth callback, centered auth layout
    (dashboard)/       # protected dashboard layout + home page
    layout.tsx         # root layout
    page.tsx           # public landing (redirects signed-in users)
  components/
    layout/            # Sidebar, TopBar, DashboardShell, DashboardWelcome
    ui/                # shadcn/ui components
  contexts/
    WorkspaceContext.tsx
  lib/
    supabase/          # client, server, and middleware Supabase helpers
    utils.ts           # cn() helper
  types/
    database.ts        # TypeScript types for the Supabase schema
  middleware.ts        # session refresh + route protection
supabase/
  migrations/          # SQL migrations (see note below)
```

## Local Setup

```bash
# 1. Clone
git clone https://github.com/Lunenix/Lunenix.git
cd Lunenix

# 2. Configure environment
cp .env.example .env.local
# then fill in your Supabase values in .env.local:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY

# 3. Install & run
npm install
npm run dev
```

The app runs at http://localhost:3000.

> **Note:** `.env.local` holds real secrets and is git-ignored. Never commit it —
> only `.env.example` (placeholders) is tracked.

## Supabase Schema

This project builds on an **existing** Supabase schema — do **not** recreate it.
The following tables already exist with Row Level Security enabled and policies
that restrict each user to their own data:

- `workspaces` — `id`, `name`, `slug`, `created_at`, `logo_url`
- `profiles` — `id` (references `auth.users`), `full_name`, `avatar_url`, `updated_at`
- `workspace_members` — `id`, `workspace_id`, `user_id`, `role` (unique on `workspace_id + user_id`)

### Pending migration

`supabase/migrations/0001_handle_new_user.sql` adds a trigger that auto-creates a
`profiles` row on new user signup. Apply it once in the **Supabase SQL Editor**
(or via the Management API). The `/auth/callback` route also upserts the profile
as a functional fallback, so the app works before the trigger is applied.
