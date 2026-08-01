# Job collection — how to run it

## One-time setup (you)

1. **API keys** in `client-outreach/.env` (gitignored):

```bash
APIFY_TOKEN=apify_api_...
APIFY_ACTOR_GENERIC=fetch_cat/ats-jobs-scraper
GOOGLE_API_KEY=...          # job match + search profile AI
ANTHROPIC_API_KEY=...       # optional; profile extract prefers Claude
```

2. **Rotate Apify token** if it was ever pasted in chat  
   → [Apify Console → Integrations](https://console.apify.com/account/integrations)

3. Start the app:

```bash
cd client-outreach
pnpm dev
```

Open http://127.0.0.1:3000

---

## Daily path (you)

| Step | Where | Action |
|---|---|---|
| 1 | **Profile** | Upload CV / paste text → Extract → **Approve** |
| 2 | **Search** | Review draft criteria (titles, boards) → **Approve for collectors** |
| 3 | **Today → Jobs** | Click **Collect jobs** (or run `pnpm worker`) |
| 4 | **Today → Jobs** | Triage: Interested / Save / Not interested / Already applied |

Without an approved search profile, Collect jobs is skipped.

---

## What each source does

| Source | Needs | Behavior |
|---|---|---|
| Remotive + Arbeitnow | Nothing extra | Free APIs, filtered by target titles |
| Greenhouse / Lever / Ashby via Apify | `APIFY_TOKEN` | Scrapes your **ATS board URL list** with title keyword filter |
| Infostud / HelloWorld / LinkedIn | Extra actors (optional later) | Skipped until you set actor env vars |

Default boards include Figma, Notion, Stripe, Linear, Vercel, etc. Edit them on **Search**.

---

## Cost notes

- Apify ATS actor: ~$0.005/start + ~$0.001/job (plan tiers vary)
- Daily caps come from search profile: `maxDailyRawJobs`, `maxDailyApifyUsd`
- AI match uses Gemini Flash-Lite under your monthly AI budget

---

## If something fails

| Symptom | Fix |
|---|---|
| “No search profile” | Approve on **Search** |
| No Apify jobs, only Remotive | Check `APIFY_TOKEN` in `.env`, restart `pnpm dev` |
| Apify error in logs | Open Apify run history; confirm actor `fetch_cat/ats-jobs-scraper` is allowed |
| Empty Today list | Filters may be strict — loosen exclusions, or Collect again after more boards |
| AI match skipped | Add `GOOGLE_API_KEY` |

Worker (outreach + jobs):

```bash
pnpm worker
```
