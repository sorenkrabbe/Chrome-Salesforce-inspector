/* eslint-env node */
// This script makes Release builds of Salesforce Inspector.
// Dev builds use a different method.
// This script must be run through "npm run" so the PATH includes NPM dependencies.
"use strict";
const fs = require("fs-extra");
const replace = require("replace-in-file");
const childProcess = require("child_process");
const zipdir = require("zip-dir");

let browser = process.argv[2];
let target;

if (browser == "firefox") {

  fs.emptyDirSync("target/firefox");
  target = "target/firefox/dist";

} else if (browser == "chrome") {

  fs.emptyDirSync("target/chrome");
  target = "target/chrome/dist/addon";

} else {
  throw "Unknown browser: " + browser;
}

fs.copySync("addon", target, {
  filter(path) {
    let file = path.replace("\\", "/");
    return !file.startsWith("addon/test-") // Skip the test framework
      && !file.endsWith("-test.js") // Skip individual tests
      // Skip files in .gitignore
      && !file.endsWith(".zip")
      && !file.endsWith(".xpi")
      // Skip files where the release version will use minified versions instead
      && file != "addon/react.js"
      && file != "addon/react-dom.js";
  }
});

// Use minified versions of React. The development versions contain extra checks and validations, which gives better error messages when developing, but are slower.
replace.sync({
  files: target + "/*.html",
  replace: [
    '<script src="react.js"></script>',
    '<script src="react-dom.js"></script>'
  ],
  with: [
    '<script src="react.min.js"></script>',
    '<script src="react-dom.min.js"></script>'
  ]
});

if (process.env.ENVIRONMENT_TYPE == "BETA") {
  replace.sync({
    files: target + "/manifest.json",
    replace: '"name": "Salesforce inspector",',
    with: '"name": "Salesforce inspector BETA",'
  });
}

if (browser == "firefox") {

  // Firefox needs to run in spanning mode, since it does not support split mode.
  // Chrome needs to run in split mode, since it does not support opening private extension tabs in spanning mode.
  // In development, we specify split mode for both browsers, since Firefox just ignores it.
  // But for Firefox release we need to replace it with spanning, or else addons.mozilla.org will fail.
  replace.sync({
    files: target + "/manifest.json",
    replace: '"incognito": "split",',
    with: '"incognito": "spanning",'
  });

  if (process.env.ZIP_FILE_NAME) {
    throw "ZIP_FILE_NAME not supported";
  }

  childProcess.execSync("web-ext build --source-dir target/firefox/dist --artifacts-dir target/firefox");

  console.log("Completed Firefox release build");

} else if (browser == "chrome") {

  zipdir("target/chrome/dist", {saveTo: process.env.ZIP_FILE_NAME || "target/chrome/chrome-release-build.zip"}, err => {
    if (err) {
      process.exitCode = 1;
      console.error(err);
    }
    console.log("Completed Chrome release build");
  });

} else {
  throw "Unknown browser: " + browser;
}
