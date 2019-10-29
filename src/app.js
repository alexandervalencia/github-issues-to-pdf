const fs = require('fs');
const Octokit = require('@octokit/rest');

const {
  promptForIssueState,
  promptForOwner,
  promptForRepositories,
  promptForToken,
  promptForYear,
} = require('./prompts.js');

const {
  checkForToken,
  filterByYear,
  filterPullRequests,
  flattenArray,
} = require('./utils.js');

// const REGEX_FILE_DATE = /^(\d{4})(-(\d{2}))(-(\d{2}))/gm;

const fetchIssueUrls = async (octokit, config) => {
  const { owner, repo, searchByYear, state, year } = config;

  const issuesUrls = await octokit.issues
    .listForRepo({
      owner,
      repo,
      state,
    })
    .then(issues => {
      process.stdout.write(issues);
      let { data } = issues;

      if (searchByYear) {
        data = filterByYear(data, year);
      }

      data = filterPullRequests(data);

      return data.map(issue => issue.html_url);
    })
    .catch(err => {
      throw new Error('Something went wrong: ', err);
    });

  return issuesUrls;
};

const start = async () => {
  const config = {};

  const token = checkForToken()
    ? JSON.parse(fs.readFileSync('token.json'))
    : await promptForToken();

  config.token = token.id;

  const { owner } = await promptForOwner();

  config.owner = owner;

  const repositories = await promptForRepositories();

  const { state } = await promptForIssueState();

  config.state = state;

  const { searchByYear, year } = await promptForYear();

  config.searchByYear = searchByYear;
  config.year = year;

  const octokit = new Octokit({
    userAgent: 'GitHub-Issues-to-PDF',
    auth: `token ${token.id}`,
  });

  const issueUrls = [];

  for (const repo of repositories) {
    config.repo = repo;

    issueUrls.push(await fetchIssueUrls(octokit, config));
  }

  console.log(flattenArray(issueUrls));

  console.log('after fetch');
};

module.exports = { start };
