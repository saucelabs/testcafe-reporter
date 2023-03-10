import { TestRun, Test } from '@saucelabs/sauce-json-reporter';

export type Asset = { name: string, localPath: string };
export type Assets = Array<Asset>;

/**
* Provides a facade to help associate a sauce-json-reporter/TestRun with additional TestCafe specific
* execution metadata (e.g. browser under test, generated assets).
*/
class BrowserTestRun {
    userAgent: string;
    testRun: TestRun;
    assets: Assets;

    #browser: string;
    platform: string;

    constructor(userAgent: string) {
        this.userAgent = userAgent;
        this.testRun = new TestRun();
        // @ts-ignore
        this.testRun.metadata['userAgent'] = userAgent;
        this.assets = [];

        const [ browser, platform ] = userAgent.split('/').map((ua) => ua.trim());

        this.#browser = browser;
        this.platform = platform;
    }

    get browserName() {
        const [ name = 'unknown',  _ ] = this.#browser.split(' ');
        return name;
    }

    get browserVersion() {
        const [ _, version = 'unknown' ] = this.#browser.split(' ');
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

class Fixture {
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

    addTestWithAssets(userAgent: string, test: Test, screenshotAssets: Assets, videoAssets: Assets) {
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

    collectTestRuns() {
        return [...this.browserTestRuns.values()].map((bc) => bc.testRun);
    }
}

module.exports = {
    BrowserTestRun,
    Fixture,
};
