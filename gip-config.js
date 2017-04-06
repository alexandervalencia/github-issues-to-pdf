var user = "liferay",
	repo = "alloy-editor",
	issueN = 644,
	issueDate = Date.now(); // Placeholder for when actual JSON file contains issue date

exports.url = function() {
	return "https://github.com/" + user + "/" + repo + "/issues/" + issueN;
}
exports.output = function() {
	return user + "_" + repo + "_" + issueDate + "_issue" + issueN +".pdf";
}