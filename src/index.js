const { SauceJsonReporter } = require('./json-reporter');
const { SauceJobReporter } = require('./job-reporter');

module.exports = function () {
    return {
        noColors: true,

        sauceJsonReporter: SauceJsonReporter.newReporter(),
        sauceJobReporter: SauceJobReporter.newReporter(),

        // TestCafe Hooks
        reportTaskStart: async function(startTime, userAgents, testCount, testStructure, properties) {            
            this.sauceJsonReporter.reportTaskStart(startTime, userAgents, testCount);
            this.sauceJobReporter.reportTaskStart(startTime, userAgents, testCount, testStructure, properties);
        },

        reportFixtureStart: async function(name, path, meta) {
            this.sauceJsonReporter.reportFixtureStart(name, path, meta);
            this.sauceJobReporter.reportFixtureStart(name, path, meta);
        },

        reportTestStart: async function(name, meta, testStartInfo) {
            this.sauceJsonReporter.reportTestStart(name, meta, testStartInfo);
            this.sauceJobReporter.reportTestStart(name, meta, testStartInfo);
        },

        reportTestDone: async function(name, testRunInfo, meta) {
            this.sauceJsonReporter.reportTestDone(name, testRunInfo, meta);
            this.sauceJobReporter.reportTestDone(name, testRunInfo, meta);
        },

        reportTaskDone: async function(endTime, passed, warnings, result) {
            this.sauceJsonReporter.reportTaskDone(endTime, passed, warnings, result);
            const mergedTestRun = this.sauceJsonReporter.mergeTestRuns();
            this.write(mergedTestRun.stringify());

            this.sauceJobReporter.reportTaskDone(endTime, passed, warnings, result);
        }
    };
};