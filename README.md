# ⚽ WC 2026 Pool

A live World Cup 2026 pool app for you and your friends. Results sync automatically from the internet — no server required.

## Features

- 🏆 **Live leaderboard** with current pts, max possible pts, and round-by-round survival tracker
- 📋 **Group stage picks** — predict all 12 group standings before the tournament
- 🗂 **Full bracket picks** — once groups are done, fill out the complete bracket from R32 to champion, cascading like March Madness
- ⚽ **Golden boot prediction**
- 🔄 **Auto-sync** from football-data.org (free API) — just hit Sync
- 🔒 **Admin password** so only you can enter results
- 📱 Mobile-first, works great on phone

## Scoring

| Category | Points |
|---|---|
| Correct group 1st place | 3 pts |
| Correct group 2nd place | 2 pts |
| Correct group 3rd place | 1 pt |
| Golden boot scorer | 4 pts |
| Correct Round of 32 team | 2 pts each |
| Correct Round of 16 team | 3 pts each |
| Correct Quarter-finalist | 4 pts each |
| Correct Semi-finalist | 5 pts each |
| Correct Finalist | 6 pts each |
| Correct Champion | 8 pts |

## Setup (5 minutes)

### 1. Get a free API key

Go to [football-data.org/client/register](https://www.football-data.org/client/register) and register for a free account. Copy your API token from the dashboard — the World Cup is on their free tier.

### 2. Deploy to GitHub Pages

1. Create a new GitHub repository (can be private or public)
2. Upload all files, keeping the folder structure:
   ```
   index.html
   css/style.css
   js/app.js
   js/api.js
   js/data.js
   js/picks.js
   js/leaderboard.js
   js/bracket.js
   js/admin.js
   ```
3. Go to **Settings → Pages**
4. Under "Source", select **Deploy from a branch**
5. Choose **main** branch, **/ (root)** folder
6. Click Save — your site will be live at `https://yourusername.github.io/your-repo-name`

### 3. First-time setup

When you open the app for the first time, you'll see a setup screen asking for:
- **Admin password** — set something only you know. This locks the Admin tab.
- **API key** — paste your football-data.org token here.

These are stored only in *your* browser's localStorage. Your friends just open the URL and add their name — they don't need an API key or password.

> **Note:** Because everything is stored in localStorage, each person's picks are saved on their own device/browser. This is by design — it's simple and private. If someone wants to pick from a different device, they can re-enter their picks.

### 4. Run the pool

**Before the tournament:**
1. Share the URL with everyone
2. Each person taps "My Picks", enters their name, and fills out all 12 group predictions + golden boot

**After the group stage (June ~26):**
1. Go to Admin → hit Sync to pull in the final standings
2. Check the results look right, then hit "Open bracket phase"
3. Tell your friends — everyone now fills out the full bracket (R32 → Champion) in one shot

**During the knockout rounds:**
- Hit Sync in Admin any time to pull in the latest results
- The leaderboard updates instantly showing who's winning, who's mathematically alive, and whose picks are busted

---

*Built with [football-data.org](https://www.football-data.org) · Free forever*
