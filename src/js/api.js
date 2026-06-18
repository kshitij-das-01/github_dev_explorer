/* API service — handles all GitHub REST API communication */

const API_BASE = 'https://api.github.com';
const TOKEN_KEY = 'github_token';

/* Read the saved token from localStorage */
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

/* Build auth headers if a token is saved */
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `token ${token}` } : {};
}

/* Parse x-ratelimit-reset header into a user-friendly minutes string */
function getRateLimitMessage(response) {
  const reset = response.headers.get('x-ratelimit-reset');
  if (!reset) return 'API rate limit exceeded. Try again later.';
  const minutes = Math.ceil((parseInt(reset) * 1000 - Date.now()) / 60000);
  const unit = minutes === 1 ? 'minute' : 'minutes';
  return `Rate limit reached. Please try again in ${minutes} ${unit}.`;
}

/* Generic fetch wrapper with auth and error handling */
async function apiFetch(url) {
  const response = await fetch(url, { headers: authHeaders() });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid token. Check your GitHub token and try again.');
    }
    if (response.status === 403) {
      throw new Error(getRateLimitMessage(response));
    }
    if (response.status === 404) {
      throw new Error('Resource not found.');
    }
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
}

/* Fetch a GitHub user by username. */
function fetchGitHubUser(username) {
  return apiFetch(`${API_BASE}/users/${username}`);
}

/* Fetch public repos for a user (up to 100 per page). */
function fetchUserRepos(username) {
  return apiFetch(`${API_BASE}/users/${username}/repos?per_page=100&sort=updated`);
}
