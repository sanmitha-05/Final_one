# Raptee.HV Field Intelligence Platform

A production-grade internal complaint management and field intelligence web application for Raptee.HV.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| File Storage | Supabase Storage |
| Routing | React Router v6 |
| Charts | Recharts |
| Icons | Lucide React |
| Notifications | React Hot Toast |

## Quick Start

### 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql` to create all tables, enums, RLS policies, and triggers
3. Go to **Storage** and create three buckets (all **private**):
   - `complaint-attachments`
   - `fi-evidence`
   - `kb-imports`
4. In each bucket, set up the storage RLS policies from the comments at the bottom of `supabase/schema.sql`

### 2. Create User Accounts

In Supabase Dashboard → **Authentication → Users**, invite:
- `radhika@raptee.com` (role: `cce`)
- `sanmitha@raptee.com` (role: `field_intelligence`)
- `admin@raptee.com` (role: `admin`)

After creating auth users, insert corresponding rows into `user_profiles`:

```sql
INSERT INTO user_profiles (id, email, full_name, role) VALUES
  ('<radhika_auth_id>', 'radhika@raptee.com', 'Radhika S', 'cce'),
  ('<sanmitha_auth_id>', 'sanmitha@raptee.com', 'Sanmitha V', 'field_intelligence'),
  ('<admin_auth_id>', 'admin@raptee.com', 'Admin User', 'admin');
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these in Supabase → **Project Settings → API**.

> ⚠️ **Security**: Never commit `.env.local`. It is gitignored. Never use the `service_role` key in frontend code.

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 6. Build for Production

```bash
npm run build
```

Output is in `dist/`.

## Deployment (Cloudflare Pages — Free Tier)

1. Push to GitHub
2. In Cloudflare Pages, connect your repository
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## User Roles

| Role | User | Permissions |
|------|------|-------------|
| `cce` | Radhika | Register complaints, view report, resolve, escalate |
| `field_intelligence` | Sanmitha | FI Dashboard, investigate escalated complaints |
| `admin` | Admin | All CCE + FI permissions + user management + KB import |

## Workflow

```
CCE Registers Complaint
        ↓
  Complaint Report (Pending)
        ↓
   CCE Decision:
   ├── Resolve → CCE Resolution Form → Status: Resolved
   └── Escalate → Escalate Modal → Status: Escalated
                        ↓
              FI Dashboard (Escalated)
                        ↓
              FI Opens Investigation
                        ↓
            FI Resolution Form:
            ├── Fix Implemented & Verified → Resolved (removed from FI queue)
            ├── Recommended Fix Pending → In Progress (stays in FI queue)
            ├── Further Investigation Required → In Progress
            ├── Unable to Reproduce → In Progress
            └── No Fix Identified → Not Resolved
```

## Module Summary

| Module | Description |
|--------|-------------|
| 1 | Complaint Registration Form (CCE) |
| 2 | Complaint Report Dashboard (CCE) |
| 3 | CCE Resolution Form |
| 4 | Escalate Complaint Modal |
| 5 | Field Intelligence Dashboard (FI) |
| 6 | FI Resolution / Investigation Form |
| 7 | Shared Status + Complaint History Timeline |
| 8 | Historical Knowledge Base + Import |
| 9 | AI-Assisted FI (optional, requires API key) |
| 10 | Analytics Dashboard |
| 11 | Database, Storage, Data Model |
| 12 | UI, Navigation, Design System |

## AI Features (Optional)

AI assistance is **disabled by default**. To enable:

1. Obtain an OpenAI API key with company approval
2. Add to `.env.local`:
   ```
   VITE_AI_API_KEY=sk-...
   ```
3. AI features will activate automatically

> ⚠️ AI features require external API costs. Get company approval before enabling. All AI suggestions require human review — AI cannot automatically close complaints.

## Free Tier Limits

| Service | Free Tier Limit |
|---------|----------------|
| Supabase DB | 500 MB storage, 2 GB bandwidth/month |
| Supabase Auth | 50,000 MAU |
| Supabase Storage | 1 GB, 2 GB bandwidth |
| Cloudflare Pages | 500 builds/month, unlimited requests |
| GitHub | Unlimited public/private repos |

## Security Notes

- Row Level Security (RLS) is enabled on all tables
- Backend policies enforce role-based access — hiding buttons is NOT the only control
- The anon key is safe for browser use with RLS enabled
- Never expose the `service_role` key in frontend code
- All file uploads are to private buckets (not publicly accessible)
- AI provider receives only technical complaint text, not personal customer data (by default)

## Remaining Manual Steps

After running schema.sql:
1. ✅ Create storage buckets manually in Supabase Dashboard
2. ✅ Add storage RLS policies (see schema.sql comments)
3. ✅ Create user accounts in Supabase Auth
4. ✅ Insert user_profiles rows
5. ✅ Set up environment variables
6. ✅ (Optional) Configure AI provider credentials
7. ✅ Deploy to Cloudflare Pages or your preferred host
# Final_one
