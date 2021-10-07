const { Reporter, Test } = require('./reporter');
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

        reportTaskStart (startTime, userAgents, testCount, testStructure, properties) {
            this.reporter = new Reporter(this, properties.configuration.sauce);
            this.startTime = startTime;
            this.testCount = testCount;

            this.taskStartConsole(userAgents);
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
            // Flush pending reports when we encounter a new spec.
            if (this.specPath !== specPath) {
                this.specEndConsole(await this.reporter.flush());

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
                .newline().newline();
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
            this.startTimes.set(testStartInfo.testId, new Date());
        },

        async reportTestDone (name, testRunInfo) {
            const startTime = this.startTimes.get(testRunInfo.testId);
            this.startTimes.delete(testRunInfo.testId);

            testRunInfo.browsers.forEach(browser => {
                function idMapper (val) {
                    if (val.testRunId === browser.testRunId) {
                        return val;
                    }
                }

                let errs = testRunInfo.errs.map(idMapper).map(err => this.formatError(err));
                let warnings = testRunInfo.warnings.map(idMapper);
                let screenshots = testRunInfo.screenshots.map(idMapper);
                let video = testRunInfo.videos.map(idMapper)[0]; // There's only one video per test. So pick the first.

                this.reporter.addTest(new Test(
                    name,
                    this.fixtureName,
                    browser,
                    this.relSpecPath,
                    startTime,
                    new Date(),
                    errs,
                    warnings,
                    screenshots,
                    video));
            });

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
            this.specEndConsole(await this.reporter.flush());
            this.taskDoneConsole(endTime, passed, warnings);
        },

        taskDoneConsole (endTime, passed, warnings) {
            var durationMs = endTime - this.startTime;
            var durationStr = this.moment.duration(durationMs).format('h[h] mm[m] ss[s]');
            var footer = passed === this.testCount ?
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
                var prefix = this.chalk.red(`${idx + 1}) `);

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
                    .write(this.chalk.bold.yellow(`--`))
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
