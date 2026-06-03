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

### Rate limits

The page calls the public GitHub API anonymously, which is limited to 60
requests/hour per IP. That's plenty for a handful of public repos; if you hit
the limit, just wait and refresh.

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
