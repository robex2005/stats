(() => {
  "use strict";

  const API = "https://api.github.com";
  const TOKEN_KEY = "gh_stats_token";

  const els = {
    token: document.getElementById("token"),
    saveToken: document.getElementById("saveToken"),
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

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setStatus(msg, isError = false) {
    els.status.textContent = msg || "";
    els.status.classList.toggle("error", !!isError);
  }

  function headers() {
    const h = { Accept: "application/vnd.github+json" };
    const token = getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  // Fetch all pages of a paginated GitHub endpoint, following the Link header.
  async function fetchAll(url) {
    const out = [];
    let next = url;
    while (next) {
      const res = await fetch(next, { headers: headers() });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(
          `${res.status} ${res.statusText}${body ? ` — ${truncate(body)}` : ""}`
        );
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      if (Array.isArray(data)) out.push(...data);
      else return data; // non-array endpoint (e.g. repo metadata)
      next = parseNextLink(res.headers.get("Link"));
    }
    return out;
  }

  function parseNextLink(link) {
    if (!link) return null;
    const match = link.split(",").find((p) => /rel="next"/.test(p));
    if (!match) return null;
    const m = match.match(/<([^>]+)>/);
    return m ? m[1] : null;
  }

  function truncate(s, n = 160) {
    try {
      const parsed = JSON.parse(s);
      if (parsed && parsed.message) return parsed.message;
    } catch (_) { /* not json */ }
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  async function loadRepo(slug) {
    const [owner, repo] = slug.split("/");
    const repoInfo = await fetchAll(`${API}/repos/${owner}/${repo}`);
    const releases = await fetchAll(
      `${API}/repos/${owner}/${repo}/releases?per_page=100`
    );

    let downloads = 0;
    for (const rel of releases) {
      for (const asset of rel.assets || []) {
        downloads += asset.download_count || 0;
      }
    }

    return {
      slug,
      url: repoInfo.html_url || `https://github.com/${slug}`,
      stars: repoInfo.stargazers_count || 0,
      forks: repoInfo.forks_count || 0,
      releases,
      downloads,
    };
  }

  function renderRepo(data) {
    const card = document.createElement("section");
    card.className = "repo-card";

    const head = document.createElement("div");
    head.className = "repo-head";
    head.innerHTML = `
      <h2><a href="${data.url}" target="_blank" rel="noopener">${data.slug}</a></h2>
      <div class="repo-badges">
        <span>★ <b>${fmt(data.stars)}</b> stars</span>
        <span>⑂ <b>${fmt(data.forks)}</b> forks</span>
        <span>⬇ <b>${fmt(data.downloads)}</b> downloads</span>
      </div>`;
    card.appendChild(head);

    const releasesWithAssets = data.releases.filter(
      (r) => (r.assets || []).length > 0
    );

    if (releasesWithAssets.length === 0) {
      const note = document.createElement("p");
      note.className = "empty-note";
      note.textContent =
        data.releases.length === 0
          ? "No releases published yet."
          : "Releases exist, but none have downloadable assets.";
      card.appendChild(note);
      return card;
    }

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>Release / asset</th>
          <th class="num">Downloads</th>
        </tr>
      </thead>`;
    const tbody = document.createElement("tbody");

    for (const rel of releasesWithAssets) {
      const relTotal = (rel.assets || []).reduce(
        (s, a) => s + (a.download_count || 0),
        0
      );
      const relName = rel.name || rel.tag_name || "(untitled)";
      const relRow = document.createElement("tr");
      relRow.className = "release-row";
      relRow.innerHTML = `
        <td>${escapeHtml(relName)}${rel.tag_name ? ` <span class="muted">(${escapeHtml(rel.tag_name)})</span>` : ""}</td>
        <td class="num">${fmt(relTotal)}</td>`;
      tbody.appendChild(relRow);

      for (const asset of rel.assets) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td class="asset-name">&nbsp;&nbsp;<a href="${asset.browser_download_url}" target="_blank" rel="noopener">${escapeHtml(asset.name)}</a></td>
          <td class="num">${fmt(asset.download_count || 0)}</td>`;
        tbody.appendChild(row);
      }
    }

    table.appendChild(tbody);
    card.appendChild(table);
    return card;
  }

  function renderRepoError(slug, message) {
    const card = document.createElement("section");
    card.className = "repo-card";
    card.innerHTML = `
      <div class="repo-head"><h2>${slug}</h2></div>
      <p class="repo-error">⚠ Could not load: ${escapeHtml(message)}</p>`;
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

    els.refresh.disabled = true;
    setStatus("Loading…");
    els.repos.innerHTML = "";

    let totalDownloads = 0;
    let totalStars = 0;
    let totalForks = 0;
    let totalReleases = 0;
    let anyOk = false;

    const results = await Promise.all(
      repos.map((slug) =>
        loadRepo(slug).then(
          (data) => ({ ok: true, data }),
          (err) => ({ ok: false, slug, err })
        )
      )
    );

    for (const r of results) {
      if (r.ok) {
        anyOk = true;
        totalDownloads += r.data.downloads;
        totalStars += r.data.stars;
        totalForks += r.data.forks;
        totalReleases += r.data.releases.length;
        els.repos.appendChild(renderRepo(r.data));
      } else {
        els.repos.appendChild(renderRepoError(r.slug, r.err.message));
      }
    }

    els.totalDownloads.textContent = fmt(totalDownloads);
    els.totalStars.textContent = fmt(totalStars);
    els.totalForks.textContent = fmt(totalForks);
    els.totalReleases.textContent = fmt(totalReleases);
    els.totals.hidden = false;
    els.updatedAt.textContent = new Date().toLocaleString();

    const failures = results.filter((r) => !r.ok);
    if (failures.length && !anyOk) {
      const needsAuth = failures.some((f) => f.err.status === 404 || f.err.status === 401);
      setStatus(
        needsAuth
          ? "All repositories failed to load. Private repos require a valid token with 'repo' scope."
          : "Failed to load repositories. See details in the cards above.",
        true
      );
    } else if (failures.length) {
      setStatus(`Loaded with ${failures.length} error(s).`, true);
    } else {
      setStatus("");
    }

    els.refresh.disabled = false;
  }

  // --- wire up UI ---
  els.token.value = getToken();
  els.saveToken.addEventListener("click", () => {
    const v = els.token.value.trim();
    if (v) localStorage.setItem(TOKEN_KEY, v);
    else localStorage.removeItem(TOKEN_KEY);
    setStatus(v ? "Token saved to this browser." : "Token cleared.");
    loadAll();
  });
  els.refresh.addEventListener("click", loadAll);

  loadAll();
})();
