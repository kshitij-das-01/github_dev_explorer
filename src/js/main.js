/* Entry point — wires up search, API calls, and UI rendering */

/* ── DOM references ── */
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearBtn = document.getElementById('clear-btn');
const retryBtn = document.getElementById('retry-btn');
const themeToggle = document.getElementById('theme-toggle');
const profileContainer = document.getElementById('profile-container');
const repoContainer = document.getElementById('repo-container');
const langStatsContainer = document.getElementById('lang-stats-container');
const quickStatsContainer = document.getElementById('quick-stats');
const activityBar = document.getElementById('activity-bar');
const loadingSpinner = document.getElementById('loading-spinner');
const errorMessage = document.getElementById('error-message');
const errorText = errorMessage.querySelector('.error-text');
const skeletonProfile = document.getElementById('skeleton-profile');
const skeletonRepos = document.getElementById('skeleton-repos');
const tokenInput = document.getElementById('token-input');
const tokenSaveBtn = document.getElementById('token-save-btn');
const tokenClearBtn = document.getElementById('token-clear-btn');

/* ── State ── */
let allRepos = [];
let currentSort = 'name';
let langChart = null;
let lastSearchTerm = '';
const REPOS_PER_PAGE = 9;
let repoVisibleCount = REPOS_PER_PAGE;

/* ══════════════════════════════════════════════════════════════
   Theme Engine
   ══════════════════════════════════════════════════════════════ */

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    setTheme(saved);
  } else {
    setTheme(getSystemTheme());
  }
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
  if (msg) {
    errorText.textContent = msg;
    errorMessage.classList.remove('hidden');
  } else {
    errorText.textContent = '';
    errorMessage.classList.add('hidden');
  }
}

function clearResults() {
  profileContainer.innerHTML = '';
  repoContainer.innerHTML = '';
  langStatsContainer.innerHTML = '';
  langStatsContainer.classList.add('hidden');
  quickStatsContainer.innerHTML = '';
  quickStatsContainer.classList.add('hidden');
  activityBar.classList.add('hidden');
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
  lastSearchTerm = '';
}

/* Brief success pulse on the search section */
function flashSuccess() {
  const section = searchBtn.closest('.search-section');
  section.classList.remove('search-section--success');
  /* Force reflow to restart the animation */
  void section.offsetWidth;
  section.classList.add('search-section--success');
  setTimeout(() => section.classList.remove('search-section--success'), 700);
}

/* ══════════════════════════════════════════════════════════════
   Render: User Profile
   ══════════════════════════════════════════════════════════════ */

function renderUserProfile(user) {
  profileContainer.innerHTML = `
    <div class="profile-card">
      <img class="profile-avatar" src="${user.avatar_url}" alt="Avatar of ${user.login}" />
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
      <canvas id="lang-chart" aria-label="Language distribution doughnut chart" role="img"></canvas>
    </div>
    <div class="lang-stats-list">
      ${stats.map(({ language, count, percentage, color }) => `
        <div class="lang-stat-item">
          <div class="lang-stat-header">
            <span class="lang-stat-name">
              <span class="lang-stat-dot" style="background:${color}" aria-hidden="true"></span>
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
   Render: Repo List (with staggered animation)
   ══════════════════════════════════════════════════════════════ */

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

  const sortedRepos = getSortedRepos();
  const visibleRepos = sortedRepos.slice(0, repoVisibleCount);
  const hasMore = repoVisibleCount < sortedRepos.length;

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
      ${visibleRepos.map((repo, i) => {
        const langColor = repo.language ? getLangColor(repo.language) : null;
        const highStars = repo.stargazers_count >= 100;
        return `
          <li class="repo-item" style="--i:${i}" ${highStars ? 'data-stars-high' : ''}>
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
    ${hasMore ? '<div class="show-more-wrapper"><button id="show-more-btn" class="btn-secondary">Show More</button></div>' : ''}
  `;

  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    repoVisibleCount = REPOS_PER_PAGE;
    renderRepoList(allRepos);
  });

  const showMoreBtn = document.getElementById('show-more-btn');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      repoVisibleCount += REPOS_PER_PAGE;
      renderRepoList(allRepos);
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   Search Flow
   ══════════════════════════════════════════════════════════════ */

async function handleSearch(username) {
  /* Allow passing a username directly (used by retry) */
  const term = username || searchInput.value.trim();

  if (!term) {
    setError('Please enter a GitHub username.');
    return;
  }

  lastSearchTerm = term;
  setError(null);
  clearResults();
  setLoading(true);

  try {
    const [userData, repos] = await Promise.all([
      fetchGitHubUser(term),
      fetchUserRepos(term),
    ]);

    allRepos = repos;
    currentSort = 'name';
    repoVisibleCount = REPOS_PER_PAGE;

    renderUserProfile(userData);
    renderRepoList(repos);
    renderLanguageStats(calculateLanguageStats(repos));
    renderQuickStats(calculateQuickStats(repos));
    activityBar.classList.remove('hidden');
    flashSuccess();
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

/* Retry with the last successful search term */
function handleRetry() {
  if (lastSearchTerm) {
    searchInput.value = lastSearchTerm;
    handleSearch(lastSearchTerm);
  }
}

/* ══════════════════════════════════════════════════════════════
   Event Binding
   ══════════════════════════════════════════════════════════════ */

searchBtn.addEventListener('click', () => handleSearch());
clearBtn.addEventListener('click', resetApp);
retryBtn.addEventListener('click', handleRetry);
themeToggle.addEventListener('click', toggleTheme);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});

/* ── Token management ── */

/* Load saved token into input field */
function initToken() {
  const saved = localStorage.getItem('github_token');
  if (saved) tokenInput.value = saved;
}

/* Save token to localStorage */
tokenSaveBtn.addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (token) {
    localStorage.setItem('github_token', token);
    setError(null);
    setError('✓ Token saved. Rate limit increased to 5,000 requests/hour.');
    setTimeout(() => setError(null), 3000);
  }
});

/* Remove saved token */
tokenClearBtn.addEventListener('click', () => {
  localStorage.removeItem('github_token');
  tokenInput.value = '';
  setError(null);
  setError('Token removed. Using unauthenticated rate limit (60 req/hr).');
  setTimeout(() => setError(null), 3000);
});

initTheme();
initToken();
