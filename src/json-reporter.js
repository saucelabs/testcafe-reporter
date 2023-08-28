const Stream = require('stream');
const buildReporterPlugin = require('testcafe').embeddingUtils.buildReporterPlugin;
const { TestRun, Status, Test, TestCode } = require('@saucelabs/sauce-json-reporter');
const { renderers } = require('@devexpress/callsite-record');
const path = require('path');
const process = require('process');

const { Fixture } = require('./fixture');

function reporterFactory () {
    return {
        // Plugin configuration to ensure reporter helper functions
        // don't emit ansi color codes.
        noColors: true,

        /**
         * A list of all executed test fixtures
         * @type Array<Fixture>
         */
        fixtures: [],
        /**
         * The currently executing test fixture
         * @type Fixture | null
         */
        currentFixture: null,
        /**
         * The start time of the entire test run
         * @type Date | null
         */
        startTime: null,
        /**
         * The end time of the entire test run
         * @type Date | null
         */
        endTime: null,
        /**
         * A map of testIds to their startTimes
         * @type Map<string, Date>
         */
        startTimes: new Map(),
        /**
         * The start time of a video recording started externally. We use this value to offset a
         * test's start time to its location in the video.
         * @type number | null
         */
        videoStartTime: null,

        /**
         * @param {Date} startTime
         * @param {Array<string>} userAgents
         * @param {number} testCount
         */
        // eslint-disable-next-line no-unused-vars
        reportTaskStart (startTime, userAgents, testCount) {
            this.startTime = startTime;

            if (process.env.SAUCE_VIDEO_START_TIME) {
                this.videoStartTime = new Date(process.env.SAUCE_VIDEO_START_TIME).getTime();
            }
        },

        reportFixtureStart (fixtureName, fixturePath, fixtureMetadata) {
            // Fixtures run serially, even if concurrency is greater than 1
            // Concurrency in testcafe defines the number of browser instances tests are run against.
            // Regardless of this, fixtures themselves are serial even if its tests are being run in parallel.
            if (this.currentFixture) {
                this.currentFixture.endTime = new Date();
            }

            const relPath = path.relative(process.cwd(), fixturePath);
            this.currentFixture = new Fixture(fixtureName, relPath, fixtureMetadata);
            this.currentFixture.startTime = new Date();
            this.fixtures.push(this.currentFixture);
        },

        reportTestStart (name, meta, testStartInfo) {
            this.startTimes.set(testStartInfo.testId, testStartInfo.startTime);
        },

        reportTestDone (testName, testRunInfo, meta) {
            testRunInfo.browsers.forEach(browser => {
                function idFilter (val) {
                    return val.testRunId === browser.testRunId;
                }

                const errs = testRunInfo.errs.filter(idFilter).map(err => this.formatError(err));
                const codes = testRunInfo.errs.filter(idFilter).map(err => this.formatErrorCallsite(err));
                const screenshotAssets = testRunInfo.screenshots.filter(idFilter).map(s => this._getAsset(s.screenshotPath, testName));
                const videoAssets = testRunInfo.videos.filter(idFilter).map(v => this._getAsset(v.videoPath, testName));
                const testStartTime = this.startTimes.get(testRunInfo.testId);

                const test = new Test(testName);
                test.status = this.getTestStatus(errs, testRunInfo.skipped);
                test.duration = testRunInfo.durationMs;
                test.metadata = meta;
                test.output = this.mergeErrors(errs);
                test.startTime = testStartTime;
                if (this.videoStartTime) {
                    test.videoTimestamp = (testStartTime.getTime() - this.videoStartTime) / 1000;
                }

                if (codes.length > 0) {
                    test.code = new TestCode(codes[0].split('\n'));
                }

                this.currentFixture.addTestWithAssets(browser.prettyUserAgent, test, screenshotAssets, videoAssets);
            });
        },

        mergeErrors (errs) {
            if (!Array.isArray(errs)) {
                return '';
            }
            let concatenatedErrors = '';
            errs.forEach(err => {
                concatenatedErrors += `${err}\n`;
            });
            return concatenatedErrors;
        },

        // eslint-disable-next-line no-unused-vars
        reportTaskDone (endTime, passed, warnings, result) {
            this.endTime = endTime;
        },

        /**
     * @param {Array<object>} errs
     * @param {boolean} didSkip
     */
        getTestStatus (errs, didSkip) {
            if (didSkip) {
                return Status.Skipped;
            }
            if (errs.length === 0) {
                return Status.Passed;
            }

            return Status.Failed;
        },

        collectTestRuns() {
            const testRuns = this.fixtures.flatMap((f) => {
                return f.collectTestRuns();
            });

            return testRuns;
        },

        mergeTestRuns() {
            const mergedTestRun = new TestRun();
            const testRuns = this.collectTestRuns();

            return testRuns.reduce((collection, curr) => {
                for (const s of curr.suites) {
                    s.metadata = curr.metadata;
                    collection.addSuite(s);
                }

                return collection;
            }, mergedTestRun);
        },

        /**
         * @param {string} assetPath
         * @param {string} testName
         */
        // eslint-disable-next-line no-unused-vars
        _getAsset(assetPath, testName) {
            return {
                name: path.basename(assetPath),
                localPath: assetPath,
            };
        },

        formatErrorCallsite(err) {
            if (err && err.callsite) {
                return err.callsite.renderSync({ renderer: renderers.noColor });
            }
            return '';
        }
    };
}

module.exports.SauceJsonReporter = {
    newReporter: function() {
    // A writable sink to make sure the reporter has a stream to write to
        const nullStream = new Stream.Writable();
        nullStream._write = () => {};

        // Build the reporter plugin how it would be built at runtime.
        // This gives the reporter access to all helper functions and behaves
        // exactly like any other reporter plugin.
        return buildReporterPlugin(reporterFactory, nullStream);
    }
};
