var GitHubApi = require('github');
var inq = require('inquirer');
var inqAnswers;
var phantom = require('phantom');

var github = new GitHubApi(
	{
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
		type: 'list',
		message: 'What is the account type you\'re searching for?',
		name: 'accountType'
	},
	{
		filter: function(answer) {
			return answer.toLowerCase();
		},
		message: 'Please enter the name of the account you would like to query (required):',
		name: 'accountName',
		type: 'input',
		validate: function (answer) {
			if (answer == '') {
				return 'You must input an account name.';
			}
			return true;
		}
	},
	{
		choices: ['all', 'a specific repository'],
		type: 'list',
		message: 'Would you like to get the issues from every repository for the account or a specific one?',
		name: 'allOrUniqueRepos'
	},
	{
		filter: function(answer) {
			return answer.toLowerCase();
		},
		message: 'Please enter the name of the specific repository you want:',
		name: 'repoName',
		type: 'input',
		validate: function (answer) {
			if (answer == '') {
				return 'You must input a repository name.';
			}
			return true;
		},
		when: function (answers) {
			return answers.allOrUniqueRepos === 'a specific repository';
		}
	}
];

function getAllIssues() {
	function createIssueCallback(repo) {
		return function(issues) {
			repo.issue = issues
		}
	}

	for (var i = 0; i < masterList.repo.length; i++) {
		getIssues(accountName, masterList.repo[i].name, createIssueCallback(masterList.repo[i]));
	}
}

function getAllOrgRepos(org, callback) {
	function _getAllOrgRepos() {
		github.repos.getForOrg({
			org: org,
			page: page,
			per_page: 100,
			type: 'public'
		}, function(err, res) {
			res.data.forEach(function(repo) {
				collectedRepos.push({ name: repo.name, owner: org })
			})

			if (github.hasNextPage(res)) {
				page += 1;
				_getAllOrgRepos();
			}
			else {
				callback(collectedRepos);
			}
		});
	}

	var page = 1;
	var collectedRepos = [];

	_getAllOrgRepos()
}

function getAllUserRepos(username, callback) {
	function _getAllUserRepos() {
		github.repos.getForUser({
			page: page,
			per_page: 100,
			type: 'owner',
			username: username
		}, function(err, res) {
			res.data.forEach(function(repo) {
				collectedRepos.push({ name: repo.name, owner: username })
			})

			if (github.hasNextPage(res)) {
				page += 1;
				_getAllUserRepos();
			}
			else {
				callback(collectedRepos);
			}
		});
	}

	var page = 1;
	var collectedRepos = [];

	_getAllUserRepos();
}

function getIssues(accountOwner, curRepoName, callback) {
	function _getIssues() {
		github.issues.getForRepo(
			{
				owner: accountOwner,
				page: page,
				per_page: 100,
				repo: curRepoName,
				// since: '2016-01-01T00:00:01Z',
				state: 'all'
			}, function(err, res) {
				res.data.forEach(function(issue) {
					collectedIssues.push({
						closed: issue.closed_at,
						created: issue.created_at.match(/^(\d{4})(-(\d{2}))(-(\d{2}))/gm),
						num: issue.number
					})
				})

				if (github.hasNextPage(res)) {
					page += 1;
					_getIssues()
				} else {
					callback(collectedIssues);
				}
			}
		)
	};

	var page = 1;
	var collectedIssues = [];

	_getIssues();
}

function initiateGip() {
	github.authenticate({
		token: '6e93bad50b035f9c972f8fba3eed0d8bf59e926f',
		type: 'token'
	});

	var accountType = inqAnswers.accountType;
	var accountName = inqAnswers.accountName;
	var allOrUniqueRepos = inqAnswers.allOrUniqueRepos;
	var repoName = inqAnswers.repoName;

	if ((accountType === 'organization') && (allOrUniqueRepos === 'all')) {
		getAllOrgRepos(accountName, function(orgRepos) {
			orgRepos.forEach(function(repo) {
				getIssuesAndRenderRepo(repo)
			})
		})
	}
	else if ((accountType === 'user') && (allOrUniqueRepos === 'all')) {
		getAllUserRepos(accountName, function(userRepos) {
			userRepos.forEach(function(repo) {
				getIssuesAndRenderRepo(repo)
			})
		})
	}
	else {
		var repo = { name: repoName, owner: accountName };

		getIssuesAndRenderRepo(repo)
	}
}

function getIssuesAndRenderRepo(repo) {
	getIssues(repo.owner, repo.name, function(issues) {
		phantomRender(repo, issues[0], issues.slice(1));
	})
}

function phantomRender(repo, issue, remainingIssues) {
	(async function() {
		var instance = await phantom.create();
		var page = await instance.createPage();

		await page.property('paperSize', {format: 'letter', margin: '0.5in', orientation: 'portrait'});

		var status = await page.open('https://github.com/' + repo.owner + '/' + repo.name + '/issues/' + issue.num);

		await page.render('./rendered_PDFs/' + repo.owner + '_' + repo.name + '_' + issue.created + '_issue' +issue.num + '.pdf');

		console.log('File created at [./rendered_PDFs/' + repo.owner + '_' + repo.name + '_' + issue.created + '_issue' +issue.num + '.pdf]');

		await instance.exit();

		if (remainingIssues.length > 0) {
			phantomRender(repo, remainingIssues[0], remainingIssues.slice(1));
		}
	}());
}

inq.prompt(inqPrompt).then(
	function (answers) {
		inqAnswers = answers;
	}
).then(initiateGip);