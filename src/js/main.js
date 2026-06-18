/* Entry point — wires up search, API calls, and UI rendering */

/* ── DOM references ── */
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearBtn = document.getElementById('clear-btn');
const themeToggle = document.getElementById('theme-toggle');
const profileContainer = document.getElementById('profile-container');
const repoContainer = document.getElementById('repo-container');
const langStatsContainer = document.getElementById('lang-stats-container');
const quickStatsContainer = document.getElementById('quick-stats');
const loadingSpinner = document.getElementById('loading-spinner');
const errorMessage = document.getElementById('error-message');
const skeletonProfile = document.getElementById('skeleton-profile');
const skeletonRepos = document.getElementById('skeleton-repos');

/* ── State ── */
let allRepos = [];
let currentSort = 'name';
let langChart = null;        /* Chart.js instance */

/* ══════════════════════════════════════════════════════════════
   Theme Engine
   ══════════════════════════════════════════════════════════════ */

/* Detect system preference */
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* Apply theme and save to localStorage */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

/* Toggle between dark and light */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/* Initialise theme on load */
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    setTheme(saved);
  } else {
    setTheme(getSystemTheme());
  }
  /* Listen for system preference changes */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function setLoading(visible) {
  loadingSpinner.classList.toggle('hidden', !visible);
  skeletonProfile.classList.toggle('hidden', !visible);
  skeletonRepos.classList.toggle('hidden', !visible);
}

function setError(msg) {
  errorMessage.textContent = msg || '';
  errorMessage.classList.toggle('hidden', !msg);
}

function clearResults() {
  profileContainer.innerHTML = '';
  repoContainer.innerHTML = '';
  langStatsContainer.innerHTML = '';
  langStatsContainer.classList.add('hidden');
  quickStatsContainer.innerHTML = '';
  quickStatsContainer.classList.add('hidden');
  /* Destroy Chart.js instance if it exists */
  if (langChart) {
    langChart.destroy();
    langChart = null;
  }
}

function resetApp() {
  setError(null);
  setLoading(false);
  clearResults();
  searchInput.value = '';
  allRepos = [];
  currentSort = 'name';
}

/* ══════════════════════════════════════════════════════════════
   Render: User Profile
   ══════════════════════════════════════════════════════════════ */

