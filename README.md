# testcafe-reporter-saucelabs

This is the **Sauce Labs** reporter plugin for [TestCafe](http://devexpress.github.io/testcafe).

If you are already using
the [Sauce Labs Browser Provider](https://github.com/DevExpress/testcafe-browser-provider-saucelabs) for running tests
against Sauce Labs, then refrain from installing this reporter, as you will be creating duplicate reports.

## Install

```
npm install testcafe-reporter-saucelabs
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

## Author

Sauce Labs Inc. (https://saucelabs.com)
