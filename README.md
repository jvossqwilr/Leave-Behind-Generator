# Qwilr Leave-Behind Generator

Personalized sales leave-behind tool for the Qwilr sales team. Select prospect context, and the tool pulls live G2 reviews, competitive signals, and Notion content to generate a polished, shareable PDF in seconds.

**Stack:** Vercel (hosting) · Groq API (LLM) · Notion API · G2 public scraping

---

## Deploy in 4 steps

### 1. Get your API keys

**Groq API key** (fast, free tier is generous)
- Go to [console.groq.com](https://console.groq.com)
- Sign up → API Keys → Create new key

**Notion integration token**
- Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
- Click "New integration" → name it "Leave-Behind Generator" → Submit
- Copy the "Internal Integration Secret"
- **Critical:** Open each Notion page you want to use (case studies, battle cards, customers) → click `...` menu top-right → "Add connections" → select your integration

### 2. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/jvossqwilr/Leave-Behind-Generator.git
git push -u origin main
```

### 3. Connect to Vercel

- Go to [vercel.com](https://vercel.com) → sign in with GitHub
- "Add New Project" → import `Leave-Behind-Generator`
- Before deploying, go to **Environment Variables** and add:

| Variable | Value |
|---|---|
| `GROQ_API_KEY` | from console.groq.com |
| `NOTION_TOKEN` | from notion.so/my-integrations |
| `NOTION_CASE_STUDIES_DB_ID` | Notion DB or page ID (see below) |
| `NOTION_BATTLE_CARDS_DB_ID` | Notion DB or page ID |
| `NOTION_CUSTOMERS_DB_ID` | Notion DB or page ID |

**Finding Notion IDs:**
- Open the database/page in Notion
- Look at the URL: `notion.so/yourworkspace/PageName-[COPY-THIS-PART]`
- The ID is the last segment (32 characters with hyphens)

- Click Deploy → your tool is live at `https://your-project.vercel.app`

### 4. Add your logo (optional)

Drop `logo.png` into `public/assets/` and push — Vercel redeploys automatically.

---

## Notion setup options

**Option A — Database IDs** (best if you have structured Notion databases)
Set `NOTION_CASE_STUDIES_DB_ID`, `NOTION_BATTLE_CARDS_DB_ID`, `NOTION_CUSTOMERS_DB_ID`

**Option B — Page IDs** (if content is in regular Notion pages)
Set `NOTION_CASE_STUDIES_PAGE_ID`, `NOTION_BATTLE_CARDS_PAGE_ID`, `NOTION_CUSTOMERS_PAGE_ID`

**Option C — Auto-search** (zero config, less precise)
Leave all IDs blank. The tool searches your connected workspace automatically.

---

## Local development

```bash
npm install
cp .env.example .env.local
# Fill in your keys
npx vercel dev
# Open http://localhost:3000
```

---

## Phase 2: Gong integration

When ready, add `GONG_API_KEY` and `GONG_API_SECRET` to Vercel environment variables and wire up `lib/gong.js` to pull call intelligence into the generation prompt.
