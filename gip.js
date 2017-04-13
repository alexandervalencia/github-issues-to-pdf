var accountName;
var accountType;
var allOrUniqueRepos;
var async = require('async');
var customHeaders = {'user-agent': 'GitHub-Issues-to-PDF'};
var fs = require('fs');
var GitHubApi = require('github');
var job = {};
// var page = require('webpage').create();
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

var masterList = {
	account: {
		repo: []
	}
};

function buildMasterList() {
	var total = masterList.account.repo.length;
	var count = 0;

	for (var i = 0; i < total; i++) {
		(function(err, res) {
			getIssues(masterList.account.repo[i].name);

			count++;
			if (count > total - 1) done();
		}(i));
	}

	function done() {
		console.log('All data has been loaded');
	}
}

function getAccountType(accountTypes) {
	return rls.keyInSelect(accountTypes, 'What is the account type you\'re searching for? ');
}

function getAllOrUniqueRepos(options) {
	return rls.keyInSelect(options, 'Do you want issues from all the repositories or a specific one? ');
}

function getAllOrgRepos(pageCount) {
	if (!pageCount) {
		pageCount = 1;
	}

	github.repos.getForOrg({
		org: accountName,
		page: pageCount,
		per_page: 100,
		type: 'public'
	}, function(err, res) {
		masterList.account.name = accountName;

		for (var i = 0; i < res.data.length; i++) {
			masterList.account.repo.push(
				{name: res.data[i].name}
			);
		}

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
		owner: accountName,
		page: pageCount,
		per_page: 100,
		repo: repoName,
		// since: '2016-01-01T00:00:01Z',
		state: 'all'
	}, function(err, res) {
		for (var i = 0; i < res.data.length; i++) {
			masterList.account.repo[i].push(
				{issue: [{
					address: res.data[i].url,
					closedAt: res.data[i].closed_at,
					createdAt: res.data[i].created_at,
					num: res.data[i].number
				}]}
			);
		}

		fs.writeFileSync(accountName + '_' + repoName + '_' + 'masterList.json', JSON.stringify(masterList), null);

		if (github.hasNextPage(res)) {
			getIssues(pageCount + 1);
		}
	});
}

function generateFileName(accountName, repoName, issueDate, issueNum) {
	return (accountName + '_' + repoName + '_' + issueDate + '_' + issueNum + '.pdf');
}

function renderIssuesToPdf(url, output, callback) {

}

function orgOrUser() {
	if (accountType != 'organization') {
		return false;
	}

	return true;
}

function initiateGip() {
	github.authenticate({
		token: '',
		type: ''
	});

	accountType = getAccountType(['organization', 'user']);

	accountName = rls.question('Please enter the name of the account you would like to query (required): ');

	allOrUniqueRepos = getAllOrUniqueRepos(['all', 'a specific repo']);

	if (allOrUniqueRepos === 1) {
		repoName = rls.question('Please enter the name of the specific repository you want: ');
	}
}

async.series([
	function(callback) {
		initiateGip();
		console.log(masterList.account)
		callback(null);
	},
	function(callback) {
		orgOrUser();
		callback(null);
	},
	function(callback) {
		getAllOrgRepos();
		callback(null);

	},
	function(callback) {
		setTimeout(function() {
			console.log(masterList.account);
			getIssues(repoName);
			callback(null);
		}, 2000);
	},
	function(callback) {
	setTimeout(function() {
			console.log(masterList.account);
			callback(null);
		}, 10000);
	}
]);


// phantom.exit();