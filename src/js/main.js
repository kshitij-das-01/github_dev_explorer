/* Entry point — wires up search, API calls, and UI rendering */

/* ── DOM references ── */
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const profileContainer = document.getElementById('profile-container');
const loadingSpinner = document.getElementById('loading-spinner');
const errorMessage = document.getElementById('error-message');

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

/* Clear the profile container */
function clearProfile() {
  profileContainer.innerHTML = '';
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

/* ── Search flow ── */
async function handleSearch() {
  const username = searchInput.value.trim();

  if (!username) {
    setError('Please enter a GitHub username.');
    return;
  }

  /* Reset UI before fetching */
  setError(null);
  clearProfile();
  setLoading(true);

  try {
    const userData = await fetchGitHubUser(username);
    renderUserProfile(userData);
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
