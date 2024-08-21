# testcafe-reporter-saucelabs

This is the **Sauce Labs** reporter plugin for [TestCafe](http://devexpress.github.io/testcafe).

If you are already using the [Sauce Labs Browser Provider](https://github.com/DevExpress/testcafe-browser-provider-saucelabs) for running tests against Sauce Labs, please refrain from installing this reporter, as it will create duplicate reports.

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
