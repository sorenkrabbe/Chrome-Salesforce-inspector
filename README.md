Salesforce inspector
===========================
Chrome and Firefox extension to add a metadata layout on top of the standard Salesforce UI to improve the productivity and joy of Salesforce configuration, development, and integration work.


Features
-----
* Quickly view field information directly from a record detail page, edit page or Visualforce page.
* Quickly view and edit all data for a record, even data that is not on the page layout.
* Perform quick one-off data exports and imports directly from within Salesforce. Data can be easily copied to and from Excel. No need to log in again when you are already logged in with your browser.

![Inspector menu](https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/docs/screenshots/1.png)
![Show field metadata](https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/docs/screenshots/2.png)
![Show all data for record](https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/docs/screenshots/3.png)
![Data exporter](https://raw.githubusercontent.com/sorenkrabbe/Chrome-Salesforce-inspector/master/docs/screenshots/4.png)


Installation
------------
- Install from Chrome Web Store: https://chrome.google.com/webstore/detail/salesforce-inspector/aodjmnfhjibkcdimpodiifdjnnncaafh
- Install from Firefox Add-ons: https://addons.mozilla.org/firefox/addon/salesforce-inspector/


Unit tests
-----
1. Set up a Developer Edition org with the customizations described in `test/org/`.
2. Set up a server at `https://localhost:8080` pointing a the root of this repository.
  * `npm install http-server --global`
  * `OPENSSL_CONF=/c/Program\ Files\ \(x86\)/Git/ssl/openssl.cnf openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 300 -nodes`
  * `http-server --ssl`
  * Open `https://localhost:8080/` and confirm the security exception.
3. Open the Visualforce page you just created.
4. Open your browser's developer tools console.
5. Wait until "Salesforce Inspector unit test finished" is logged, and verify that no error messages are logged (HTTP 4xx messages are OK)

Release
-------
Version number must be manually incremented in [version.json](version.json) file

**Chrome:** When commit message contains *#releaseIt* the revision will be packaged and uploaded to Chrome Web Store ready for manual release to the masses.

**Firefox:** Manually so far

About
-----
By Søren Krabbe (soren.krabbe@capgemini.com) and Jesper Kristensen

License
-----
MIT
