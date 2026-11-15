# Burble

Burble is a focused, real-time place for group conversations, spaces, channels, and private file sharing. It is a complete rebrand and backend replacement of the original Discord-style starter: Clerk, Prisma, and UploadThing are no longer part of the Burble app path.

## What is included

- Supabase email/password accounts with cookie-backed sessions
- Personal spaces and `#general` channels
- Realtime messages with a calm, responsive Burble UI
- Private attachments stored in Supabase Storage
- Postgres access rules that limit spaces, channels, messages, and downloads to the right members

## Local setup

1. Copy `.env.example` to `.env.local`.
2. In the Supabase dashboard, open **Connect** for project `ujnlbygbhtoxgaocwmed` and copy its URL and **publishable** key into `.env.local`.
3. Run `pnpm dev`, then open `http://localhost:3000`.

Never add a service-role/secret key to `NEXT_PUBLIC_*` variables or commit `.env.local`.

## Supabase backend

The migration `create_burble_collaboration_core` has already been applied to the connected project. It creates profiles, spaces, memberships, channels, messages, the private `burble-files` bucket, realtime message delivery, indexes, and row-level security policies.

New users get a profile automatically after account creation. Email confirmation behavior follows the Supabase project’s Auth settings; if confirmation is enabled, confirm the message before signing in.

## Production checklist

- Set the deployment URL and redirect URLs in Supabase Auth.
- Configure a custom SMTP provider before inviting real users.
- Add your production domain to the Supabase Auth URL configuration.
- Keep the bucket private; Burble creates short-lived signed download links for members.
- Run `pnpm build` with the two public Supabase variables set before deploying.
