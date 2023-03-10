const { SauceJsonReporter } = require('./json-reporter');

module.exports = function () {
    return {
        noColors: true,

        sauceJsonReporter: SauceJsonReporter.newReporter(),

        reportTaskStart: async function(startTime, userAgents, testCount) {
            this.sauceJsonReporter.reportTaskStart(startTime, userAgents, testCount);
        },

        reportFixtureStart: async function(name, path, meta) {
            this.sauceJsonReporter.reportFixtureStart(name, path, meta);
        },

        reportTestStart: async function(name, meta) {
            this.sauceJsonReporter.reportTestStart(name, meta);
        },

        reportTestDone: async function(name, testRunInfo, meta) {
            this.sauceJsonReporter.reportTestDone(name, testRunInfo, meta);
        },

        reportTaskDone: async function(endTime, passed, warnings, result) {
            this.sauceJsonReporter.reportTaskDone(endTime, passed, warnings, result);
        }
    };
};