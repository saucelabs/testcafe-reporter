const { spawn } = require('child_process');

function runTest() {
  return new Promise((resolve, reject) => {
    const testcafeProcess = spawn('npx', [
      'testcafe',
      'chrome:headless',
      'tests',
      '--reporter',
      'saucelabs',
    ]);

    testcafeProcess.stdout.pipe(process.stdout);
    testcafeProcess.stderr.pipe(process.stderr);

    testcafeProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`TestCafe process exited with code ${code}`));
      }
    });
  });
}

runTest()
  .then(() => {
    console.log(
      'Integration test for custom reporter completed successfully.\n',
    );
  })
  .catch((error) => {
    console.error('Integration test failed:', error.message);
    process.exit(1);
  });
