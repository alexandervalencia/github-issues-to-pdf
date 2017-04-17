var customHeaders = {'user-agent': 'GitHub-Issues-to-PDF'};
var GitHubApi = require('github');
var phantom = require('phantom');
var rls = require('readline-sync');

var github = new GitHubApi(
	{
		followRedirects: false,
		headers: customHeaders,
		host: 'api.github.com',
		pathPrefix: '',
		timeout: 10000
	}
);

function getAccountType(accountTypes) {
	return rls.keyInSelect(accountTypes, 'What is the account type you\'re searching for? ');
}

function getAllOrUniqueRepos(options) {
	return rls.keyInSelect(options, 'Do you want issues from all the repositories or a specific one? ');
}

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
		github.issues.getForRepo({
			owner: accountOwner,
			page: page,
			per_page: 100,
			repo: curRepoName,
			// since: '2016-01-01T00:00:01Z',
			state: 'all'
		}, function(err, res) {
			res.data.forEach(function(issue) {
				collectedIssues.push({
					address: issue.url,
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
		})
	};

	var page = 1;
	var collectedIssues = [];
	_getIssues();
}

function initiateGip() {
	github.authenticate({
		token: '508e37781e1b852ac0d20df4178a39a8c1b7a7f2',
		type: 'token'
	});

	var repoName;

	var accountType = getAccountType(['organization', 'user']);

	var accountName = rls.question('Please enter the name of the account you would like to query (required): ');

	var allOrUniqueRepos = getAllOrUniqueRepos(['all', 'a specific repo']);

	if (allOrUniqueRepos === 1) {
		repoName = rls.question('Please enter the name of the specific repository you want: ');
	}

	if ((accountType == 0) && (repoName == undefined)) {
		getAllOrgRepos(accountName, function(orgRepos) {
			orgRepos.forEach(function(repo) {
				getIssuesAndRenderRepo(repo)
			})
		})
	}
	else if ((accountType == 1) && (repoName == undefined)) {
		getAllUserRepos(accountName, function(userRepos) {
			userRepos.forEach(function(repo) {
				getIssuesAndRenderRepo(repo)
			})
		})
	}
	else {
		var repo = { name: repoName, owner: accountName  }
		getIssuesAndRenderRepo(repo)
	}
}

function getIssuesAndRenderRepo(repo) {
	getIssues(repo.owner, repo.name, function(issues) {
		renderRepoIssues(repo, issues)
	})
}

function renderRepoIssues(repo, issues) {
	issues.forEach(function(issue) {
		phantomRender(repo, issue)
	})
}

function phantomRender(repo, issue) {
	(async function() {
		var instance = await phantom.create();
		var page = await instance.createPage();

		await page.property('paperSize', {format: 'letter', margin: '0.5in', orientation: 'portrait'});

		var status = await page.open('https://github.com/' + repo.owner + '/' + repo.name + '/issues/' + issue.num);

		await page.render('./rendered_PDFs/' + repo.owner + '_' + repo.name + '_' + issue.created + '_issue' +issue.num + '.pdf');

		console.log('File created at [./rendered_PDFs/' + repo.owner + '_' + repo.name + '_' + issue.created + '_issue' +issue.num + '.pdf]');

		await instance.exit();
	}());
}

initiateGip();