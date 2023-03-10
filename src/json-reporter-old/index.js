const { SauceJsonReporter } = require('./reporter');

module.exports = function() {
    return {
        noColors: true,

        reporter: SauceJsonReporter.newReporter(),

        reportTaskStart (startTime, userAgents, testCount) {
            this.reporter.reportTaskStart(startTime, userAgents, testCount);
        },

        reportFixtureStart (name, path, meta) {
            this.reporter.reportFixtureStart(name, path, meta);
        },

        reportTestStart (name, meta, testStartInfo) {
            this.reporter.reportTestStart(name, meta, testStartInfo);
        },

        reportTestDone (name, testRunInfo, meta) {
            this.reporter.reportTestDone(name, testRunInfo, meta);
        },

        reportTaskDone (endTime, passed, warnings, result) {
            this.reporter.reportTaskDone(endTime, passed, warnings, result);

            const mergedTestRun = this.reporter.mergeTestRuns();
            this.write(mergedTestRun.stringify());
        }
    };
};
