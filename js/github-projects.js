const GITHUB_USER = 'JSchenkl';
const SELF_REPO = 'jschenkl.github.io';

// Already featured with dedicated Play CTAs in the #live-demos section —
// excluded here so they don't show up twice.
const FEATURED_REPOS = new Set(['bmw-m4-3d-spiel', 'gt2-rennspiel']);

function formatRelativeDate(isoString) {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'heute aktualisiert';
  if (diffDays === 1) return 'vor 1 Tag';
  if (diffDays < 30) return `vor ${diffDays} Tagen`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'vor 1 Monat';
  if (diffMonths < 12) return `vor ${diffMonths} Monaten`;

  const diffYears = Math.floor(diffMonths / 12);
  return diffYears === 1 ? 'vor 1 Jahr' : `vor ${diffYears} Jahren`;
}

function renderSkeletons(grid, count) {
  grid.replaceChildren();
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('div');
    el.className = 'skeleton-card';
    grid.appendChild(el);
  }
}

function buildRepoCard(repo) {
  const article = document.createElement('article');
  article.className = 'hud-frame';

  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = repo.name;
  card.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = repo.description || 'Keine Beschreibung vorhanden.';
  card.appendChild(desc);

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  if (repo.language) {
    const lang = document.createElement('span');
    lang.textContent = repo.language;
    meta.appendChild(lang);
  }

  if (repo.stargazers_count > 0) {
    if (meta.childElementCount > 0) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      meta.appendChild(dot);
    }
    const stars = document.createElement('span');
    stars.textContent = `★ ${repo.stargazers_count}`;
    meta.appendChild(stars);
  }

  if (meta.childElementCount > 0) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    meta.appendChild(dot);
  }
  const updated = document.createElement('span');
  updated.textContent = formatRelativeDate(repo.pushed_at);
  meta.appendChild(updated);

  card.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const ghLink = document.createElement('a');
  ghLink.className = 'btn btn-ghost';
  ghLink.href = repo.html_url;
  ghLink.target = '_blank';
  ghLink.rel = 'noopener';
  ghLink.textContent = 'GitHub';
  actions.appendChild(ghLink);
  card.appendChild(actions);

  article.appendChild(card);
  return article;
}

function renderError(statusEl, gridEl, message) {
  gridEl.replaceChildren();
  statusEl.textContent = '';
  const text = document.createTextNode(`${message} `);
  const link = document.createElement('a');
  link.href = `https://github.com/${GITHUB_USER}?tab=repositories`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Projekte direkt auf GitHub ansehen →';
  statusEl.appendChild(text);
  statusEl.appendChild(link);
}

export async function initGithubProjects() {
  const statusEl = document.getElementById('projects-status');
  const gridEl = document.getElementById('projects-grid');
  if (!statusEl || !gridEl) return;

  renderSkeletons(gridEl, 3);

  let response;
  try {
    response = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
  } catch (networkError) {
    renderError(statusEl, gridEl, 'Projekte konnten nicht geladen werden — keine Verbindung zur GitHub-API.');
    return;
  }

  if (!response.ok) {
    const rateLimited = response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0';
    renderError(
      statusEl,
      gridEl,
      rateLimited
        ? 'GitHub-API-Rate-Limit erreicht — Projekte konnten nicht geladen werden.'
        : 'Projekte konnten nicht geladen werden — GitHub-API aktuell nicht erreichbar.'
    );
    return;
  }

  let repos;
  try {
    repos = await response.json();
  } catch (parseError) {
    renderError(statusEl, gridEl, 'Projekte konnten nicht geladen werden — unerwartete Antwort von GitHub.');
    return;
  }

  const filtered = repos
    .filter((repo) => repo.name.toLowerCase() !== SELF_REPO)
    .filter((repo) => !FEATURED_REPOS.has(repo.name))
    .filter((repo) => !repo.fork && !repo.archived)
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

  gridEl.replaceChildren();

  if (filtered.length === 0) {
    statusEl.textContent = 'Noch keine weiteren öffentlichen Projekte.';
    return;
  }

  statusEl.textContent = `${filtered.length} Projekt${filtered.length === 1 ? '' : 'e'} geladen.`;
  filtered.forEach((repo) => gridEl.appendChild(buildRepoCard(repo)));
}
