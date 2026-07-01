# STACKT Moments — Setup Guide

## Step 1: Create your Supabase project
1. Go to supabase.com → New Project
2. Name it `stackt-moments`, pick any region, save your password
3. Once created, go to **Settings → API**
4. Copy your **Project URL** and **anon public key**

## Step 2: Run the database migration
1. In your Supabase dashboard → **SQL Editor**
2. Open `supabase_migration.sql` from this project
3. Paste the entire contents and click **Run**
4. You should see no errors — this creates all tables, RLS policies, and the storage bucket

## Step 3: Set up environment variables
1. Rename `.env.example` to `.env`
2. Fill in your values:
```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Step 4: Install and run locally
```bash
npm install
npm run dev
```
App runs at http://localhost:5173

## Step 5: Deploy to Vercel
1. Push this folder to a GitHub repo
2. Go to vercel.com → Import project → select your repo
3. Add your environment variables in Vercel's project settings
4. Deploy — done

Add a `vercel.json` in the root for SPA routing:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## App URLs once live
- `/` — Landing/marketing page
- `/signup` — Host registration
- `/login` — Host login
- `/dashboard` — Host dashboard (all events)
- `/dashboard/events/new` — Create new event
- `/dashboard/events/:slug` — Manage event (QR, moderation, gallery)
- `/e/:slug` — Guest upload page (share this with guests / QR code)
- `/e/:slug/wall` — Live Photo Wall for TVs/projectors

---

## Notes
- Storage bucket `event-media` is created by the migration — no manual setup needed
- Real-time is enabled on the `uploads` table — Photo Wall and guest gallery update instantly
- Moderation toggle is per-event — off by default (uploads go straight to approved)
- Plan limits (free/plus/pro) are set at event creation time based on host's plan
- Stripe integration: not included in this build — add later when ready to charge
