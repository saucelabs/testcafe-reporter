import { TestRun, Test } from '@saucelabs/sauce-json-reporter';

export type Asset = { name: string; localPath: string };
export type Assets = Array<Asset>;

/**
 * Provides a facade to help associate a sauce-json-reporter/TestRun with additional TestCafe specific
 * execution metadata (e.g. browser under test, generated assets).
 */
export class BrowserTestRun {
  userAgent: string;
  testRun: TestRun;
  assets: Assets;

  #browser: string;
  platform: string;

  constructor(userAgent: string) {
    this.userAgent = userAgent;
    this.testRun = new TestRun();
    (this.testRun.metadata as { userAgent: string })['userAgent'] = userAgent;
    this.assets = [];

    // NOTE: example userAgents:
    // * Chrome 126.0.0.0 / Sonoma 14
    // * Chrome 126.0.0.0 / Windows 10 (https://app.saucelabs.com/tests/000aa4ffc86d40bdbeebfcf165dab402)
    const matches = userAgent.match(/^([\w .]+)(?:\/([\w .]+))?/);

    if (matches) {
      this.#browser = matches[1]?.trim() ?? '';
      this.platform = matches[2]?.trim() ?? '';
    } else {
      this.#browser = '';
      this.platform = '';
    }
  }

  /**
   * Returns the job id for the remotely executed test run.
   *
   * Job link is provided in the user agent by the saucelabs browser provider.
   */
  get jobId() {
    // NOTE: example match:
    // * Chrome 126.0.0.0 / Windows 10 (https://app.saucelabs.com/tests/000aa4ffc86d40bdbeebfcf165dab402)
    const matches = this.userAgent.match(
      /https:\/\/.*saucelabs\.com\/tests\/(\w+)/,
    );
    if (!matches || matches.length < 2) {
      return null;
    }
    return matches[1];
  }

  get browserName() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [name = 'unknown', _] = this.#browser.split(' ');
    return name;
  }

  get browserVersion() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, version = 'unknown'] = this.#browser.split(' ');
    return version;
  }

  get browser() {
    return this.#browser;
  }

  addTest(fixturePath: string, fixtureName: string, test: Test) {
    this.testRun.withSuite(fixturePath).withSuite(fixtureName).addTest(test);
    this.testRun.computeStatus();
  }

  addAssets(assets: Assets) {
    this.assets.push(...assets);
  }
}

export class Fixture {
  name: string;
  path: string;
  meta: object;
  browserTestRuns: Map<string, BrowserTestRun>;
  startTime?: Date;
  endTime?: Date;

  constructor(name: string, path: string, meta: object) {
    this.name = name;
    this.path = path;
    this.meta = meta;
    this.browserTestRuns = new Map();
  }

  addTestWithAssets(
    userAgent: string,
    test: Test,
    screenshotAssets: Assets,
    videoAssets: Assets,
  ) {
    if (!this.browserTestRuns.has(userAgent)) {
      this.browserTestRuns.set(userAgent, new BrowserTestRun(userAgent));
    }

    const tr = this.browserTestRuns.get(userAgent) as BrowserTestRun;

    for (const a of screenshotAssets) {
      test.attach({
        path: a.name,
        name: a.name,
        contentType: 'image/png',
      });
    }
    for (const a of videoAssets) {
      test.attach({
        path: a.name,
        name: a.name,
        contentType: 'video/mp4',
      });
    }

    tr.addTest(this.path, this.name, test);
    tr.addAssets([...screenshotAssets, ...videoAssets]);
  }

  get testRuns() {
    return [...this.browserTestRuns.values()].map((bc) => bc.testRun);
  }

  get localBrowserTestRuns() {
    return [...this.browserTestRuns.values()].filter(
      (run) => run.jobId === null,
    );
  }

  get remoteBrowserTestRuns() {
    return [...this.browserTestRuns.values()].filter(
      (run) => run.jobId !== null,
    );
  }
}
