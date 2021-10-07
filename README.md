# testcafe-reporter-saucelabs

This is the **Sauce Labs** reporter plugin for [TestCafe](http://devexpress.github.io/testcafe).

If you are already using
the [Sauce Labs Browser Provider](https://github.com/DevExpress/testcafe-browser-provider-saucelabs) for running tests
against Sauce Labs, then refrain from installing this reporter, as you will be creating duplicate reports.

## Install

```
npm install testcafe-reporter-saucelabs
```

## Configuration

### Sauce Labs credentials

`SAUCE_USERNAME` and `SAUCE_ACCESS_KEY` environment variables needs to be set to allow the plugin to report your results
to Sauce Labs. Your Sauce Labs Username and Access Key are available from your
[dashboard](https://app.saucelabs.com/user-settings).

### TestCafe Configuration

To configure the reporter, simply extend your TestCafe configuration file (e.g. `.testcaferc.js`):

```js
module.exports = {
    "sauce": {
        "build":  "build123",
        "tags":   [
            "app101",
        ],
        "region": "us-west-1",
    }
}
```

## Usage

When you run tests from the command line, specify the reporter name by using the `--reporter` option:

```
testcafe chrome 'path/to/test/file.js' --reporter saucelabs
```

When you use API, pass the reporter name to the `reporter()` method:

```js
testCafe
    .createRunner()
    .src('path/to/test/file.js')
    .browsers('chrome')
    .reporter('saucelabs') // <-
    .run();
```
