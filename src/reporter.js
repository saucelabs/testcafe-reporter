const SauceLabs = require('saucelabs').default;
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class Session {

    constructor (browser, specPath, tests = []) {
        this.browser = browser;
        this.specPath = specPath;
        this.tests = tests;

        this.passed = true;
        this.startTime = null;
        this.endTime = null;
    }

    addTest (test) {
        this.passed = this.passed && !test.errs.length;

        if (!this.startTime || test.startTime < this.startTime) {
            this.startTime = test.startTime;
        }

        if (!this.endTime || test.endTime > this.endTime) {
            this.endTime = test.endTime;
        }

        this.tests.push(test);
    }
}

class Test {
    constructor (name, fixtureName, browser, specPath = '', startTime = new Date(),
        endTime = new Date(), errs = [], warnings = [], screenshots = [], video) {
        this.name = name;
        this.fixtureName = fixtureName;
        this.browser = browser;
        this.specPath = specPath;
        this.startTime = startTime;
        this.endTime = endTime;
        this.errs = errs;
        this.warnings = warnings;
        this.screenshots = screenshots;
        this.video = video;
    }
}

class Reporter {
    constructor (logger = console, opts = {}) {
        this.log = logger;

        let reporterVersion = 'unknown';
        try {
            const packageData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
            reporterVersion = packageData.version;
        } catch (e) {
        }

        this.build = opts.build || randomBuildID();
        this.tags = opts.tags;
        this.region = opts.region || 'us-west-1';
        const tld = this.region === 'staging' ? 'net' : 'com';

        this.api = new SauceLabs({
            user:    process.env.SAUCE_USERNAME,
            key:     process.env.SAUCE_ACCESS_KEY,
            region:  this.region,
            tld:     tld,
            headers: { 'User-Agent': `testcafe-reporter/${reporterVersion}` }
        });

        this.session = null;
    }

    addTest (test) {
        if (!this.session) {
            this.session = new Session(test.browser, test.specPath);
        }

        this.session.addTest(test);
    }

    async flush () {
        if (!this.session) {
            return;
        }

        try {
            return await this.reportSession(this.session);
        } catch (e) {
            this.log.error(`Sauce Labs Report Failed: ${e.message}`);
        } finally {
            this.session = null;
        }
    }

    isAccountSet () {
        return process.env.SAUCE_USERNAME && process.env.SAUCE_ACCESS_KEY;
    }

    async reportSession (session) {
        if (!this.isAccountSet()) {
            return;
        }

        const body = {
            name:             session.specPath,
            user:             process.env.SAUCE_USERNAME,
            startTime:        session.startTime.toISOString(),
            endTime:          session.endTime.toISOString(),
            framework:        'testcafe',
            frameworkVersion: '0.0.0', // TODO https://github.com/DevExpress/testcafe/issues/6591
            status:           'complete',
            suite:            session.specPath,
            passed:           session.passed,
            build:            this.build,
            tags:             this.tags,
            browserName:      session.browser.name,
            browserVersion:   session.browser.version,
            platformName:     `${session.browser.os.name} ${session.browser.os.version}`,
        };

        const sessionId = await this.createJob(body);

        let assets = [
            this.createConsoleLog(session),
            ...this.getVideos(session.tests),
            ...this.getScreenshots(session.tests)];

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

    createConsoleLog (session) {
        let log = `Running tests in: ${session.browser.prettyUserAgent}\n\n\n`;

        log += 'Results:\n';
        for (let test of session.tests) {
            const errors = test.errs;
            const warnings = test.warnings;
            const hasErrors = !!errors.length;
            const hasWarnings = !!warnings.length;
            const result = hasErrors ? '✖' : '✓';

            log += `  ${result} ${test.fixtureName} - ${test.name}\n`;

            if (hasErrors) {
                log += '\n    Errors:\n';

                errors.forEach(error => {
                    const errLines = error.split('\n');
                    for (let err of errLines) {
                        log += `        ${err}\n`;
                    }
                });
            }

            if (hasWarnings) {
                log += '\n    Warnings:\n';

                warnings.forEach(warning => {
                    const warLines = warning.split('\n');
                    for (let war of warLines) {
                        log += `        ${war}\n`;
                    }
                });
            }

            if (hasErrors || hasWarnings) {
                log += '\n';
            }
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

    getVideos (tests) {
        return tests
            .filter(test => test.video)
            .map(test => {
                return {
                    filename: `${test.name}.mp4`,
                    data:     this.maybeReadFile(test.video.videoPath)
                };
            })
            .filter(artifact => artifact.data);
    }

    getScreenshots (tests) {
        return tests.flatMap(test => {
            return test.screenshots.map(screenshot => {
                // There can be multiple screenshots per test. Using a suffix to avoid collisions.
                const suffix = path.basename(screenshot.screenshotPath);
                return {
                    filename: `${test.name} - ${suffix}`,
                    data:     this.maybeReadFile(screenshot.screenshotPath)
                };
            })
                .filter(artifact => artifact.data);
        });
    }

    maybeReadFile (filepath) {
        try {
            return fs.readFileSync(filepath);
        } catch (e) {
            this.log.log(`Failed to read contents of ${filepath}:`, e.message);
        }
    }
}

function randomBuildID () {
    return crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
}

module.exports = { Reporter, Test };
