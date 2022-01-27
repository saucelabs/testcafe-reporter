const { SauceJsonReporter } = require('testcafe-reporter-sauce-json/reporter');
const { Reporter } = require('./reporter');
const path = require('path');

module.exports = function () {
    return {
        indentWidth: 2,
        specPath:       '',
        relSpecPath:    '',
        fixtureName:    '',
        afterErrorList: false,
        startTime:      null,
        startTimes:     new Map(),

        sauceTestReport: SauceJsonReporter.newReporter(),

        reportTaskStart (startTime, userAgents, testCount, testStructure, properties) {
            this.reporter = new Reporter(this, properties.configuration.sauce);
            this.startTime = startTime;
            this.testCount = testCount;

            this.taskStartConsole(userAgents);

            this.sauceTestReport.reportTaskStart(startTime, userAgents, testCount);
        },

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
                            const sessionId = await this.reporter.reportSession(session);
                            this.setIndent(this.indentWidth * 4)
                                .write(`* ${browserTestRun.browser}: ${this.chalk.blue.underline(this.reporter.getJobURL(sessionId))}`)
                                .newline();
                            resolve(sessionId);
                        } catch (e) {
                            reject(e);
                        }
                    })();
                });
                reportTasks.push(task);
            }
            await Promise.all(reportTasks);
            this.newline();
        },

        async reportFixtureStart (name, specPath) {
            if (this.specPath && this.specPath !== specPath) {
                // End of currently running spec
                await this.reportFixture(this.sauceTestReport.currentFixture);
            }
            this.sauceTestReport.reportFixtureStart(name, specPath);

            this.specPath = specPath;
            this.relSpecPath = path.relative(process.cwd(), this.specPath);
            this.specStartConsole(this.relSpecPath, this.sauceTestReport.fixtures.length);

            this.fixtureStartConsole(name);
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

        reportTestStart (name, meta, testStartInfo) {
            this.sauceTestReport.reportTestStart(name, meta, testStartInfo);
            this.startTimes.set(testStartInfo.testId, new Date());
        },

        async reportTestDone (name, testRunInfo) {
            this.sauceTestReport.reportTestDone(name, testRunInfo);
            this.testDoneConsole(name, testRunInfo);
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

            let title = `${symbol} ${nameStyle(name)}`;

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

        async reportTaskDone (endTime, passed, warnings) {
            this.sauceTestReport.reportTaskDone(endTime, passed, warnings);

            await this.reportFixture(this.sauceTestReport.currentFixture);

            this.taskDoneConsole(endTime, passed, warnings);
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
            this.setIndent(3)
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
                .setIndent(1)
                .write(this.chalk.bold.yellow(`Warnings (${warnings.length}):`))
                .newline();

            warnings.forEach(msg => {
                this.setIndent(1)
                    .write(this.chalk.bold.yellow('--'))
                    .newline()
                    .setIndent(2)
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
        }
    };
};
