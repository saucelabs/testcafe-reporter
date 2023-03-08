/* eslint-env node */
// @ts-check
const { TestRun, Test } = require('@saucelabs/sauce-json-reporter');

/**
* Provides a facade to help associate a sauce-json-reporter/TestRun with additional TestCafe specific
* execution metadata (e.g. browser under test, generated assets).
*/
class BrowserTestRun {
  /**
   * @param {string} userAgent
   */
  constructor(userAgent) {
    this.userAgent = userAgent;
    this.testRun = new TestRun();
    this.testRun.metadata['userAgent'] = userAgent;
    /**
     * @type {Array<{ name: string, localPath: string }>}
     */
    this.assets = [];

    const [ browser, platform ] = userAgent.split('/').map((ua) => ua.trim());

    this._browser = browser;
    this.platform = platform;
  }

  get browserName() {
    const [ name = 'unknown',  _ ] = this._browser.split(' ');

    return name;
  }

  get browserVersion() {
    const [ _, version = 'unknown' ] = this._browser.split(' ');

    return version;
  }

  get browser() {
    return this._browser;
  }

  /**
   * @param {string} fixturePath
   * @param {string} fixtureName
   * @param {Test} test
   */
  addTest(fixturePath, fixtureName, test) {
    this.testRun.withSuite(fixturePath).withSuite(fixtureName).addTest(test);
    this.testRun.computeStatus();
  }

  /**
   * @param {Array<{ name: string, localPath: string }>} assets
   */
  addAssets(assets) {
    this.assets.push(...assets);
  }
}

class Fixture {
  /**
   * @param {string} name - The fixture name
   * @param {string} path - The path to the file defining the fixture
   * @param {object} meta - Metadata about the fixture
   */
  constructor(name, path, meta) {
    this.name = name;
    this.path = path;
    this.meta = meta;
    /**
     * @type Map<string, BrowserTestRun>
     */
    this.browserTestRuns = new Map();

    /**
     * @type Date
     */
    this.startTime = null;
    /**
     * @type Date
     */
    this.endTime = null;
  }

  /**
   * @param {string} userAgent
   * @param {Test} test
   * @param {Array<{ name: string, localPath: string }>} screenshotAssets
   * @param {Array<{ name: string, localPath: string }>} videoAssets
   */
  addTestWithAssets(userAgent, test, screenshotAssets, videoAssets) {
    if (!this.browserTestRuns.has(userAgent)) {
      this.browserTestRuns.set(userAgent, new BrowserTestRun(userAgent));
    }

    const tr = this.browserTestRuns.get(userAgent);

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

  collectTestRuns() {
    return [...this.browserTestRuns.values()].map((bc) => bc.testRun);
  }
}

module.exports = {
  BrowserTestRun,
  Fixture,
};
