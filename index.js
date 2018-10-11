const async = require('async');
const chalk = require('chalk');
const fs = require('fs');
const GitHubApi = require('github');
const inq = require('inquirer');
const puppeteer = require('puppeteer');

const github = new GitHubApi(
	{
		headers: {'user-agent': 'GitHub-Issues-to-PDF'}
	}
);

const regexFileDate = /^(\d{4})(-(\d{2}))(-(\d{2}))/gm;
const regexIssueYear = /^(\d{4})/gm;
const regexToken = /([a-zA-Z0-9]{40})+/g;
const regexYear = /^(\d{4})$/;

function checkForToken() {
	try {
		fs.accessSync('token.json');
	}
	catch (e) {
		return false;
	}

	return true;
}

function filterIssuesByYear(issues, year, datedIssues) {
	issues.forEach(
		issue => {
			const createdOnOrBeforeDate = (issue.created.match(regexIssueYear) == year);
			const notClosedOrClosedAfterDate = ((issue.created.match(regexIssueYear) <= year) && (!issue.closed || issue.closed.match(regexIssueYear) >= year));

			if (createdOnOrBeforeDate || notClosedOrClosedAfterDate) {
				datedIssues.push(
					{
						closed: issue.closed,
						created: issue.created,
						num: issue.num,
						owner: issue.owner,
						repo: issue.repo
					}
				);
			}
		}
	);

	return datedIssues;
}

function getAllForOrg(config) {
	const collectedIssues = [];

	getAllOrgRepos(
		config,
		[],
		repos => {
			async.eachSeries(
				repos,
				(repo, callback) => {
					config.page = 1;

					getIssues(
						config,
						repo.name,
						[],
						issues => {
							if (!config.year.issueYear) {
								queueIssuesForRender(collectedIssues, callback);
							}
							else {
								const datedIssues = filterIssuesByYear(issues, config.year.issueYear, []);
								queueIssuesForRender(datedIssues, callback);
							}
						},
						(err, res) => {
							process.stdout.write(`\n${chalk.yellow('All issues have finished rendering, have a nice day!')}\n\n`);
						}
					);
				}
			);
		}
	);
}

function getAllForUser(config) {
	const collectedIssues = [];

	getAllUserRepos(
		config,
		[],
		repos => {
			async.eachSeries(
				repos,
				(repo, callback) => {
					config.page = 1;

					getIssues(
						config,
						repo.name,
						[],
						issues => {
							if (!config.year.issueYear) {
								queueIssuesForRender(collectedIssues, callback);
							}
							else {
								const datedIssues = filterIssuesByYear(issues, config.year.issueYear, []);
								queueIssuesForRender(datedIssues, callback);
							}
						},
						(err, res) => {
							return process.stdout.write(`\n${chalk.yellow('All issues have finished rendering, have a nice day!')}\n\n`);
						}
					);
				}
			);
		}
	);
}

function getAllOrgRepos(config, collectedRepos, callback) {
	github.repos.getForOrg(
		{
			org: config.accountInfo.accountName,
			page: config.page,
			per_page: 100,
			type: 'public'
		},
		(err, res) => {
			if (err) {
				process.stdout.write(`${chalk.bgRed('ERROR:')} The account ${chalk.yellow('[')}${chalk.yellow(config.accountInfo.accountName)}${chalk.yellow(']')} couldn't be found, double-check the name and try again.\n`);

				return;
			}

			res.data.forEach(
				repo => {
					collectedRepos.push(
						{
							name: repo.name,
							owner: config.accountInfo.accountName
						}
					);
				}
			);

			if (github.hasNextPage(res)) {
				config.page++;

				getAllOrgRepos(config, callback);
			}

			callback(collectedRepos);
		}
	);
}

function getAllUserRepos(config, collectedRepos, callback) {
	github.repos.getForUser(
		{
			page: config.page,
			per_page: 100,
			type: 'public',
			username: config.accountInfo.accountName
		},
		(err, res) => {
			if (err) {
				process.stdout.write(`${chalk.bgRed('ERROR:')} The account ${chalk.yellow('[')}${chalk.yellow(config.accountInfo.accountName)}${chalk.yellow(']')} couldn't be found, double-check the name and try again.\n`);

				return;
			}

			res.data.forEach(
				repo => {
					collectedRepos.push(
						{
							name: repo.name,
							owner: config.accountInfo.accountName
						}
					);
				}
			);

			if (github.hasNextPage(res)) {
				config.page++;
				getAllOrgRepos(config, callback);
			}
			config.page++;
			callback(collectedRepos);
		}
	);
}

function getIssues(config, repo, collectedIssues, callback) {
	github.issues.getForRepo(
		{
			owner: config.accountInfo.accountName,
			page: config.page,
			per_page: 100,
			repo,
			state: 'all'
		},
		(err, res) => {
			if (err) {
				process.stdout.write(`${chalk.bgRed('ERROR:')} Either the account ${chalk.yellow('[')} ${chalk.yellow(config.accountInfo.accountName)} ${chalk.yellow(']')} or the repository ${chalk.yellow('[')} ${chalk.yellow(repo)} ${chalk.yellow(']')} couldn\'t be found, double-check the names and try again.\n`);

				return;
			}

			res.data.forEach(
				issue => {
					collectedIssues.push(
						{
							closed: issue.closed_at,
							created: issue.created_at,
							num: issue.number,
							owner: config.accountInfo.accountName,
							repo
						}
					);
				}
			);

			if (github.hasNextPage(res)) {
				config.page++;
				getIssues(config, repo, collectedIssues, callback);
			}
			else {
				callback(collectedIssues);
			}
		}
	);
}

