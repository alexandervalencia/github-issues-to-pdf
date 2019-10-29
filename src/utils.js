const fs = require('fs');

const { REGEX_YEAR } = require('./constants.js');

const checkForToken = () => fs.existsSync('token.json');

const filterByYear = (issues, year) =>
  issues.filter(issue => REGEX_YEAR.exec(issue.created_at)[1] === year);

const filterPullRequests = issues =>
  issues.filter(issue => issue.pull_request === undefined);

const flattenArray = arr => arr.reduce((a, b) => a.concat(b));

module.exports = {
  checkForToken,
  filterByYear,
  filterPullRequests,
  flattenArray,
};
