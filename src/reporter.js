const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const { v4: uuidv4 } = require('uuid');
const { Status, Test } = require('@saucelabs/sauce-json-reporter');
const { Region, TestComposer } = require('@saucelabs/testcomposer');

const { TestRuns: TestRunsAPI } = require('./api');
const { CI } = require('./ci');

class Reporter {
    constructor (logger = console, opts = {}) {
        this.log = logger;

        let reporterVersion = 'unknown';
        try {
            const packageData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
            reporterVersion = packageData.version;
        } catch (e) {
        }

        this.username = opts.username || process.env.SAUCE_USERNAME;
        this.accessKey = opts.accessKey || process.env.SAUCE_ACCESS_KEY;
        this.build = opts.build || randomBuildID();
        this.tags = opts.tags;
        this.region = opts.region || 'us-west-1';

        this.testComposer = new TestComposer({
            region: opts.region || Region.USWest1,
            username: this.username,
            accessKey: this.accessKey,
            headers: {'User-Agent': `cypress-reporter/${reporterVersion}`}
        });

        this.testRunsAPI = new TestRunsAPI({
            region: opts.region || Region.USWest1,
            username: this.username,
            accessKey: this.accessKey,
        });
    }

    isAccountSet () {
        return this.username && this.accessKey;
    }

    /**
     * Reports a fixture from testcafe-reporter-sauce-json/reporter to the test-runs api.
     * @param {?} fixture
     * @param {string} jobId
     */
    async reportTestRun (fixture, browserTestRun, jobId) {
        const baseRun = {
            start_time: fixture.startTime.toISOString(),
            end_time: (fixture.endTime && fixture.endTime.toISOString()) || new Date().toISOString(),
            path_name: fixture.path,
            platform: 'other',
            type: 'web',
            framework: 'testcafe',
            sauce_job: {
                id: jobId,
            },
            tags: this.tags || [],
            build_name: this.build,
            ci: {
                ref_name: CI.refName,
                branch: CI.refName,
                repository: CI.repo,
                commit_sha: CI.sha,
            },
        };
        const testRun = browserTestRun.testRun;
        // NOTE: TestRuns for TestCafe will have a single root suite that represents
        // the spec. Since the spec path is a separate field in the Insights TestRun,
        // we can ignore it when flattening the tests.
        const tests = this.flattenTests(testRun.suites[0].suites);
        const reqs = tests.map((test) => {
            const req = {
                ...baseRun,
                id: uuidv4(),
                name: test.name,
                duration: test.duration,
                browser: browserTestRun.browser,
                os: browserTestRun.platform,
                status: test.status,
            };
            if (test.status === Status.Failed) {
                req.errors = [
                    {
                        message: test.output,
                        path: fixture.path,
                    },
                ];
            }
            return req;
        });
        await this.testRunsAPI.create(reqs);
    }

    /**
     * Recurses through suites and returns a flattened list of tests.
     * @param {Suite[]} suites
     * @param {string[]} names
     * @returns {Test[]}
     */
    flattenTests (suites, names = []) {
        let tests = [];
        suites.forEach((suite) => {
            tests = tests.concat(this.flattenTests(suite.suites, [...names, suite.name]));

            suite.tests.forEach((test) => {
                tests.push(new Test(
                    [...names, suite.name, test.name].join(' - '),
                    test.status,
                    test.duration,
                    test.output,
                    test.startTime,
                    test.attachments,
                    test.metadata,
                    test.code,
                    test.videoTimestamp,
                ));
            });
        });
        return tests;
    }


    async reportSession (session) {
        if (!this.isAccountSet()) {
            return;
        }

        const job = await this.testComposer.createReport({
            name:             session.name,
            startTime:        session.startTime.toISOString(),
            endTime:          session.endTime.toISOString(),
            framework:        'testcafe',
            frameworkVersion: '0.0.0', // TODO https://github.com/DevExpress/testcafe/issues/6591
            passed:           session.testRun.computeStatus() === Status.Passed,
            build:            this.build,
            tags:             this.tags,
            browserName:      session.browserName,
            browserVersion:   session.browserVersion,
            platformName:     session.platformName,
        });

        const assets = session.assets.map((a) => {
            return {
                filename: a.name,
                data: fs.createReadStream(a.localPath)
            };
        });

        const reportReadable = new stream.Readable();
        reportReadable.push(session.testRun.stringify());
        reportReadable.push(null);
        assets.push({
            filename: 'sauce-test-report.json',
            data: reportReadable,
        });

        assets.push(this.createConsoleLog(session.testRun, session.userAgent));

        await this.testComposer.uploadAssets(job.id, assets).then(
            (resp) => {
                if (resp.errors) {
                    for (const err of resp.errors) {
                        console.error('Failed to upload asset:', err);
                    }
                }
            },
            (e) => console.error('Failed to upload assets:', e.message)
        );

        return job;
    }

    logSuite (suite, depth = 0) {
        const indent = '    '.repeat(depth);
        const resultIcon = suite.status === Status.Passed ? '✓' : '✖';
        let log = `${indent}${resultIcon} ${suite.name}\n`;
        for (const t of suite.tests) {
            log += this.logTest(t, depth + 1);
        }

        for (const s of suite.suites) {
            log += this.logSuite(s, depth + 1);
        }

        return log;
    }

    logTest (test, depth = 0) {
        const indent = '    '.repeat(depth);
        const resultIcon = test.status === Status.Passed ? '✓' : '✖';
        const name = test.name;
        const duration = test.duration;

        let error = '';
        if (test.status !== Status.Passed && test.output !== '') {
            error = `\n\n${indent}\n${test.output}\n\n`;
        }

        return `${indent}${resultIcon} ${name} (${duration}ms)${error}\n`;
    }

    createConsoleLog (testRun, userAgent) {
        let log = `Running tests in: ${userAgent}\n\n\n`;

        log += 'Results:\n\n';
        for (const s of testRun.suites) {
            log += this.logSuite(s, 1);
            log += '\n';
        }

        const r = new stream.Readable();
        r.push(log);
        r.push(null);

        return {
            filename: 'console.log',
            data:     r
        };
    }
}

function randomBuildID () {
    return crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
}

module.exports = { Reporter };
