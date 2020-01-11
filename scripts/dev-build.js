/* eslint-env node */
// This script sets up a development environment of Salesforce Inspector.
// Release builds use a different method.
// This script must be run through "npm run" so the PATH includes NPM dependencies.
"use strict";
const fs = require("fs-extra");

let manifest = fs.readJsonSync("addon/manifest-template.json");

let browser = process.argv[2];
if (browser == "firefox") {

  // Firefox needs to run in spanning mode, since it does not support split mode.
  manifest.incognito = "spanning";

  // Remove unused property, for consistency with the Chrome version.
  delete manifest.minimum_chrome_version;

} else if (browser == "chrome") {

  // Chrome needs to run in split mode, since it does not support opening private extension tabs in spanning mode.
  manifest.incognito = "split";

  // Remove irrelevant but annoying warning message "Unrecognized manifest key 'applications'.".
  delete manifest.applications;

} else {
  throw new Error("Unknown browser: " + browser);
}

fs.writeJsonSync("addon/manifest.json", manifest, {spaces: 2});
