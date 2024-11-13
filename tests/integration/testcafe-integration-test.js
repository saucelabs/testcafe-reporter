const { spawn } = require('child_process');

function runTest() {
  let stdoutData = '';
  let stderrData = '';

  return new Promise((resolve, reject) => {
    // Run TestCafe CLI with custom reporter
    const testcafeProcess = spawn('npx', [
      'testcafe',
      'chrome',
      'tests',
      '--reporter',
      'saucelabs',
    ]);

    testcafeProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    testcafeProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    testcafeProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ stdoutData, stderrData });
      } else {
        reject(new Error(`TestCafe process exited with code ${code}`));
      }
    });
  });
}

runTest()
  .then(({ stdoutData, stderrData }) => {
    console.log(
      'Integration test for custom reporter completed successfully.\n',
    );
    console.log(stdoutData);
    if (stderrData) {
      console.log('\n--- Test Errors (stderr) ---\n', stderrData);
    }
  })
  .catch((error) => {
    console.error('Integration test failed:', error.message);
  });
