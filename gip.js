"use strict";
var page = require('webpage').create(),
	config = require('./gip-config.js'),
	url = config.url(),
	output = config.output();

page.viewportSize = { width: 600, height: 600 };

page.paperSize = {
	format: 'letter',
	orientation: 'portrait',
	margin: '1cm'
};

page.open(url,
	function (status) {
		if (status !== 'success') {
			console.log('Unable to load the URL!');

			phantom.exit(1);

		} else {
			window.setTimeout(
				function () {
					page.render(output);
					console.log('Render complete!');

					phantom.exit();

				},
				200
			);
		}
	}
);