function getMultipleRepos(config) {
	async.eachSeries(
		config.multipleRepos,
		(repo, callback) => {
			config.page = 1;

			getIssues(
				config,
				repo.name,
				[],
				issues => {
					if (!config.year.issueYear) {
						queueIssuesForRender(issues, callback);
					}
					else {
						const datedIssues = filterIssuesByYear(issues, config.year.issueYear, []);
						queueIssuesForRender(datedIssues, callback);
					}
				},
				(err, res) => {
					process.stdout.write(`\n${chalk.yellow('All issues have finished rendering, have a nice day!')}\n\n`);
				}
			);
		}
	);
}

function getSingleRepo(config) {
	getIssues(
		config,
		config.accountInfo.repoName,
		[],
		issues => {
			if (!config.year.issueYear) {
				queueIssuesForRender(issues, () => {});
			}
			else {
				const datedIssues = filterIssuesByYear(issues, config.year.issueYear, []);
				queueIssuesForRender(datedIssues, () => {});
			}
		}
	);
}

function manageGitHub(config) {
	github.authenticate(
		{
			token: config.token.id,
			type: 'token'
		}
	);

	if ((config.accountInfo.accountType === 'organization') && (config.accountInfo.howManyRepos === 'all')) {
		getAllForOrg(config);
	}
	else if ((config.accountInfo.accountType === 'user') && (config.accountInfo.howManyRepos === 'all')) {
		getAllForUser(config);
	}
	else if (config.accountInfo.howManyRepos === 'multiple') {
		getMultipleRepos(config);
	}
	else {
		getSingleRepo(config);
	}
}

async function managePrompts() {
	let multipleRepos;
	let token;

	const page = 1;

	if (!checkForToken()) {
		token = await promptForToken();
	}
	else {
		token = JSON.parse(fs.readFileSync('token.json'));
	}

	const accountInfo = await promptForAccountInfo();

	if (accountInfo.howManyRepos === 'multiple') {
		multipleRepos = await promptForRepos(null, [], []);
	}

	const year = await promptForYear();

	await manageGitHub(
		{
			accountInfo,
			multipleRepos,
			page,
			token,
			year
		}
	);
}

function promptForAccountInfo() {
	return inq.prompt(
		[
			{
				choices: ['organization', 'user'],
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
	);
}

function promptForRepos(sep, repoListForPrompt, repoArray) {
	if (!sep) {
		sep = '';
	}

	return inq.prompt(
		[{

			message: 'Input a repository to search:',
			name: 'repoName',
			type: 'input'
		},
		{
			message: answers => {
				return `Current repository list: ${chalk.yellow(repoListForPrompt, sep, answers.repoName)} \n Would you like to add another repository?`;
			},
			name: 'more',
			type: 'confirm'
		}]
	).then(
		answers => {
			repoListForPrompt.push(` ${answers.repoName}`);
			repoArray.push({name: answers.repoName});
			if (answers.more === true) {
				return promptForRepos(',', repoListForPrompt, repoArray);
			}
			return repoArray;
		}
	);
}

function promptForToken() {
	return inq.prompt(
		[{message: 'Your GitHub Personal Access Token file doesn\'t exist yet, enter your token here and I\'ll save it for you:',
		name: 'id',
		type: 'input',
		validate: value => {
			const pass = value.match(regexToken);

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

function promptForYear() {
	return inq.prompt(
		[
			{
				message: 'Are you searching for issues that were open during a specific year?',
				name: 'searchByDate',
				type: 'confirm'
			},
			{
				message: 'What year were the issues open during?',
				name: 'issueYear',
				type: 'input',
				validate: value => {
					const pass = String(value).match(regexYear);

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
	);
}

function queueIssuesForRender(issues, callback) {
	async.mapLimit(
		issues,
		15,
		renderIssue,
		(err, res) => {
			if (err) {
				throw err;
			}

			if (issues[0] != undefined) {
				process.stdout.write(`\n${chalk.yellow('All issues from ')} ${chalk.cyan('[')} ${chalk.cyan(issues[0].repo)} ${chalk.cyan(']')} ${chalk.yellow(' have finished rendering.')}\n\n`);
			}

			callback();
		}
	);
}

async function renderIssue(issue) {
	if (issue != undefined) {
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		const localPath = './rendered_PDFs';

		await page.goto(`https://github.com/${issue.owner}/${issue.repo}/issues/${issue.num}`, { waitUntil: 'networkidle2' });

		if (!fs.existsSync(localPath)) {
			fs.mkdirSync(localPath);
		}

		await page.pdf({
			path: `${localPath}/${issue.owner}_${issue.repo}_${issue.created.match(regexFileDate)}_issue${issue.num}.pdf`,
			format: 'letter'
		});

		process.stdout.write(`File created at [ ${localPath}/${issue.owner}_${issue.repo}_${issue.created.match(regexFileDate)}_issue${issue.num}.pdf ]\n`);

		await browser.close();
	}
	else {

		process.stdout.write(`\n${chalk.yellow('No issues found in')} ${chalk.cyan('[')}${chalk.cyan(issue.repo)}${chalk.cyan(']')}.\n\n`);

		return;
	}
}

managePrompts();