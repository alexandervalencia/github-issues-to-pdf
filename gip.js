var chalk = require('chalk');
var fs = require('fs');
var GitHubApi = require('github');
var inq = require('inquirer');
var phantom = require('phantom');

var github = new GitHubApi(
	{
		followRedirects: false,
		headers: {'user-agent': 'GitHub-Issues-to-PDF'},
	}
);

function checkForToken() {
	try {
		fs.accessSync('token.json');
	}
	catch (e) {
		return false;
	}
	return true;
}

function getToken() {
	return inq.prompt(
		[{message: 'Your GitHub Personal Access Token file doesn\'t exist yet, enter your token here and I\'ll save it for you:',
		name: 'token',
		type: 'input',
		validate: value => {
			const pass = value.match(/([a-zA-Z0-9]{40})+/g);

			if (pass) {
				return true;
			}

			return 'Please enter a valid GitHub Personal Access Token (40 alphanumeric characters).';
		}}]
	).then(
		answer => {
			fs.writeFileSync('token.json', JSON.stringify(answer));
			return answer;
		}
	);
}

function gatherAccountInfo() {
	return inq.prompt(
		[
			{
				choices: ['organization', 'user'],
				default: 'organization',
				message: 'What is the account type you\'re searching for?',
				name: 'accountType',
				type: 'list'
			},
			{
				filter: answer => {
					return answer.toLowerCase();
				},
				message: 'Please enter the name of the account you would like to query (required):',
				name: 'accountName',
				type: 'input',
				validate: answer => {
					if (answer == '') {
						return 'You must input an account name.';
					}
					return true;
				}
			},
			{
				choices: ['one', 'multiple', 'all'],
				message: 'How many repositories would you like to search?',
				name: 'howManyRepos',
				type: 'list'
			},
			{
				filter: answer => {
					return answer.toLowerCase();
				},
				message: 'Please enter the name of the specific repository you want:',
				name: 'repoName',
				type: 'input',
				validate: answer => {
					if (answer == '') {
						return 'You must input a repository name.';
					}
					return true;
				},
				when: answers => {
					return answers.howManyRepos === 'one';
				}
			}
		]
	)
}

function gatherMultipleRepos() {
	function _gatherMulitpleRepos(i, sep) {
		if (!sep) {
			sep = '';
		}
		if (!i) {
			i = 0;
		}
		return inq.prompt(
			[{
				message: 'Input a repository to search:',
				name: 'repoName',
				type: 'input'
			},
			{
				message: answers => {
					return 'Current repository list: ' + chalk.yellow(repoList + sep + ' ' + answers.repoName) + '\nWould you like add another repository?';
				},
				name: 'done',
				type: 'confirm'
			}]
		).then(
			answers => {
				repoList.push(' ' + answers.repoName);
				repoArray.push({name: answers.repoName});
				if (answers.done === true) {
					_gatherMulitpleRepos(i + 1, ',');

				}
				else {
					return repoArray;
				}
			}
		);
	}

	var repoArray = [];
	var repoList = [];

	_gatherMulitpleRepos();
}

function checkForDates() {
	return inq.prompt(
		[
			{
				default: true,
				message: 'Are you searching for issues that were open during a specific year?',
				name: 'searchByDate',
				type: 'confirm'
			},
			{
				message: 'What year was the issue open during?',
				name: 'issueDate',
				type: 'input',
				validate: value => {
					var pass = value.match(/^(\d{4})$/);

					if (pass) {
						return true;
					}

					return 'Please enter a valid year (YYYY).';
				},
				when: answers => {
					return answers.searchByDate === true;
				}
			}
		]
	)
}

function callGitHub(token, account, multipleRepos, date) {
	github.authenticate({token: token.token, type: 'token'});
	if ((account.accountType === 'organization') && (account.howManyRepos === 'all')) {
		getAllOrgRepos(
			account.accountName,
			orgRepos => {
				orgRepos.forEach(
					repo => {
						getIssuesAndRenderRepo(repo, date.date);
					}
				);
			}
		);
	}
	else if ((account.accountType === 'user') && (account.howManyRepos === 'all')) {
		getAllUserRepos(
			account.accountName,
			userRepos => {
				userRepos.forEach(
					repo => {
						getIssuesAndRenderRepo(repo, date.date);
					}
				);
			}
		);
	}
	else if (account.howManyRepos === 'multiple') {
		var repo = {owner: account.accountName};

		multipleRepos.forEach(
			() => {
				getIssuesAndRenderRepo(repo, date.date);
			}
		);
	}
	else {
		var repo = {name: account.repoName, owner: account.accountName};

		getIssuesAndRenderRepo(repo, null);
	}
}

