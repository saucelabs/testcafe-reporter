import { Status, Test } from '@saucelabs/sauce-json-reporter';
import { Assets, BrowserTestRun, Fixture } from '../../src/fixture';

describe('BrowserTestRun', () => {
  [
    ['Chrome 97.0.4692.71 / macOS 10.15.7', 'Chrome', '97.0.4692.71'],
    ['Firefox 97 / macOS 10.15.7', 'Firefox', '97'],
    ['Firefox 97', 'Firefox', '97'],
    ['Firefox', 'Firefox', 'unknown'],
    [
      'Chrome 126.0.0.0 / Windows 10 (https://app.saucelabs.com/tests/000aa4ffc86d40bdbeebfcf165dab402)',
      'Chrome',
      '126.0.0.0',
    ],
  ].forEach(([userAgent, expectedBrowserName, expectedBrowserVersion]) => {
    test(`can parse browser from userAgent (${userAgent})`, async () => {
      const sut = new BrowserTestRun(userAgent);

      expect(sut.browserName).toBe(expectedBrowserName);
      expect(sut.browserVersion).toBe(expectedBrowserVersion);
    });
  });

  [
    ['Chrome 97.0.4692.71 / macOS 10.15.7', 'macOS 10.15.7'],
    ['Firefox 97 / macOS', 'macOS'],
    [
      'Chrome 126.0.0.0 / Windows 10 (https://app.saucelabs.com/tests/000aa4ffc86d40bdbeebfcf165dab402)',
      'Windows 10',
    ],
  ].forEach(([userAgent, expectedPlatform]) => {
    test(`can parse platform from userAgent (${userAgent})`, async () => {
      const sut = new BrowserTestRun(userAgent);

      expect(sut.platform).toBe(expectedPlatform);
    });
  });

  [
    [
      'Chrome 126.0.0.0 / Windows 10 (https://app.saucelabs.com/tests/000aa4ffc86d40bdbeebfcf165dab402)',
      '000aa4ffc86d40bdbeebfcf165dab402',
    ],
    [
      'Chrome 126.0.0.0 / Windows 10 (https://app.eu-central-1.saucelabs.com/tests/000aa4ffc86d40bdbeebfcf165dab402)',
      '000aa4ffc86d40bdbeebfcf165dab402',
    ],
  ].forEach(([userAgent, expectedJobId]) => {
    test(`can parse jobId from userAgent (${userAgent})`, async () => {
      const sut = new BrowserTestRun(userAgent);

      expect(sut.jobId).toBe(expectedJobId);
    });
  });
});

describe('Fixture', () => {
  test('adding a test adds it to the correct suite', async () => {
    const fixtureName = 'test fixture';
    const fixturePath = 'path/to/some/test.spec.js';
    const fixtureMeta = {};
    const userAgent = 'Chrome 99 / macOS 10';
    const screenshotAssets: Assets = [];
    const videoAssets: Assets = [];
    const artifacts: Assets = [];
    const test = new Test(
      'test',
      Status.Passed,
      123,
      '',
      new Date('August 15 2021 00:00:00 UTC'),
    );
    const sut = new Fixture(fixtureName, fixturePath, fixtureMeta);

    sut.addTestWithAssets(
      userAgent,
      test,
      screenshotAssets,
      videoAssets,
      artifacts,
    );

    expect(sut.testRuns).toMatchSnapshot();
  });
});
