var chalk = require('chalk');
var fs = require('fs');
var GitHubApi = require('github');
var inq = require('inquirer');
var phantom = require('phantom');

var github = new GitHubApi(
	{
		debug: true,
		followRedirects: false,
		headers: {'user-agent': 'GitHub-Issues-to-PDF'},
		host: 'api.github.com',
		pathPrefix: '',
		timeout: 10000
	}
);

var inqPrompt = [
	{
		choices: ['organization', 'user'],
		default: 'organization',
		message: 'What is the account type you\'re searching for?',
		name: 'accountType',
		type: 'list'
	},
	{
		filter: function(answer) {
			return answer.toLowerCase();
		},
		message: 'Please enter the name of the account you would like to query (required):',
		name: 'accountName',
		type: 'input',
		validate: function(answer) {
			if (answer == '') {
				return 'You must input an account name.';
			}
			return true;
		}
	},
	{
		choices: ['one', 'multiple', 'all'],
		message: 'How many repositories would you like to search?',
		name: 'allOrUniqueRepos',
		type: 'list'
	},
	{
		default: 'wedeploy.com',
		filter: function(answer) {
			return answer.toLowerCase();
		},
		message: 'Please enter the name of the specific repository you want:',
		name: 'repoName',
		type: 'input',
		validate: function(answer) {
			if (answer == '') {
				return 'You must input a repository name.';
			}
			return true;
		},
		when: function(answers) {
			return answers.allOrUniqueRepos === 'one';
		}
	},
	{
		default: true,
		message: 'Are you searching for issues that were open during a specific year?',
		name: 'searchByDate',
		type: 'confirm'
	},
	{
		default: 2016,
		message: 'What year was the issue open during?',
		name: 'issueDate',
		type: 'input',
		validate: function(value) {
			var pass = value.match(/^(\d{4})$/);

			if (pass) {
				return true;
			}

			return 'Please enter a valid year (YYYY).';
		},
		when: function(answers) {
			return answers.searchByDate === true;
		}
	}
];

function initiateGip(answers, gToken) {
	github.authenticate({token: gToken.gToken, type: 'token'});

	if ((answers.accountType === 'organization') && (answers.allOrUniqueRepos === 'all')) {
		getAllOrgRepos(answers.accountName, function(orgRepos) {
			orgRepos.forEach(function(repo) {
				getIssuesAndRenderRepo(repo, answers.issueDate);
			});
		});
	}
	else if ((answers.accountType === 'user') && (answers.allOrUniqueRepos === 'all')) {
		getAllUserRepos(answers.accountName, function(userRepos) {
			userRepos.forEach(function(repo) {
				getIssuesAndRenderRepo(repo, answers.issueDate);
			});
		});
	}
	else {
		var repo = {name: answers.repoName, owner: answers.accountName};

		getIssuesAndRenderRepo(repo, answers.issueDate);
	}
}

function getAllOrgRepos(org, callback) {
	function _getAllOrgRepos() {
		github.repos.getForOrg(
			{org: org,
			page: page,
			per_page: 100,
			type: 'public'},
			function(err, res) {
				res.data.forEach(
					function(repo) {
						collectedRepos.push(
							{name: repo.name,
							owner: org}
						);
					}
				);

				if (github.hasNextPage(res)) {
					page += 1;
					_getAllOrgRepos();
				}
				else {
					callback(collectedRepos);
				}
			}
		);
	}

	var collectedRepos = [];
	var page = 1;

	_getAllOrgRepos();
}

function getAllUserRepos(username, callback) {
	function _getAllUserRepos() {
		github.repos.getForUser(
			{page: page,
			per_page: 100,
			type: 'owner',
			username: username},
			function(err, res) {
				res.data.forEach(
					function(repo) {
						collectedRepos.push(
							{name: repo.name,
							owner: username}
						);
					}
				);

				if (github.hasNextPage(res)) {
					page += 1;
					_getAllUserRepos();
				}
				else {
					callback(collectedRepos);
				}
			}
		);
	}

	var collectedRepos = [];
	var page = 1;

	_getAllUserRepos();
}

function getIssues(accountOwner, curRepoName, callback) {
	function _getIssues() {
		github.issues.getForRepo(
			{owner: accountOwner,
			page: page,
			per_page: 100,
			repo: curRepoName,
			state: 'all'},
			function(err, res) {
				res.data.forEach(function(issue) {
					collectedIssues.push(
						{closed: issue.closed_at,
						created: issue.created_at,
						num: issue.number}
					);
				});

				if (github.hasNextPage(res)) {
					page += 1;
					_getIssues();
				}
				else {
					callback(collectedIssues);
				}
			}
		);
	}

	var collectedIssues = [];
	var page = 1;

	_getIssues();
}

function getIssuesAndRenderRepo(repo, date) {
	getIssues(repo.owner, repo.name, function(issues) {
		if (date == null) {
			phantomRender(repo, issues[0], issues.slice(1));
		}
		else {
			renderIssuesByYear(issues, date, function(datedIssues) {
				phantomRender(repo, datedIssues[0], datedIssues.slice(1));
			});
		}
	});
}

function renderIssuesByYear(issues, date, callback) {
	function _renderIssuesByYear() {
		issues.forEach(
			function(issue) {
				const createdOnOrBeforeDate = (issue.created.match(/^(\d{4})/gm) == date);
				const notClosedOrClosedAfterDate = ((issue.created.match(/^(\d{4})/gm) <= date) && (!issue.closed || issue.closed.match(/^(\d{4})/gm) >= date));

				if (createdOnOrBeforeDate || notClosedOrClosedAfterDate) {
					datedIssues.push(
						{
							created: issue.created,
							num: issue.num
						}
					);
				}
			}
		);

		callback(datedIssues);
	}

	var datedIssues = [];

	_renderIssuesByYear();
}

function phantomRender(repo, issue, remainingIssues) {
	if (issue != undefined) {
		(async function() {
			var ph = await phantom.create();
			var phPage = await ph.createPage();

			await phPage.property(
				'paperSize',
				{
					format: 'letter',
					margin: '0.5in',
					orientation: 'portrait'
				}
			);

			var status = await phPage.open('https://github.com/' + repo.owner + '/' + repo.name + '/issues/' + issue.num);

			await phPage.render('./rendered_PDFs/' + repo.owner + '_' + repo.name + '_' + issue.created.match(/^(\d{4})(-(\d{2}))(-(\d{2}))/gm) + '_issue' + issue.num + '.pdf');

			process.stdout.write('File created at [./rendered_PDFs/' + repo.owner + '_' + repo.name + '_' + issue.created.match(/^(\d{4})(-(\d{2}))(-(\d{2}))/gm) + '_issue' + issue.num + '.pdf]\n');

			await ph.exit();

			if (remainingIssues.length > 0) {
				phantomRender(repo, remainingIssues[0], remainingIssues.slice(1));
			}
			else {
				process.stdout.write(chalk.yellow('\nAll issues from the repository ' + chalk.cyan('[' + repo.name + ']') + ' have finished rendering. \n\n'));

				return;
			}
		}());
	}
	else {

		process.stdout.write(chalk.yellow('\nNo issues found in repository ' + chalk.cyan('[' + repo.name + ']') + '. \n\n'));

		return;

	}
}

inq.prompt(inqPrompt).then(
	function(answers) {
		initiateGip(answers, JSON.parse(fs.readFileSync('token.json', 'utf-8')));
	}
);