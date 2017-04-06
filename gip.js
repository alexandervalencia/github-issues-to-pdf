"use strict";
var page = require('webpage').create(),
	config = require('./gip-config.js'),
	address = config.address(),
	output = config.output(),
	pageHeight,
	pageWidth,
	size = config.size();

page.viewportSize = { width: 600, height: 600 };

size = config.size();

page.paperSize = {
	format: 'letter',
	orientation: 'portrait',
	margin: '1cm'
};

page.open(address,
	function (status) {
		if (status !== 'success') {
			console.log('Unable to load the address!');

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