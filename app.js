(() => {
  "use strict";

  const API = "https://api.github.com";

  const els = {
    refresh: document.getElementById("refresh"),
    status: document.getElementById("status"),
    totals: document.getElementById("totals"),
    totalDownloads: document.getElementById("totalDownloads"),
    totalStars: document.getElementById("totalStars"),
    totalForks: document.getElementById("totalForks"),
    totalReleases: document.getElementById("totalReleases"),
    repos: document.getElementById("repos"),
    updatedAt: document.getElementById("updatedAt"),
  };

  const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : n);

  function setStatus(msg, isError = false) {
    els.status.textContent = msg || "";
    els.status.classList.toggle("error", !!isError);
  }

  const headers = () => ({ Accept: "application/vnd.github+json" });

  // Fetch all pages of a paginated GitHub endpoint, following the Link header.
  async function fetchAll(url) {
    const out = [];
    let next = url;
    while (next) {
      const res = await fetch(next, { headers: headers() });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(`${res.status} ${res.statusText} — ${describe(body)}`);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      if (!Array.isArray(data)) return data; // non-array endpoint (repo metadata)
      out.push(...data);
      next = parseNextLink(res.headers.get("Link"));
    }
    return out;
  }

  function parseNextLink(link) {
    if (!link) return null;
    const part = link.split(",").find((p) => /rel="next"/.test(p));
    const m = part && part.match(/<([^>]+)>/);
    return m ? m[1] : null;
  }

  function describe(s) {
    try {
      const p = JSON.parse(s);
      if (p && p.message) return p.message;
    } catch (_) { /* not json */ }
    return s.slice(0, 140);
  }

  async function loadRepo(slug) {
    const [owner, repo] = slug.split("/");
    const info = await fetchAll(`${API}/repos/${owner}/${repo}`);
    const releases = await fetchAll(`${API}/repos/${owner}/${repo}/releases?per_page=100`);

    let downloads = 0;
    for (const rel of releases) {
      for (const asset of rel.assets || []) downloads += asset.download_count || 0;
    }

    return {
      slug,
      url: info.html_url || `https://github.com/${slug}`,
      stars: info.stargazers_count || 0,
      forks: info.forks_count || 0,
      releases,
      downloads,
    };
  }

  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function renderRepo(data) {
    const card = el("section", "repo-card");

    card.appendChild(el("div", "repo-head", `
      <h2><a href="${data.url}" target="_blank" rel="noopener">${escapeHtml(data.slug)}</a></h2>
      <div class="repo-badges">
        <span class="badge">⭐ <b>${fmt(data.stars)}</b></span>
        <span class="badge">🍴 <b>${fmt(data.forks)}</b></span>
        <span class="badge">⬇️ <b>${fmt(data.downloads)}</b></span>
      </div>`));

    const withAssets = data.releases.filter((r) => (r.assets || []).length > 0);

    if (withAssets.length === 0) {
      card.appendChild(el("p", "empty-note",
        data.releases.length === 0
          ? "No releases published yet."
          : "Releases exist, but none have downloadable assets."));
      return card;
    }

    const max = Math.max(
      1,
      ...withAssets.map((r) => (r.assets || []).reduce((s, a) => s + (a.download_count || 0), 0))
    );

    const list = el("div", "rel-list");
    for (const rel of withAssets) {
      const total = (rel.assets || []).reduce((s, a) => s + (a.download_count || 0), 0);
      const pct = Math.max(2, Math.round((total / max) * 100));
      const name = rel.name || rel.tag_name || "(untitled)";

      const item = el("div", "rel");
      item.appendChild(el("div", "rel-top", `
        <span class="rel-name">${escapeHtml(name)}${
          rel.tag_name ? `<span class="rel-tag">${escapeHtml(rel.tag_name)}</span>` : ""
        }</span>
        <span class="rel-count">${fmt(total)} <small>dl</small></span>`));

      const bar = el("div", "bar");
      const fill = el("span");
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      item.appendChild(bar);

      const assets = el("div", "assets");
      for (const a of rel.assets) {
        assets.appendChild(el("div", "asset", `
          <a href="${a.browser_download_url}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a>
          <span class="a-count">${fmt(a.download_count || 0)}</span>`));
      }
      item.appendChild(assets);
      list.appendChild(item);
    }
    card.appendChild(list);
    return card;
  }

  function renderRepoError(slug, message) {
    const card = el("section", "repo-card");
    card.appendChild(el("div", "repo-head", `<h2>${escapeHtml(slug)}</h2>`));
    card.appendChild(el("p", "repo-error", `⚠️ Could not load: ${escapeHtml(message)}`));
    return card;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  async function loadAll() {
    const repos = (window.STATS_CONFIG && window.STATS_CONFIG.repos) || [];
    if (repos.length === 0) {
      setStatus("No repositories configured. Edit config.js to add some.", true);
      return;
    }

    els.refresh.classList.add("spinning");
    setStatus("Loading…");
    els.repos.innerHTML = "";

    const results = await Promise.all(
      repos.map((slug) =>
        loadRepo(slug).then(
          (data) => ({ ok: true, data }),
          (err) => ({ ok: false, slug, err })
        )
      )
    );

    let downloads = 0, stars = 0, forks = 0, releases = 0, anyOk = false;
    for (const r of results) {
      if (r.ok) {
        anyOk = true;
        downloads += r.data.downloads;
        stars += r.data.stars;
        forks += r.data.forks;
        releases += r.data.releases.length;
        els.repos.appendChild(renderRepo(r.data));
      } else {
        els.repos.appendChild(renderRepoError(r.slug, r.err.message));
      }
    }

    els.totalDownloads.textContent = fmt(downloads);
    els.totalStars.textContent = fmt(stars);
    els.totalForks.textContent = fmt(forks);
    els.totalReleases.textContent = fmt(releases);
    els.totals.hidden = false;
    els.updatedAt.textContent = new Date().toLocaleString();

    const failures = results.filter((r) => !r.ok);
    if (failures.length && !anyOk) {
      const rateLimited = failures.some((f) => f.err.status === 403);
      setStatus(
        rateLimited
          ? "GitHub API rate limit reached (60 requests/hour for anonymous access). Try again later."
          : "Failed to load repositories. See details in the cards above.",
        true
      );
    } else {
      setStatus(failures.length ? `Loaded with ${failures.length} error(s).` : "");
    }

    els.refresh.classList.remove("spinning");
  }

  els.refresh.addEventListener("click", loadAll);
  loadAll();
})();
