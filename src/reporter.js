/* eslint-env node */
const { Region, TestComposer } = require('@saucelabs/testcomposer');
const { Status } = require('@saucelabs/sauce-json-reporter');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const stream = require('stream');

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
    }

    isAccountSet () {
        return this.username && this.accessKey;
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
