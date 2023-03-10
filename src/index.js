const path = require('path');
const fs = require('fs');
const { SauceJsonReporter } = require('./json-reporter');
const { JobReporter } = require('./job-reporter');

module.exports = function () {
    return {
        noColors: true,
        sauceJsonReporter: SauceJsonReporter.newReporter(),

        sauceReportJsonPath: process.env.SAUCELABS_REPORT_JSON_PATH || './sauce-test-report.json',
        disableSauceUpload: process.env.SAUCELABS_DISABLE_SAUCE_UPLOAD !== undefined,

        // JobReporter
        indentWidth:    2,
        specPath:       '',
        relSpecPath:    '',
        fixtureName:    '',
        afterErrorList: false,
        startTime:      null,
        startTimes:     new Map(),

        // TestCafe Hooks
        reportTaskStart: async function(startTime, userAgents, testCount, testStructure, properties) {            
            this.sauceJsonReporter.reportTaskStart(startTime, userAgents, testCount);

            if (this.disableSauceUpload) {
                return;
            }

            this.reporter = new JobReporter(this, properties.configuration.sauce);
            this.startTime = startTime;
            this.testCount = testCount;
            this.taskStartConsole(userAgents);
        },

        reportFixtureStart: async function(name, specPath, meta) {
            this.sauceJsonReporter.reportFixtureStart(name, specPath, meta);

            if (this.disableSauceUpload) {
                return;
            }

            if (this.specPath && this.specPath !== specPath) {
                // End of currently running spec
                const completedFixture = this.sauceJsonReporter.fixtures.find((f) => f.path === path.relative(process.cwd(), this.specPath));
                await this.reportFixture(completedFixture);
            }

            this.specPath = specPath;
            this.relSpecPath = path.relative(process.cwd(), this.specPath);
            this.specStartConsole(this.relSpecPath, this.sauceJsonReporter.fixtures.length);

            this.fixtureStartConsole(name);
        },

        reportTestStart: async function(name, meta, testStartInfo) {
            this.sauceJsonReporter.reportTestStart(name, meta, testStartInfo);

            if (this.disableSauceUpload) {
                return;
            }

            this.startTimes.set(testStartInfo.testId, new Date());
        },

        reportTestDone: async function(name, testRunInfo, meta) {
            this.sauceJsonReporter.reportTestDone(name, testRunInfo, meta);

            if (this.disableSauceUpload) {
                return;
            }

            this.testDoneConsole(name, testRunInfo);
        },

        reportTaskDone: async function(endTime, passed, warnings, result) {
            this.sauceJsonReporter.reportTaskDone(endTime, passed, warnings, result);
            const mergedTestRun = this.sauceJsonReporter.mergeTestRuns();

            fs.writeFileSync(this.sauceReportJsonPath, mergedTestRun.stringify());

            if (this.disableSauceUpload) {
                return;
            }

            await this.reportFixture(this.sauceJsonReporter.currentFixture);

            this.taskDoneConsole(endTime, passed, warnings);
        },

        // Extraneous funcs - Used by JobReporter
        taskStartConsole (userAgents) {
            this.newline()
                .useWordWrap(true)
                .write(this.chalk.bold('Running tests in:'))
                .newline();

            userAgents.forEach(ua => {
                this.setIndent(this.indentWidth)
                    .write(`- ${this.chalk.cyan(ua)}`)
                    .newline();
            });

            this.newline();
        },

        async reportFixture(fixture) {
            this.setIndent(this.indentWidth * 3)
                .newline()
                .write(this.chalk.bold.underline('Sauce Labs Test Report'))
                .newline();

            const reportTasks = [];
            for (const [userAgent, browserTestRun] of fixture.browserTestRuns) {
                const task = new Promise((resolve, reject) => {
                    (async () => {
                        const session = {
                            name: fixture.path,
                            startTime: fixture.startTime,
                            endTime: new Date(),
                            testRun: browserTestRun.testRun,
                            browserName: browserTestRun.browserName,
                            browserVersion: browserTestRun.browserVersion,
                            platformName: browserTestRun.platform,
                            assets: browserTestRun.assets,
                            userAgent: userAgent,
                        };
                        try {
                            const job = await this.reporter.reportSession(session);
                            this.setIndent(this.indentWidth * 4)
                                .write(`* ${browserTestRun.browser}: ${this.chalk.blue.underline(job.url)}`)
                                .newline();

                            await this.reporter.reportTestRun(fixture, browserTestRun, job.id);
                            resolve(job.id);
                        } catch (e) {
                            reject(e);
                        }
                    })();
                });
                reportTasks.push(task);
            }
            await Promise.allSettled(reportTasks);
            this.newline();
        },

        specStartConsole (relSpecPath, index) {
            this.newline()
                .setIndent(this.indentWidth * 2)
                .useWordWrap(true)
                .write(`${index}) ${this.chalk.underline(relSpecPath)}`)
                .newline();
        },

        fixtureStartConsole (name) {
            this.setIndent(this.indentWidth * 3)
                .useWordWrap(true);

            if (this.afterErrorList) {
                this.afterErrorList = false;
            }
            else {
                this.newline();
            }

            this.write(name)
                .newline();
        },

        testDoneConsole (name, testRunInfo) {
            const hasErr = !!testRunInfo.errs.length;
            let symbol = null;
            let nameStyle = null;

            if (testRunInfo.skipped) {
                this.skipped++;

                symbol = this.chalk.cyan('-');
                nameStyle = this.chalk.cyan;
            }

            else if (hasErr) {
                symbol = this.chalk.red.bold(this.symbols.err);
                nameStyle = this.chalk.red.bold;
            }

            else {
                symbol = this.chalk.green(this.symbols.ok);
                nameStyle = this.chalk.grey;
            }
            const styledName = nameStyle(`${name} (${testRunInfo.durationMs}ms)`);
            let title = `${symbol} ${styledName}`;

            this.setIndent(this.indentWidth * 4)
                .useWordWrap(true);

            if (testRunInfo.unstable) {
                title += this.chalk.yellow(' (unstable)');
            }

            if (testRunInfo.screenshotPath) {
                title += ` (screenshots: ${this.chalk.underline.grey(testRunInfo.screenshotPath)})`;
            }

            this.write(title);

            if (hasErr) {
                this._renderErrors(testRunInfo.errs);
            }

            this.afterErrorList = hasErr;

            this.newline();
        },

        taskDoneConsole (endTime, passed, warnings) {
            const durationMs = endTime - this.startTime;
            const durationStr = this.moment.duration(durationMs).format('h[h] mm[m] ss[s]');
            let footer = passed === this.testCount ?
                this.chalk.bold.green(`${this.testCount} passed`) :
                this.chalk.bold.red(`${this.testCount - passed}/${this.testCount} failed`);

            footer += this.chalk.grey(` (${durationStr})`);

            if (!this.afterErrorList) {
                this.newline();
            }

            this.setIndent(this.indentWidth)
                .useWordWrap(true)
                .write(footer)
                .newline();

            if (this.skipped > 0) {
                this.write(this.chalk.cyan(`${this.skipped} skipped`))
                    .newline();
            }

            if (warnings.length) {
                this._renderWarnings(warnings);
            }
        },

        _renderErrors (errs) {
            this.setIndent(this.indentWidth * 4)
                .newline();

            errs.forEach((err, idx) => {
                const prefix = this.chalk.red(`${idx + 1}) `);

                this.newline()
                    .write(this.formatError(err, prefix))
                    .newline()
                    .newline();
            });
        },

        _renderWarnings (warnings) {
            this.newline()
                .setIndent(this.indentWidth * 4)
                .write(this.chalk.bold.yellow(`Warnings (${warnings.length}):`))
                .newline();

            warnings.forEach(msg => {
                this.setIndent(this.indentWidth * 4)
                    .write(this.chalk.bold.yellow('--'))
                    .newline()
                    .setIndent(this.indentWidth * 5)
                    .write(msg)
                    .newline();
            });
        },

        log (msg) {
            this.write(msg).newline();
        },

        error (msg) {
            this.newline()
                .write(this.chalk.red(msg))
                .newline();
        },
    };
};