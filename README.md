<img src="https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/addon/icon128.png" align="right">

Salesforce inspector
===========================
Chrome and Firefox extension to add a metadata layout on top of the standard Salesforce UI to improve the productivity and joy of Salesforce configuration, development, and integration work.


Installation
------------
- Install from Chrome Web Store: https://chrome.google.com/webstore/detail/salesforce-inspector/aodjmnfhjibkcdimpodiifdjnnncaafh
- Install from Firefox Add-ons: https://addons.mozilla.org/firefox/addon/salesforce-inspector/


Features
-----
* Quickly view field information directly from a record detail page, edit page or Visualforce page.
* Quickly view and edit all data for a record, even data that is not on the page layout.
* Perform quick one-off data exports and imports directly from within Salesforce. Data can be easily copied to and from Excel. No need to log in again when you are already logged in with your browser.

<img alt="Inspector menu" src="https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/docs/screenshots/1.png" height="100">
<img alt="Show field metadata" src="https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/docs/screenshots/2.png" height="100">
<img alt="Show all data for record" src="https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/docs/screenshots/3.png" height="100">
<img alt="Data exporter" src="https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/docs/screenshots/4.png" height="100">
<img alt="Data importer" src="https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/docs/screenshots/5.png" height="100">


Troubleshooting
-----
If the tool is not available after installation, the most likely issue is that your browser is not up to date. See [instructions for Google Chrome](https://productforums.google.com/forum/#!topic/chrome/YK1-o4KoSjc).

Unit tests
-----
1. Set up a Developer Edition org with the customizations described in `test/org/`.
2. Navigate to one of the extension pages and replace the file name with `test-framework.html`, for example `chrome-extension://example/test-framework.html?host=example.my.salesforce.com`.
3. Open your browser's developer tools console.
4. Wait until "Salesforce Inspector unit test finished" is logged, and verify that no error messages are logged (HTTP 4xx messages are OK)

### Linting

1. Install Node.js with npm
2. `npm install`
3. `npm test`

Release
-------
Version number must be manually incremented in [addon/manifest.json](addon/manifest.json) file

**Chrome:** When commit message contains *#releaseIt* the revision will be packaged and uploaded to Chrome Web Store ready for manual release to the masses.

**Firefox:** Manually so far

Design Principles
-----
(we don't live up to all of them. pull requests welcome)
* Stay completely inactive until the user explicitly interacts with it. The tool has the potential to break Salesforce functionality when used, since we rely on monkey patching and internal APIs. We must ensure that you cannot break Salesforce just by having the tool installed or enabled. For example, we won't fix the setup search placeholder bug.
* For manual ad-hoc tasks only. The tool is designed to help administrators and developers interact with Salesforce in the browser. It is after all a browser add-on. Enabling automation is a non-goal.
* User experience is important. Features should be intuitive and discoverable, but efficiency is more important than discoverability. More advanced features should be hidden, and primary features shuld be central. Performance is key.
* Automatically provide as much contextual information as possible, without overwhelming the user. Information that is presented automatically when needed is a lot more useful than information you need to explicitly request. For example, provide autocomplete for every input.
* Provide easy access to the raw Salesforce API. Enhance the interaction in a way that does not break the core use case, if our enhancements fails. For example, ensure we can display the result of a data export even if we cannot parse the SOQL query.
* It is fine to implement features that are already available in the core Salesforce UI, if we can make it easier, smarter or faster.
* Ensure that it works for as many users as possible. (for system administrators, for standard users, with person accounts, with multi currency, with large data volumes, with professional edition, on a slow network etc.)
* Be conservative about the number and complexity of Salesforce API requests we make, but don't sacrifice the other principles to do so.
* Focus on system administrators, developers and integrators.

About
-----
By Søren Krabbe (soren.krabbe@capgemini.com) and Jesper Kristensen

License
-----
MIT
