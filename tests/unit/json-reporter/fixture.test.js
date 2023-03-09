/* eslint-env node, jest */
const { BrowserTestRun, Fixture } = require('../../../src/json-reporter/fixture');
const { Test, Status } = require('@saucelabs/sauce-json-reporter');


describe('BrowserTestRun', () => {
    test.each([
        ['Chrome 97.0.4692.71 / macOS 10.15.7', 'Chrome', '97.0.4692.71'],
        ['Firefox 97 / macOS 10.15.7', 'Firefox', '97'],
        ['Firefox 97', 'Firefox', '97'],
        ['Firefox', 'Firefox', 'unknown'],
    ])('can parse browser from userAgent (%s)', (userAgent, expectedBrowserName, expectedBrowserVersion) => {
        const sut = new BrowserTestRun(userAgent);

        expect(sut.browserName).toBe(expectedBrowserName);
        expect(sut.browserVersion).toBe(expectedBrowserVersion);
    });
    test.each([
        ['Chrome 97.0.4692.71 / macOS 10.15.7', 'macOS 10.15.7'],
        ['Firefox 97 / macOS', 'macOS'],
    ])('can parse platform from userAgent (%s)', (userAgent, expectedPlatform) => {
        const sut = new BrowserTestRun(userAgent);

        expect(sut.platform).toBe(expectedPlatform);
    });
});

describe('Fixture', () => {
    test('adding a test adds it to the correct suite', () => {
        const fixtureName = 'test fixture';
        const fixturePath = 'path/to/some/test.spec.js';
        const fixtureMeta = {};
        const userAgent = 'Chrome 99 / macOS 10';
        const screenshotAssets = [];
        const videoAssets = [];
        const test = new Test('test', Status.Passed, 123, '', new Date('August 15 2021 00:00:00 UTC'));
        const sut = new Fixture(fixtureName, fixturePath, fixtureMeta, [userAgent]);

        sut.addTestWithAssets(userAgent, test, screenshotAssets, videoAssets);

        expect(sut.collectTestRuns()).toMatchSnapshot();
    });
});
