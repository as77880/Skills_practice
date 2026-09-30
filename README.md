# AJ ML Question Practice (PWA + Node + Railway MySQL)
Questions stay in static JSON. Only progress data goes to MySQL. **User answers are never sent or stored.**

## Run locally
1. Node 18+. `npm install`
2. Copy `.env.example` to `.env`, fill `MYSQL_URL` and `JWT_SECRET` (export them, e.g. `export $(cat .env | xargs)`).
3. `npm start` → http://localhost:3000 (tables are created automatically on start).

GitHub Pages note: the static site defaults to local-only mode on GitHub Pages, because Pages does not run the Node API. If you want cloud auth, set `API` in `js/config.js` to your backend URL (for example a Railway deployment).

## Deploy on Railway
1. New Project → **Deploy from GitHub repo** (push this folder) or `railway up`.
2. In the same project: **+ New → Database → MySQL**.
3. Web service → Variables: `MYSQL_URL` = `${{MySQL.MYSQL_URL}}`, `JWT_SECRET` = long random string.
4. Settings → Networking → **Generate Domain**. Open it on your phone → Add to Home screen.

## Tables (auto-created in server.js)
users(phone unique, dob_hash, password_hash, daily_goal) · question_progress(rating, attempt_count, last_attempt_at, next_review_at) · bookmarks · notes.

## API
POST /api/register, /api/login, /api/forgot (phone + DOB + new password), /api/sync (JWT required, whitelisted fields only).

## Security
bcrypt for password and DOB, JWT 7 days, helmet + CSP, rate limits, parameterised SQL, static-file whitelist. Sync conflicts: latest attempt wins; bookmarks/notes are merged, deletes sent explicitly.
DOB reset is weak (DOB is guessable): add OTP before serious public use.

## Add questions
Create `questions/<name>.json`, add `"<name>"` to `questions/index.json`. Fields: id, category, topic, level 1-3, type, q, a, tags[], key[].

## Tests
`npm test`
