# Development

## Local Testing

To test the reporter locally, link it to itself and then run a test with the
reporter set:

```sh
$ npm link
$ npm link testcafe-reporter-saucelabs
$ npx testcafe chrome tests/integration/sauceswag.ok.test.js --reporter saucelabs
```

### Common Issues

**Problem**

```sh
$ npx testcafe chrome tests/integration/sauceswag.test.js --reporter saucelabs
ERROR The "saucelabs" reporter does not exist. Check the reporter parameter for errors.
```

**Solution**

Re-link the package:

```sh
npm link && npm link testcafe-reporter-saucelabs
```
