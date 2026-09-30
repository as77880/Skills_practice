// On GitHub Pages, the static frontend has no Node API backend, so default to local-only mode.
// For a hosted backend, set API to the full backend URL, e.g. https://your-railway-app.up.railway.app/api.
const isGitHubPages = typeof window !== 'undefined' && /github\.io/i.test(window.location.hostname);
export const CFG={API:isGitHubPages ? '' : '/api'};
