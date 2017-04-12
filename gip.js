var accountType;
var allOrUniqueRepos;
var customHeaders = {'user-agent': 'GitHub-Issues-to-PDF'};
var fs = require('fs');
var GitHubApi = require('github');
var job = {};
var orgName;
var repoName;
var rls = require('readline-sync');


var github = new GitHubApi(
	{
		debug: true,
		followRedirects: false,
		headers: customHeaders,
		host: 'api.github.com',
		pathPrefix: '',
		timeout: 10000
	}
);

function getAccountType() {
	return rls.keyInSelect(accountTypes, 'What is the account type you\'re searching for? ');
}

function getAllOrUniqueRepos(repoOptions) {
	return rls.keyInSelect(repoOptions, 'Do you want issues from all the repositories or a specific one? ');
}

function getAllOrgRepos(pageCount) {
	if (!pageCount) {
		pageCount = 1;
	}

	github.repos.getForOrg({
		org: orgName,
		page: pageCount,
		per_page: 100,
		type: 'public'
	}, function(err, res) {
		fs.writeFileSync((generateFileName() + '_page' + pageCount + '.json'), JSON.stringify(res), null);

		if (github.hasNextPage(res)) {
			getAllOrgRepos(pageCount + 1);
		}
	});
}

function getIssues(repoName, pageCount) {
	if (!pageCount) {
		pageCount = 1;
	}

	github.issues.getForRepo({
		owner: orgName,
		page: pageCount,
		per_page: 100,
		repo: repoName,
		since: '2016-01-01T00:00:01Z',
		state: 'all'
	}, function(err, res) {
		fs.writeFileSync((orgName + '_' + repoName + '_' + 'issues_page' + pageCount + '.json'), JSON.stringify(res), null);

		if (github.hasNextPage(res)) {
			getIssues(repoName, pageCount + 1);
		}

	});
}

function generateFileName() {
	if (repoName != null) {
		return orgName + '_' + repoName;
	}
	return orgName;
}

function handleOrgRepoList() {
	var pulledRepoList = JSON.parse(getAllOrgRepos());
	var pulledIssuesList = JSON.parse(getAllIssues());
	var repoList;
	var masterList;

	for (i = 0; i < pulledRepoList.data.length; i++) {
		newRepoList.organization.repo.push({
			name: pulledRepoList.data[i].name
		});
	}

	return masterList;
}

/**
github.authenticate({
	token: '',
	type: 'token'
});
*/

accountType = getAccountType(['organization', 'user']);

orgName = rls.question('Please enter the name of the ' + accountType + ' account you would like to query (required): ');

allOrUniqueRepos = getAllOrUniqueRepos(['all', 'a specific repo']);

if (allOrUniqueRepos === 1) {
	repoName = rls.question('Please enter the name of the specific repository you want: ');
}

getAllOrgRepos();
if (allOrUniqueRepos === 0) {
	getIssues(all);
}
else {
	getIssues(repoName);
}