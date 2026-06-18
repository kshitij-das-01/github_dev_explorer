/* API service — handles all GitHub REST API communication */

const API_BASE = 'https://api.github.com';

/* Parse x-ratelimit-reset header into a user-friendly minutes string */
function getRateLimitMessage(response) {
  const reset = response.headers.get('x-ratelimit-reset');
  if (!reset) return 'API rate limit exceeded. Try again later.';
  const minutes = Math.ceil((parseInt(reset) * 1000 - Date.now()) / 60000);
  const unit = minutes === 1 ? 'minute' : 'minutes';
  return `Rate limit reached. Please try again in ${minutes} ${unit}.`;
}

/* Fetch a GitHub user by username.
 * Returns parsed JSON on success.
 * Throws a descriptive error on 404 or network failure. */
async function fetchGitHubUser(username) {
  const response = await fetch(`${API_BASE}/users/${username}`);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(getRateLimitMessage(response));
    }
    if (response.status === 404) {
      throw new Error(`User "${username}" not found.`);
    }
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
}

/* Fetch public repos for a user (up to 100 per page).
 * Returns an array of repo objects.
 * Throws on rate-limit or network errors. */
async function fetchUserRepos(username) {
  const response = await fetch(`${API_BASE}/users/${username}/repos?per_page=100&sort=updated`);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(getRateLimitMessage(response));
    }
    throw new Error(`Failed to fetch repos (${response.status})`);
  }

  return response.json();
}