function renderUserProfile(user) {
  profileContainer.innerHTML = `
    <div class="profile-card">
      <img class="profile-avatar" src="${user.avatar_url}" alt="${user.login}" />
      <div class="profile-info">
        <h2 class="profile-name">${user.name || user.login}</h2>
        <p class="profile-username">@${user.login}</p>
        <p class="profile-bio">${user.bio || 'No bio available.'}</p>
      </div>
      <div class="profile-stats">
        <div class="stat">
          <span class="stat-value">${user.public_repos}</span>
          <span class="stat-label">Repos</span>
        </div>
        <div class="stat">
          <span class="stat-value">${user.followers}</span>
          <span class="stat-label">Followers</span>
        </div>
        <div class="stat">
          <span class="stat-value">${user.following}</span>
          <span class="stat-label">Following</span>
        </div>
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════════
   Render: Quick Stats
   ══════════════════════════════════════════════════════════════ */

function renderQuickStats(stats) {
  const topRepoLink = stats.topRepo
    ? `<a class="quick-stat-link" href="${stats.topRepo.url}" target="_blank" rel="noopener">★ ${stats.topRepo.stars} — ${stats.topRepo.name}</a>`
    : '<span class="quick-stat-link" style="color:var(--text-muted)">No starred repos</span>';

  quickStatsContainer.classList.remove('hidden');
  quickStatsContainer.innerHTML = `
    <div class="quick-stats-grid">
      <div class="quick-stat-card">
        <span class="quick-stat-value">${stats.languageCount}</span>
        <span class="quick-stat-label">Languages</span>
      </div>
      <div class="quick-stat-card">
        <span class="quick-stat-value">${stats.totalForks.toLocaleString()}</span>
        <span class="quick-stat-label">Total Forks</span>
      </div>
      <div class="quick-stat-card">
        <span class="quick-stat-value">★</span>
        <span class="quick-stat-label">Top Starred</span>
        ${topRepoLink}
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════════
   Render: Language Stats (with Chart.js doughnut)
   ══════════════════════════════════════════════════════════════ */

function renderLanguageStats(stats) {
  if (stats.length === 0) {
    langStatsContainer.classList.add('hidden');
    return;
  }

  langStatsContainer.classList.remove('hidden');
  langStatsContainer.innerHTML = `
    <h3 class="lang-stats-heading">Languages</h3>
    <div class="lang-chart-wrapper">
      <canvas id="lang-chart"></canvas>
    </div>
    <div class="lang-stats-list">
      ${stats.map(({ language, count, percentage, color }) => `
        <div class="lang-stat-item">
          <div class="lang-stat-header">
            <span class="lang-stat-name">
              <span class="lang-stat-dot" style="background:${color}"></span>
              ${language}
            </span>
            <span class="lang-stat-count">${count} (${percentage}%)</span>
          </div>
          <div class="lang-stat-bar-bg">
            <div class="lang-stat-bar-fill" style="width:${percentage}%;background:${color}"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  /* Build Chart.js doughnut chart */
  const ctx = document.getElementById('lang-chart').getContext('2d');
  if (langChart) langChart.destroy();

  langChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: stats.map(s => s.language),
      datasets: [{
        data: stats.map(s => s.count),
        backgroundColor: stats.map(s => s.color),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed} repos`,
          },
        },
      },
      cutout: '65%',
    },
  });
}

/* ══════════════════════════════════════════════════════════════
   Sorting
   ══════════════════════════════════════════════════════════════ */

function getSortedRepos() {
  const sorted = [...allRepos];
  switch (currentSort) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'stars':
      sorted.sort((a, b) => b.stargazers_count - a.stargazers_count);
      break;
    case 'updated':
      sorted.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      break;
  }
  return sorted;
}

/* ══════════════════════════════════════════════════════════════
   Render: Repo List
   ══════════════════════════════════════════════════════════════ */

/* Get language badge color from the LANG_COLORS map */
function getLangColor(language) {
  return LANG_COLORS[language] || FALLBACK_COLOR;
}

function renderRepoList(repos) {
  if (repos.length === 0) {
    repoContainer.innerHTML = '<p class="empty-msg">No public repositories found.</p>';
    return;
  }

  const oversizeNote = repos.length >= 100
    ? '<p class="oversize-note">Showing up to 100 repos. Use a token for full access.</p>'
    : '';

  repoContainer.innerHTML = `
    ${oversizeNote}
    <div class="repo-controls">
      <label for="sort-select">Sort:</label>
      <select id="sort-select">
        <option value="name" ${currentSort === 'name' ? 'selected' : ''}>Name (A-Z)</option>
        <option value="stars" ${currentSort === 'stars' ? 'selected' : ''}>Stars (high-to-low)</option>
        <option value="updated" ${currentSort === 'updated' ? 'selected' : ''}>Updated (newest-to-oldest)</option>
      </select>
    </div>
    <ul class="repo-list">
      ${getSortedRepos().map(repo => {
        const langColor = repo.language ? getLangColor(repo.language) : null;
        return `
          <li class="repo-item">
            <a class="repo-name" href="${repo.html_url}" target="_blank" rel="noopener">${repo.name}</a>
            <p class="repo-desc">${repo.description || 'No description provided.'}</p>
            <div class="repo-meta">
              ${repo.language ? `<span class="repo-lang" style="color:${langColor}"><span class="repo-lang-badge" style="background:${langColor}22;color:${langColor}">${repo.language}</span></span>` : ''}
              <span>★ ${repo.stargazers_count}</span>
              <span>⑂ ${repo.forks_count}</span>
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;

  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderRepoList(allRepos);
  });
}

/* ══════════════════════════════════════════════════════════════
   Search Flow
   ══════════════════════════════════════════════════════════════ */

async function handleSearch() {
  const username = searchInput.value.trim();

  if (!username) {
    setError('Please enter a GitHub username.');
    return;
  }

  setError(null);
  clearResults();
  setLoading(true);

  try {
    const [userData, repos] = await Promise.all([
      fetchGitHubUser(username),
      fetchUserRepos(username),
    ]);

    allRepos = repos;
    currentSort = 'name';

    renderUserProfile(userData);
    renderRepoList(repos);
    renderLanguageStats(calculateLanguageStats(repos));
    renderQuickStats(calculateQuickStats(repos));
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

/* ══════════════════════════════════════════════════════════════
   Event Binding
   ══════════════════════════════════════════════════════════════ */

searchBtn.addEventListener('click', handleSearch);
clearBtn.addEventListener('click', resetApp);
themeToggle.addEventListener('click', toggleTheme);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});

/* Initialise theme on page load */
initTheme();
