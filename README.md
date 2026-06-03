# 📊 Download Statistics

A lightweight static page that shows **GitHub release download counts**, **stars**,
and **forks** for a selected list of repositories. Data is fetched live from the
GitHub REST API directly in the browser — no backend required.

## Tracked repositories

Currently configured (edit [`config.js`](./config.js) to change):

- `robex2005/MorphHomeX`
- `robex2005/general-adblock-whitelist`

## Usage

Open `index.html` in a browser, or host the folder anywhere static (e.g. GitHub Pages).

```bash
# quick local preview
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Private repositories & rate limits

Public repos work with no setup. For **private** repos (or to avoid the
unauthenticated rate limit of 60 requests/hour), paste a
[GitHub personal access token](https://github.com/settings/tokens) into the
token field and click **Save**:

- Fine-grained token: read-only **Contents** + **Metadata** access to the repos.
- Classic token: `repo` scope (or `public_repo` for public-only).

The token is stored **only in your browser's `localStorage`** — it is never sent
anywhere except to `api.github.com`.

## Configuration

Add or remove repositories in `config.js`:

```js
window.STATS_CONFIG = {
  repos: [
    "owner/repo-one",
    "owner/repo-two",
  ],
};
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page markup |
| `style.css`  | Styling (dark theme) |
| `config.js`  | List of repositories to track |
| `app.js`     | Fetches & renders the statistics |
