var inq = require('inquirer');
var inqAnswers = [];
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
		name: 'allorUniqueRepos'
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
			return answers.getAllorUniqueRepos === 'a specific repository';
		}
	}
];

inq.prompt(inqPrompt).then(
	function (answers) {
		inqAnswers.push(answers);
	}
).then(initiateGip());

var accountType = inqAnswers.accountType;
var accountName = inqAnswers.accountName;
var allOrUniqueRepos = inqAnswers.allOrUniqueRepos;
var repoName = inqAnswers.repoName;

function initiateGip() {
	if ((accountType === 'organization') && (allOrUniqueRepos === 'all')) {
	console.log('ALL ORG ' + accountType + ' ' + accountName + ' ' + allOrUniqueRepos + ' ' + repoName);
	}
	else if ((accountType === 'user') && (allOrUniqueRepos === 'all')) {
		console.log('ALL USER ' + accountType + ' ' + accountName + ' ' + allOrUniqueRepos + ' ' + repoName);
	}
	else {
		var repo = { name: repoName, owner: accountName }
		console.log('SINGLE REPO ' + accountType + ' ' + accountName + ' ' + allOrUniqueRepos + ' ' + repoName);
	}
}