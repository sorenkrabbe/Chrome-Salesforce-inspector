/* eslint-env node */
"use strict";
const fs = require("fs-extra");
const replace = require("replace-in-file");
const childProcess = require("child_process");

fs.emptyDirSync("target/firefox");
fs.copySync("addon", "target/firefox/addon", {
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
  files: "target/firefox/addon/*.html",
  replace: [
    '<script src="react.js"></script>',
    '<script src="react-dom.js"></script>'
  ],
  with: [
    '<script src="react.min.js"></script>',
    '<script src="react-dom.min.js"></script>'
  ]
});

// Firefox needs to run in spanning mode, since it does not support split mode.
// Chrome needs to run in split mode, since it does not support opening private extension tabs in spanning mode.
// In development, we specify split mode for both browsers, since Firefox just ignores it.
// But for Firefox release we need to replace it with spanning, or else addons.mozilla.org will fail.
replace.sync({
  files: "target/firefox/addon/manifest.json",
  replace: '"incognito": "split",',
  with: '"incognito": "spanning",'
});

childProcess.execSync("web-ext build --source-dir target/firefox/addon --artifacts-dir target/firefox");
