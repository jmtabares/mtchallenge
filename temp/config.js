"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var HtmlReporter = require('protractor-beautiful-reporter');
exports.config = {
    directConnect: true,
    capabilities: {
        browserName: 'chrome',
        chromeOptions: {
            args: ["--headless", "--disable-gpu", "--window-size=1600,700"]
        }
    },
    specs: [
        "spec/**/*.spec.js"
    ],
    onPrepare: function () {
        // Add a screenshot reporter and store screenshots to `/Reports/screenshots`:
        jasmine.getEnv().addReporter(new HtmlReporter({
            baseDirectory: 'Reports/screenshots'
        }).getJasmine2Reporter());
    },
};
