var accountName;
var accountType;
var allOrUniqueRepos;
var customHeaders = {'user-agent': 'GitHub-Issues-to-PDF'};
var GitHubApi = require('github');
var issueDate;
var issueNum;
var masterList = {repo: []};
var phantom = require('phantom');
var repoName;
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

function buildMasterList() {
	if ((accountType == 0) && (repoName == undefined)) {
		getAllOrgRepos(null, getAllIssues);
	}
	else if ((accountType == 1) && (repoName == undefined)) {
		getAllUserRepos(null, getAllIssues);
	}
	else {
		getOneRepo(
			function() {
				getIssues(repoName, null, null);
			}
		);
	}
}

function getAccountType(accountTypes) {
	return rls.keyInSelect(accountTypes, 'What is the account type you\'re searching for? ');
}

function getAllOrUniqueRepos(options) {
	return rls.keyInSelect(options, 'Do you want issues from all the repositories or a specific one? ');
}

function getAllIssues() {
	function callMe() {
		getIssues(masterList.repo[i].name, i, null);
	}

	for (var i = 0; i < masterList.repo.length; i++) {
		callMe();
	}
}

function getAllOrgRepos(pageCount, callback) {
	if (!pageCount) {
		pageCount = 1;
	}

	github.repos.getForOrg({
		org: accountName,
		page: pageCount,
		per_page: 100,
		type: 'public'
	}, function(err, res) {
		for (var i = 0; i < res.data.length; i++) {
			masterList.repo.push(
				{name: res.data[i].name}
			);
		}

		if (github.hasNextPage(res)) {
			getAllOrgRepos(pageCount + 1);
		}
		else {
			callback();
		}
	});
}

function getAllUserRepos(pageCount, callback) {
	if (!pageCount) {
		pageCount = 1;
	}

	github.repos.getForUser({
		page: pageCount,
		per_page: 100,
		type: 'owner',
		username: accountName
	}, function(err, res) {
		for (var i = 0; i < res.data.length; i++) {
			masterList.repo.push(
				{name: res.data[i].name}
			);
		}

		if (github.hasNextPage(res)) {
			getAllOrgRepos(pageCount + 1, callback);
		}
		else {
			callback();
		}
	});
}

function getIssues(curRepoName, repoCount, pageCount) {
	if (!pageCount) {
		pageCount = 1;
	}

	if (!repoCount) {
		repoCount = 0;
	}

	github.issues.getForRepo({
		owner: accountName,
		page: pageCount,
		per_page: 100,
		repo: curRepoName,
		// since: '2016-01-01T00:00:01Z',
		state: 'all'
	}, function(err, res) {
		var tempArray = [];

		for (var i = 0; i < res.data.length; i++) {
			tempArray.push({
				address: res.data[i].url,
				closed: res.data[i].closed_at,
				created: res.data[i].created_at,
				num: res.data[i].number
			});
		}
		masterList.repo[repoCount].issue = tempArray;

		if (github.hasNextPage(res)) {
			getIssues(curRepoName, repoCount, pageCount + 1);
		}
		else {
			renderMasterList();
		}
	});
}

function getOneRepo(callback) {
	github.repos.get({
		owner: accountName,
		repo: repoName
	}, function(err, res) {
		masterList.repo.push({name: res.data.name});

		callback();
	});
}

function initiateGip() {
	github.authenticate({
		token: '96f9f454d1df3f1faa947312c8ab88f62dd99d57',
		type: 'token'
	});

	accountType = getAccountType(['organization', 'user']);

	accountName = rls.question('Please enter the name of the account you would like to query (required): ');

	allOrUniqueRepos = getAllOrUniqueRepos(['all', 'a specific repo']);

	if (allOrUniqueRepos === 1) {
		repoName = rls.question('Please enter the name of the specific repository you want: ');
	}
}

function phantomRender(repoCount, issueCount) {
	(async function() {
		var instance = await phantom.create();
		var page = await instance.createPage();

		await page.property('paperSize', {format: 'letter', margin: '0.5in', orientation: 'portrait'});

		var status = await page.open('https://github.com/' + accountName + '/' + masterList.repo[repoCount].name + '/issues/' + masterList.repo[repoCount].issue[issueCount].num);

		await page.render('./rendered_PDFs/' + accountName + '_' + masterList.repo[repoCount].name + '_' + masterList.repo[repoCount].issue[issueCount].created + '_issue' +masterList.repo[repoCount].issue[issueCount].num + '.pdf');

		console.log('File created at [./rendered_PDFs/' + accountName + '_' + masterList.repo[repoCount].name + '_' + masterList.repo[repoCount].issue[issueCount].created + '_issue' +masterList.repo[repoCount].issue[issueCount].num + '.pdf]');

		await instance.exit();
	}());
}

function renderMasterList() {
	for (var i = 0; i < masterList.repo.length; i++) {
		for (var j = 0; j < masterList.repo[i].issue.length; j++) {
			var tempDate = masterList.repo[i].issue[j].created;
			masterList.repo[i].issue[j].created = tempDate.match(/^(\d{4})(-(\d{2}))(-(\d{2}))/gm)
			callMe(i, j);
		}
	}

	function callMe(i, j) {
		phantomRender(i, j);
	}
}

async function buildAndRender() {
	await buildMasterList();

	await renderMasterList();
}

initiateGip();

buildAndRender();