/* Stats module — language breakdown & quick stats computation */

/* Language → colour map matching GitHub’s popular-language colours */
const LANG_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572a5',
  Java: '#b07219',
  Go: '#00add8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4f5d95',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  Dart: '#00b4ab',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Vue: '#41b883',
  Lua: '#000080',
  Haskell: '#5e5086',
  Elixir: '#6e4a7e',
  Scala: '#c22d40',
  R: '#198ce7',
};

/* Fallback colour for unrecognised languages */
const FALLBACK_COLOR = '#8b8b8b';

/* Given an array of repo objects, return a sorted array of
 * { language, count, percentage, color } objects. */
function calculateLanguageStats(repos) {
  /* Count occurrences of each language via reduce */
  const freqMap = repos.reduce((acc, repo) => {
    if (repo.language) {
      acc[repo.language] = (acc[repo.language] || 0) + 1;
    }
    return acc;
  }, {});

  const total = Object.values(freqMap).reduce((sum, v) => sum + v, 0);

  if (total === 0) return [];

  /* Convert to array, compute percentage, assign colour, sort desc */
  return Object.entries(freqMap)
    .map(([language, count]) => ({
      language,
      count,
      percentage: Math.round((count / total) * 100),
      color: LANG_COLORS[language] || FALLBACK_COLOR,
    }))
    .sort((a, b) => b.count - a.count);
}

/* Compute quick insight stats from the repo list.
 * Returns { languageCount, topRepo, totalForks } */
function calculateQuickStats(repos) {
  const languageSet = new Set();
  let topRepo = null;
  let totalForks = 0;

  repos.forEach(repo => {
    if (repo.language) languageSet.add(repo.language);
    if (!topRepo || repo.stargazers_count > topRepo.stargazers_count) {
      topRepo = repo;
    }
    totalForks += repo.forks_count;
  });

  return {
    languageCount: languageSet.size,
    topRepo: topRepo ? { name: topRepo.name, stars: topRepo.stargazers_count, url: topRepo.html_url } : null,
    totalForks,
  };
}