function getAllOrgRepos(org, callback) {
	function _getAllOrgRepos() {
		github.repos.getForOrg(
			{org,
			page,
			per_page: 100,
			type: 'public'},
			(err, res) => {
				res.data.forEach(
					repo => {
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
			{page,
			per_page: 100,
			type: 'owner',
			username},
			(err, res) => {
				res.data.forEach(
					repo => {
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

function getIssues(owner, repo, callback) {
	function _getIssues() {
		github.issues.getForRepo(
			{owner,
			page,
			per_page: 100,
			repo,
			state: 'all'},
			(err, res) => {
				res.data.forEach(
					issue => {
						collectedIssues.push(
							{closed: issue.closed_at,
							created: issue.created_at,
							num: issue.number}
						);
					}
				);

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
	getIssues(
		repo.owner,
		repo.name,
		issues => {
			if (date == null) {
				phantomRender(repo, issues[0], issues.slice(1));
			}
			else {
				renderIssuesByYear(
					issues,
					date,
					datedIssues => {
						phantomRender(repo, datedIssues[0], datedIssues.slice(1));
					}
				);
			}
		}
	);
}

function renderIssuesByYear(issues, date, callback) {
	function _renderIssuesByYear() {
		issues.forEach(
			issue => {
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

			await phPage.open('https://github.com/' + repo.owner + '/' + repo.name + '/issues/' + issue.num);

			await phPage.render('./rendered_PDFs/' + repo.owner + '_' + repo.name + '_' + issue.created.match(/^(\d{4})(-(\d{2}))(-(\d{2}))/gm) + '_issue' + issue.num + '.pdf');

			process.stdout.write('File created at [./rendered_PDFs/' + repo.owner + '_' + repo.name + '_' + issue.created.match(/^(\d{4})(-(\d{2}))(-(\d{2}))/gm) + '_issue' + issue.num + '.pdf]\n');

			await ph.exit();

			if (remainingIssues.length > 0) {
				phantomRender(repo, remainingIssues[0], remainingIssues.slice(1));
			}
			else {
				process.stdout.write(chalk.yellow('\nAll issues from ' + chalk.cyan('[' + repo.name + ']') + ' have finished rendering. \n\n'));

				return;
			}
		}());
	}
	else {

		process.stdout.write(chalk.yellow('\nNo issues found in ' + chalk.cyan('[' + repo.name + ']') + '. \n\n'));

		return;

	}
}

async function initiate() {
	let token;
	if (!checkForToken()) {
		token = await getToken();
	}
	else {
		token = JSON.parse(fs.readFileSync('token.json'))
	}

	const accountInfo = await gatherAccountInfo();

	if (accountInfo.howManyRepos === 'multiple') {
		const multipleRepos = await gatherMultipleRepos();
	} else {
		multipleRepos = null;
	}

	const date = await checkForDates();

	await callGitHub(token, accountInfo, multipleRepos, date)

}

initiate();

/**
function initiateGip() {
	if (!checkForToken()) {
		getToken(token => {
			gatherAccountInfo(accountInfo => {
				gatherRepoInfo(repoInfo => {
					if (repoInfo.howManyRepos === 'multiple') {
						gatherMultipleRepos(repos => {
							checkForDates(date => {
								callGitHub(
									token.token,
									accountInfo.accountType,
									accountInfo.accountName,
									repoInfo.howManyRepos,
									null,
									repos,
									date
								);
							})
						})
					} else if (repoInfo.howManyRepos === 'all') {
						checkForDates(date => {
							callGitHub(
								token.token,
								accountInfo.accountType,
								accountInfo.accountName,
								repoInfo.howManyRepos,
								null,
								null,
								date
							);
						})
					}
				})
			})
		});
	}
	else {
		callGitHub(null, JSON.parse(fs.readFileSync('token.json')).token)
	}
}
*/