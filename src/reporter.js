const SauceLabs = require('saucelabs').default;
const { Status } = require('@saucelabs/sauce-json-reporter');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
        const tld = this.region === 'staging' ? 'net' : 'com';

        this.api = new SauceLabs({
            user:    this.username,
            key:     this.accessKey,
            region:  this.region,
            tld:     tld,
            headers: { 'User-Agent': `testcafe-reporter/${reporterVersion}` }
        });

        this.session = null;
    }

    isAccountSet () {
        return this.username && this.accessKey;
    }

    async reportSession (session) {
        if (!this.isAccountSet()) {
            return;
        }

        const body = {
            name:             session.name,
            user:             process.env.SAUCE_USERNAME,
            startTime:        session.startTime.toISOString(),
            endTime:          session.endTime.toISOString(),
            framework:        'testcafe',
            frameworkVersion: '0.0.0', // TODO https://github.com/DevExpress/testcafe/issues/6591
            status:           'complete',
            passed:           session.testRun.computeStatus() === Status.Passed,
            build:            this.build,
            tags:             this.tags,
            browserName:      session.browserName,
            browserVersion:   session.browserVersion,
            platformName:     session.platformName,
        };

        const sessionId = await this.createJob(body);

        const assets = session.assets.map((a) => {
            return {
                filename: a.name,
                data: a.localPath
            };
        });
        assets.push({
            filename: 'sauce-test-report.json',
            data: session.testRun,
        });
        assets.push(this.createConsoleLog(session.testRun, session.userAgent));

        await this.uploadAssets(sessionId, assets);

        return this.getJobURL(sessionId);
    }

    async createJob (body) {
        return await this.api.createJob(body).then(
            (resp) => resp.ID
        );
    }

    async uploadAssets (sessionId, assets) {
        await this.api.uploadJobAssets(sessionId, { files: assets }).then(
            (resp) => {
                if (resp.errors) {
                    for (let err of resp.errors) {
                        this.log.error(err);
                    }
                }
            },
            (e) => this.log.error(`Upload failed: ${e.message}`)
        );
    }

    logSuite (suite, depth = 0) {
        const indent = ' '.repeat(depth * 4);
        const result = suite.status === Status.Passed ? '✓' : '✖';
        let log = `${indent}${result} ${suite.name}\n`;
        for (const t of suite.tests) {
            log += this.logTest(t, depth + 1);
        }

        for (const s of suite.suites) {
            log += this.logSuite(s, depth + 1);
        }

        return log;
    }

    logTest(test, depth = 0) {
        const indent = ' '.repeat(depth * 4);
        const result = test.status === Status.Passed ? '✓' : '✖';
        const name = test.name;
        const duration = test.duration;

        let error = '';
        if (test.status !== Status.Passed && test.output !== '') {
            error = `\n\n${indent}\n${test.output}\n\n`;
        }

        return `${indent}${result} ${name} (${duration}ms)${error}\n`;
    }

    createConsoleLog (testRun, userAgent) {
        let log = `Running tests in: ${userAgent}\n\n\n`;

        log += 'Results:\n\n';
        for (const s of testRun.suites) {
            log += this.logSuite(s, 1);
            log += '\n';
        }

        return {
            filename: 'console.log',
            data:     log
        };
    }

    getJobURL (sessionId) {
        const domainMapping = {
            'us-west-1':    'app.saucelabs.com',
            'eu-central-1': 'app.eu-central-1.saucelabs.com',
            'staging':      'app.staging.saucelabs.net'
        };

        return `https://${domainMapping[this.region]}/tests/${sessionId}`;
    }
}

function randomBuildID () {
    return crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
}

module.exports = { Reporter };
