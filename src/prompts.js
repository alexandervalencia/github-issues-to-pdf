const chalk = require('chalk');
const fs = require('fs');
const inq = require('inquirer');

const { REGEX_TOKEN, REGEX_YEAR } = require('./constants.js');

const promptForIssueState = () =>
  inq.prompt([
    {
      choices: ['open', 'closed', 'all'],
      message: `What should the ${chalk.green('state')} of the issues be?`,
      name: 'state',
      type: 'list',
    },
  ]);

const promptForRepositories = (repoListForPrompt, repoArray) => {
  const repositoryList = repoListForPrompt || [];
  const results = repoArray || [];

  return inq
    .prompt([
      {
        filter: answer => answer.toLowerCase(),
        message: `Please enter the name of the ${chalk.green(
          'repository'
        )} to query (required):`,
        name: 'repo',
        type: 'input',
        validate: answer =>
          answer ? true : 'You must input a repository name.',
      },
      {
        default: false,
        message: answers => {
          repositoryList.push(`${answers.repo}`);

          return `${chalk.cyan('Current repository list:')} ${chalk.yellow(
            repositoryList.reverse().join(', ')
          )}\n${chalk.reset.green('?')} ${chalk.bold(
            'Would you like to add another repository?'
          )}`;
        },
        name: 'more',
        prefix: `${chalk.cyan('!')}`,
        type: 'confirm',
      },
    ])
    .then(answers => {
      results.push(answers.repo);

      if (answers.more) {
        return promptForRepositories(repositoryList, results);
      }

      return results;
    });
};

const promptForOwner = () =>
  inq.prompt([
    {
      filter: answer => answer.toLowerCase(),
      message: `Please enter the ${chalk.green(
        'owner'
      )} name for the repository to query (required):`,
      name: 'owner',
      type: 'input',
      validate: answer => (answer ? true : 'You must input an account name.'),
    },
  ]);

const promptForToken = () =>
  inq
    .prompt([
      {
        message:
          "Your GitHub Personal Access Token file doesn't exist yet, you can generate a new token (https://github.com/settings/tokens) then paste your token here and I'll save it for you:",
        name: 'id',
        type: 'input',
        validate: value => {
          const pass = value.match(REGEX_TOKEN);

          if (pass) {
            return true;
          }

          return 'Please enter a valid GitHub Personal Access Token (40 alphanumeric characters).';
        },
      },
    ])
    .then(answer => {
      fs.writeFileSync('token.json', JSON.stringify(answer));
      return answer;
    });

const promptForYear = () =>
  inq.prompt([
    {
      default: false,
      message:
        'Are you searching for issues during a specific year? (default No)',
      name: 'searchByYear',
      type: 'confirm',
    },
    {
      message: 'What year were the issues opened? (YYYY)',
      name: 'year',
      type: 'input',
      validate: value =>
        String(value).match(REGEX_YEAR) &&
        value > 2008 &&
        value <= new Date().getFullYear()
          ? true
          : 'Please enter a valid year (YYYY).',
      when: answers => answers.searchByYear === true,
    },
  ]);

module.exports = {
  promptForIssueState,
  promptForRepositories,
  promptForOwner,
  promptForToken,
  promptForYear,
};
