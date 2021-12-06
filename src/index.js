const { SauceJsonReporter } = require('testcafe-reporter-sauce-json/reporter');
const { Reporter } = require('./reporter');
const path = require('path');

module.exports = function () {
    return {
        noColors:       true,
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
            this.setIndent(1)
                .useWordWrap(true)
                .write(this.chalk.bold('Running tests in:'))
                .newline();

            userAgents.forEach(ua => {
                this
                    .write(`- ${this.chalk.blue(ua)}`)
                    .newline();
            });

            this.newline();
        },

        async reportFixtureStart (name, specPath) {
            this.sauceTestReport.reportFixtureStart(name, specPath);
            if (this.specPath !== specPath) {
                this.specPath = specPath;
                this.relSpecPath = path.relative(process.cwd(), this.specPath);
                this.specStartConsole(this.relSpecPath);
            }

            this.fixtureName = name;

            this.fixtureStartConsole(name);
        },

        specStartConsole (relSpecPath) {
            this.setIndent(1)
                .useWordWrap(true)
                .write(relSpecPath)
                .newline();
        },

        specEndConsole (jobURL) {
            if (!jobURL) {
                return;
            }

            this.setIndent(2)
                .useWordWrap(true)
                .newline()
                .write(`Sauce Labs Report: ${jobURL}`)
                .newline();
        },

        fixtureStartConsole (name) {
            this.setIndent(2)
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

            this.setIndent(2)
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

            this.taskDoneConsole(endTime, passed, warnings);

            const sessions = this.sauceTestReport.sessions;
            for (const s of [...sessions.values()]) {
                try {
                    const url = await this.reporter.reportSession({
                        // TODO Need a reasonable name for the sauce job
                        specPath: s.userAgent,
                        startTime: s.startTime,
                        endTime: s.endTime,
                        status: s.testRun.computeStatus(),
                        browser: {
                            prettyUserAgent: s.userAgent,
                            name: s._browser.name,
                            version: s._browser.version,
                            os: {
                                name: s._platform.name,
                                version: s._platform.version,
                            },
                        },
                        assets: s.assets,
                        testRun: s.testRun,
                    });

                    this.specEndConsole(url);
                } catch (e) {
                    this.error(`Sauce Labs Report Failed: ${e.message}`);
                }
            }
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

            this.setIndent(1)
                .useWordWrap(true);

            this.newline()
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
