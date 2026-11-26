// Repositories to track download statistics for.
// Add or remove entries here as "owner/repo".
window.STATS_CONFIG = {
  repos: [
    "robex2005/MorphHomeX",
    "robex2005/alerte-meteo-ro",
  ],
  // Date from which a repo's Marketplace downloads are counted exactly via the
  // release zip asset. Clones before this date are counted as downloads; repos
  // not listed here count all clones (no release asset to count).
  zipSince: {
    "robex2005/alerte-meteo-ro": "2026-11-26",
  },
};
