import { TestRun } from '@saucelabs/sauce-json-reporter';

const path = require('path');
const fs = require('fs');

const { SauceJsonReporter } = require('./json-reporter');
const { JobReporter } = require('./job-reporter');

/**
 * @typedef {import("./fixture").Fixture} Fixture
 */

module.exports = function () {
  return {
    noColors: !!process.env.SAUCE_NO_COLORS || !!process.env.SAUCE_VM,
    sauceJsonReporter: SauceJsonReporter.newReporter(),

    sauceReportJsonPath:
      process.env.SAUCE_REPORT_JSON_PATH || './sauce-test-report.json',
    disableUpload: process.env.SAUCE_DISABLE_UPLOAD !== undefined,

    // JobReporter
    indentWidth: 2,
    specPath: '',
    relSpecPath: '',
    afterErrorList: false,
    startTime: null,
    startTimes: new Map(),

    // TestCafe Hooks
    reportTaskStart: async function (
      startTime,
      userAgents,
      testCount,
      testStructure,
      properties,
    ) {
      this.sauceJsonReporter.reportTaskStart(startTime, userAgents, testCount);

      if (this.disableUpload) {
        return;
      }

      this.reporter = new JobReporter(this, properties.configuration.sauce);
      this.startTime = startTime;
      this.testCount = testCount;
      this.taskStartConsole(startTime, userAgents, testCount);
    },

    reportFixtureStart: async function (name, specPath, meta) {
      this.sauceJsonReporter.reportFixtureStart(name, specPath, meta);

      if (this.disableUpload) {
        return;
      }

      if (this.specPath && this.specPath !== specPath) {
        // End of currently running spec
        const completedFixture = this.sauceJsonReporter.fixtures.find(
          (f) => f.path === path.relative(process.cwd(), this.specPath),
        );
        await this.reportFixture(completedFixture);
      }

      this.specPath = specPath;
      this.relSpecPath = path.relative(process.cwd(), this.specPath);
      this.specStartConsole(
        this.relSpecPath,
        this.sauceJsonReporter.fixtures.length,
      );

      this.fixtureStartConsole(name, specPath, meta);
    },

    reportTestStart: async function (name, meta, testStartInfo) {
      this.sauceJsonReporter.reportTestStart(name, meta, testStartInfo);

      if (this.disableUpload) {
        return;
      }

      this.startTimes.set(testStartInfo.testId, new Date());
    },

    reportTestDone: async function (name, testRunInfo, meta) {
      this.sauceJsonReporter.reportTestDone(name, testRunInfo, meta);

      if (this.disableUpload) {
        return;
      }

      this.testDoneConsole(name, testRunInfo, meta);
    },

    reportTaskDone: async function (endTime, passed, warnings, result) {
      this.sauceJsonReporter.reportTaskDone(endTime, passed, warnings, result);
      const mergedTestRun = this.sauceJsonReporter.mergeTestRuns();

      fs.writeFileSync(this.sauceReportJsonPath, mergedTestRun.stringify());

      const remoteTestRuns = this.sauceJsonReporter.remoteTestRuns();
      const tasks = [];
      for (const [jobId, runs] of remoteTestRuns) {
        const p = async () => {
          const merged = new TestRun();

          // The user agent is the same for all runs of a given job.
          merged.metadata['userAgent'] = runs.find(
            (run) => run.metadata['userAgent'],
          )?.metadata['userAgent'];

          runs.forEach((run) => {
            for (const suite of run.suites) {
              suite.metadata = run.metadata;
              merged.addSuite(suite);
            }
          });
          merged.computeStatus();

          await this.reporter.attachTestRun(jobId, merged);
        };
        tasks.push(p());
      }

      await Promise.allSettled(tasks);

      if (this.disableUpload) {
        return;
      }

      await this.reportFixture(this.sauceJsonReporter.currentFixture);

      this.taskDoneConsole(endTime, passed, warnings);
    },

    // Extraneous funcs - Used by JobReporter
    taskStartConsole(startTime, userAgents, testCount) {
      this.setIndent(this.indentWidth)
        .newline()
        .useWordWrap(true)
        .write(
          this.chalk.bold('Running tests in:'),
          startTime,
          userAgents,
          testCount,
        )
        .newline();

      userAgents.forEach((ua) => {
        this.write(
          `- ${this.chalk.blue(ua)}`,
          startTime,
          userAgents,
          testCount,
        ).newline();
      });
    },

    /**
     * @param {Fixture} fixture
     */
    async reportFixture(fixture) {
      if (!this.reporter.isAccountSet()) {
        return;
      }

      const browserTestRuns = fixture.localBrowserTestRuns;
      if (browserTestRuns.length === 0) {
        return;
      }

      this.setIndent(this.indentWidth * 3)
        .newline()
        .write(this.chalk.bold.underline('Sauce Labs Test Report'))
        .newline();

      const reportTasks = [];
      for (const browserTestRun of browserTestRuns) {
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
              userAgent: browserTestRun.userAgent,
            };
            try {
              const job = await this.reporter.reportSession(session);
              this.setIndent(this.indentWidth * 4)
                .write(
                  `* ${browserTestRun.browser}: ${this.chalk.blue.underline(
                    job.url,
                  )}`,
                )
                .newline();

              if (job.assets.length > 0) {
                this.write(`  ${this.chalk.bold('Assets:')}`).newline();
              }
              for (const asset of job.assets) {
                this.write(`    - ${this.chalk.blue.underline(asset)}`);
              }

              await this.reporter.reportTestRun(
                fixture,
                browserTestRun,
                job.id,
              );
              resolve();
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

    specStartConsole(relSpecPath, index) {
      this.newline()
        .setIndent(this.indentWidth)
        .useWordWrap(true)
        .write(`${index}) ${this.chalk.underline(relSpecPath)}`)
        .newline();
    },

    fixtureStartConsole(name, specPath, meta) {
      this.setIndent(this.indentWidth).useWordWrap(true);

      if (this.afterErrorList) {
        this.afterErrorList = false;
      } else {
        this.newline();
      }

      this.write(name, specPath, meta).newline();
    },

    testDoneConsole(name, testRunInfo, meta) {
      const hasErr = !!testRunInfo.errs.length;
      let symbol = null;
      let nameStyle = null;

      if (testRunInfo.skipped) {
        this.skipped++;

        symbol = this.chalk.cyan('-');
        nameStyle = this.chalk.cyan;
      } else if (hasErr) {
        symbol = this.chalk.red.bold(this.symbols.err);
        nameStyle = this.chalk.red.bold;
      } else {
        symbol = this.chalk.green(this.symbols.ok);
        nameStyle = this.chalk.grey;
      }
      let title = `${symbol} ${nameStyle(name)} (${testRunInfo.durationMs}ms)`;

      this.setIndent(this.indentWidth).useWordWrap(true);

      if (testRunInfo.unstable) {
        title += this.chalk.yellow(' (unstable)');
      }

      if (testRunInfo.screenshotPath) {
        title += ` (screenshots: ${this.chalk.underline.grey(
          testRunInfo.screenshotPath,
        )})`;
      }

      this.write(title, name, testRunInfo, meta);

      this._renderReportData(testRunInfo.reportData, name, testRunInfo, meta);

      if (hasErr) {
        this._renderErrors(testRunInfo.errs, name, testRunInfo, meta);
      }

      this.afterErrorList = hasErr;

      this.newline();
    },

    taskDoneConsole(endTime, passed, warnings) {
      const durationMs = endTime - this.startTime;
      const durationStr = this.moment
        .duration(durationMs)
        .format('h[h] mm[m] ss[s]');
      let footer =
        passed === this.testCount
          ? this.chalk.bold.green(`${this.testCount} passed`)
          : this.chalk.bold.red(
              `${this.testCount - passed}/${this.testCount} failed`,
            );

      footer += this.chalk.grey(` (${durationStr})`);

      if (!this.afterErrorList) {
        this.newline();
      }

      this.setIndent(this.indentWidth)
        .useWordWrap(true)
        .write(footer)
        .newline();

      if (this.skipped > 0) {
        this.write(this.chalk.cyan(`${this.skipped} skipped`)).newline();
      }

      if (warnings.length) {
        this._renderWarnings(warnings);
      }
    },

    _renderReportData(reportData, browsers, name, testRunInfo, meta) {
      if (!reportData) return;

      if (!Object.values(reportData).some((data) => data.length)) return;

      const renderBrowserName = browsers.length > 1;
      const dataIndent = browsers.length > 1 ? 3 : 2;

      this.newline().setIndent(this.indentWidth).write('Report data:');

      browsers.forEach(({ testRunId, prettyUserAgent }) => {
        const browserReportData = reportData[testRunId];

        if (!browserReportData) return;

        if (renderBrowserName) {
          this.setIndent(this.indentWidth * 2)
            .newline()
            .write(prettyUserAgent, name, testRunInfo, meta);
        }

        browserReportData.forEach((data) => {
          this.setIndent(this.indentWidth * dataIndent)
            .newline()
            .write(`- ${data}`, name, testRunInfo, meta);
        });
      });
    },

    _renderErrors(errs, name, testRunInfo, meta) {
      this.setIndent(this.indentWidth * 3).newline();

      errs.forEach((err, idx) => {
        const prefix = this.chalk.red(`${idx + 1}) `);

        this.newline()
          .write(this.formatError(err, prefix), name, testRunInfo, meta)
          .newline()
          .newline();
      });
    },

    _renderWarnings(warnings) {
      this.newline()
        .setIndent(this.indentWidth * 4)
        .write(this.chalk.bold.yellow(`Warnings (${warnings.length}):`))
        .newline();

      warnings.forEach((msg) => {
        this.setIndent(this.indentWidth * 4)
          .write(this.chalk.bold.yellow('--'))
          .newline()
          .setIndent(this.indentWidth * 5)
          .write(msg)
          .newline();
      });
    },

    log(msg) {
      this.write(msg).newline();
    },

    error(msg) {
      this.newline().write(this.chalk.red(msg)).newline();
    },
  };
};
