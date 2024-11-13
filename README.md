# testcafe-reporter-saucelabs

This is the **Sauce Labs** reporter plugin for [TestCafe](http://devexpress.github.io/testcafe).

Tip: You can also use this reporter together with the
[Sauce Labs Browser Provider](https://github.com/saucelabs/testcafe-provider)
for running tests against remote browsers from Sauce Labs!

## Installation

```sh
npm install testcafe-reporter-saucelabs
```

## Configuration

### Sauce Labs Credentials

Set the `SAUCE_USERNAME` and `SAUCE_ACCESS_KEY` environment variables to allow the plugin to report your results to Sauce Labs. Your Sauce Labs Username and Access Key are available from your [dashboard](https://app.saucelabs.com/user-settings).

Alternatively, you can use the `username` and `accessKey` fields in the reporter configuration.

### TestCafe Configuration

To configure the reporter, extend your TestCafe configuration file (e.g. `.testcaferc.js`):

```js
module.exports = {
  sauce: {
    build: 'build123',
    tags: ['app101'],
    region: 'us-west-1',
  },
};
```

| Name     | Description                                                                                                                          | Type                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `build`  | Sets a build ID. <br> **Default**: `''`                                                                                              | `string`                          |
| `tags`   | Specifies tags to add to the uploaded Sauce job for easy categorization. <br> **Default**: `[]`                                      | `string[]`                        |
| `region` | Sets the region in which the service will run. <br> Valid options are `us-west-1` or `eu-central-1`. <br> **Default**: `'us-west-1'` | `'us-west-1'` \| `'eu-central-1'` |

### Uploading Custom Artifacts

Custom artifacts, such as log files or screenshots, can be uploaded during TestCafe
tests using the `t.report` API. Specify the `sauceAttachments` option to include
artifacts. Paths for artifacts are relative to the current test execution directory.

Add the following example to your test:

```javascript
await t.report({
  sauceAttachments: ['my_screenshots/this-is-fine.png', 'test.log'],
});
```

## Usage

When you run tests from the command line, specify the reporter name using the `--reporter` option:

```sh
testcafe chrome 'path/to/test/file.js' --reporter saucelabs
```

When using the API, pass the reporter name to the `reporter()` method:

```js
testCafe
  .createRunner()
  .src('path/to/test/file.js')
  .browsers('chrome')
  .reporter('saucelabs') // <-
  .run();
```
