/* Entry point — wires up search, API calls, and UI rendering */

/* ── DOM references ── */
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const profileContainer = document.getElementById('profile-container');
const repoContainer = document.getElementById('repo-container');
const langStatsContainer = document.getElementById('lang-stats-container');
const loadingSpinner = document.getElementById('loading-spinner');
const errorMessage = document.getElementById('error-message');

/* ── State ── */
let allRepos = [];           /* Cached repo list for current user */
let currentSort = 'name';    /* Active sort key */

/* ── Helpers ── */

/* Show/hide the loading spinner */
function setLoading(visible) {
  loadingSpinner.classList.toggle('hidden', !visible);
}

/* Display an error banner; pass null/empty to hide */
function setError(msg) {
  errorMessage.textContent = msg || '';
  errorMessage.classList.toggle('hidden', !msg);
}

/* Clear all result containers */
function clearResults() {
  profileContainer.innerHTML = '';
  repoContainer.innerHTML = '';
  langStatsContainer.innerHTML = '';
  langStatsContainer.classList.add('hidden');
}

/* ── Render user profile card ── */
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

/* ── Sorting ── */

/* Return a copy of repos sorted by the active sort key */
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

/* ── Render repo list ── */

/* Inject sort controls and the repo list into #repo-container */
function renderRepoList(repos) {
  if (repos.length === 0) {
    repoContainer.innerHTML = '<p class="empty-msg">No public repositories found.</p>';
    return;
  }

  /* If user has more than 100, show a note that results are limited */
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
      ${getSortedRepos().map(repo => `
        <li class="repo-item">
          <a class="repo-name" href="${repo.html_url}" target="_blank" rel="noopener">${repo.name}</a>
          <p class="repo-desc">${repo.description || 'No description provided.'}</p>
          <div class="repo-meta">
            ${repo.language ? `<span class="repo-lang">${repo.language}</span>` : ''}
            <span class="repo-stars">★ ${repo.stargazers_count}</span>
            <span class="repo-forks">⑂ ${repo.forks_count}</span>
          </div>
        </li>
      `).join('')}
    </ul>
  `;

  /* Bind change handler to the sort dropdown */
  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderRepoList(allRepos);
  });
}

/* ── Render language stats ── */

/* Render a bar chart showing language distribution */
function renderLanguageStats(stats) {
  if (stats.length === 0) {
    langStatsContainer.classList.add('hidden');
    return;
  }

  langStatsContainer.classList.remove('hidden');
  langStatsContainer.innerHTML = `
    <h3 class="lang-stats-heading">Languages</h3>
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
}

/* ── Search flow ── */

/* The main search handler now fetches both user profile and repos */
async function handleSearch() {
  const username = searchInput.value.trim();

  if (!username) {
    setError('Please enter a GitHub username.');
    return;
  }

  /* Reset UI before fetching */
  setError(null);
  clearResults();
  setLoading(true);

  try {
    /* Fetch both endpoints in parallel for speed */
    const [userData, repos] = await Promise.all([
      fetchGitHubUser(username),
      fetchUserRepos(username),
    ]);

    allRepos = repos;
    currentSort = 'name';

    renderUserProfile(userData);
    renderRepoList(repos);
    renderLanguageStats(calculateLanguageStats(repos));
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

/* ── Event binding ── */
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleSearch();
  }
});
