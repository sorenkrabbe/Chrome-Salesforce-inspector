Version 1.13
===========

General
-------
* Update to Salesforce API v 53.0 (Winter '22)

Version 1.12
===========

General
-------
* Update to Salesforce API v 51.0 (Spring '21)

Version 1.11
===========

General
-------
* Make inspector available on Visualforce pages on new visualforce.com domain. See #143

Org Limits
----------
* Displays "consumed" count

Version 1.10
===========

General
-------
* Update to Salesforce API v 48.0

Version 1.9
===========

Inspector menu
--------------
* Fix a bug fix hiding the "show field metadata" button (#150)

Version 1.8
===========

Inspector menu
--------------
* Added user search aspect to simplify access to detailed user data and "login as".

Version 1.7
===========

General
-------
* Update to Salesforce API v 47.0

Inspector menu
--------------
* A new link to switch in and out of Salesforce Setup, where you can choose to open in a new tab or not.

Show all data
-------------
* Fixed a bug causing errors when viewing some special objects.
* Link to Salesforce Setup in both Classic and Lightning Experience.
* Use default values for blank fields when creating a new record. This avoids the error message that OwnerId is required but missing.

Data import
-----------
* Save import options in your excel sheet, so you can update the same data again and again with a single copy-paste.


Version 1.6
===========

General
-------
* Update to Salesforce API v 45.0
* Support for cloudforce.com orgs

Show all data
-------------
* Buttons to Create, delete and clone records

Data export
-----------
* Keyboard shortcut to do export (ctrl+enter)
* Fixes saved query selection

Data import
-----------
* Wider import fields

Version 1.5
===========

General
-------
* Update to Salesforce API v 43.0

Inspector menu
--------------
* Show record details - currently for objects with record types only
* Link to LEX object manager/setup for object in focus

Version 1.4
===========

Inspector menu
--------------
* Support for Spring '18 LEX URL format (https://docs.releasenotes.salesforce.com/en-us/spring18/release-notes/rn_general_enhanced_urls_cruc.htm)

Version 1.3
===========

General
-------
* Rewritten the implementation of Data Export and Data Import, in order to comply with the updated version of Mozilla's add-ons policy.

Version 1.2
===========

General
-------
* Update API versoin to Spring 17.

Inspector menu
--------------
* Use the autocomplete to find object API names, labels and ID prefixes.
* View some information about the selected record or object directly in the menu.
* Inspect objects in the Tooling API and objects you don't have read access to.
* When viewing a Deployment Status, a new button allows you to get all the details of the deployment.
* The Explore API button is now visible everywhere.

Show all data
-------------
* The Type column has more information. (required, unique, auto number etc.)
* Add your own columns, (for example a column showing the formula of formula fields, or a collumn that tells which fields can be used as a filter.) for both fields and relationships.
* The "Advanced filter" option is more discoverable now.
* New button to start data export for the shown object.
* New button to edit the page layout for the shown record.
* Better handling of objects that share a common ID prefix or is available with both the regular API and the Tooling API.

Data export
-----------
* Save your favourite SOQL queries.
* The query history remembers if queries were done with the Tooling API or not.
* Fixed right clicking on IDs in the exported data.

Data import
-----------
* Fix for importing data from Excel on Mac into Chrome.

Org Limits
----------
* View how much of your org's limits you are currently using.

Download Metadata
-----------------
* Download all your org's Apex classes, Visualforce pages, objects, fields, validation rules, workflow rules, reports and much more. Use it for backup, or if you want to search for any place a particular item is used, or for many other purposes.

API Explorer
------------
* Choose between showing the result for easy viewing or for easy copying.
* Make SOAP requests.
* Make REST requests for any HTTP method.
* Edit any API request before sending.

Version 1.1
============

General
-------
* Update API versoin to Winter 17.
* Find the current page's record ID for Visualforce pages that store the record ID in a non-standard parameter name.

Data import
-----------
* Don't make describe calls in an infinite loop when Salesforce returns an error (Salesforce Winter 17 Tooling API has a number objects starting with autogen__ that don't work properly).

Version 1.0
============

General
-------
* The Inspector is now shown in regular tabs instead of popups. You can now choose if you want to open a link in the same tab (the default), or a new tab/window, using normal browser menus and shortcuts. Previously every link opened a new popup window.
* Restyled the Inspector menu to use Lightning Design. Restyling the rest will come later.
* Switched to a more robust API for getting the Salesforce session ID. It now works with all session security settings, and it works in Lightning Experience.
* Added a logo/icon.
* The salesforce hostname is now visible as a parameter in the URL bar.
* If you have an outdated browser version that is not supported by the latest version of Salesforce Inspector, Salesforce Inspector will not autoupdate.
* Updated API version to Summer 16.

Show all data
-------------
* When copy-pasting a value, there is no longer extra white-space at the beginning and end of the copied text.

Data import
-----------
* Ask for confirmation before closing an in-progress data import.
* Tweaks to how batch concurrency/threads work.

Data export
-----------
* If an error occurs during a data export, we now keep the data that is already exported.

Known Issues
------------
* When using Firefox, it no longer works in Private Browsing mode, since it cannot get the Salesforce session ID. See https://bugzilla.mozilla.org/show_bug.cgi?id=1254221 .

Version 0.10
============

General
-------
* Update API version to Spring 16.

Show all data
-------------
* Show information about the page layout of the inspected record.
* Make quick value selection work in Chrome again.

Data export
-----------
* Make record IDs clickable in the result table, in adition to object names.
* Offer to either view all data for a record or view the record in normal Salesforce UI.
* Fix bug opening the all data window when exporting with the Tooling API.
* Fix keyboard shortcut issue in some variations of Chrome.

Data import
-----------
* Make record IDs clickable in the status table.

API explorer
------------
* Display results as a table instead of CSV.

Version 0.9
===========

General
-------
* Show the inspector menu in the inspector's own windows.
* Better handling of network errors and errors returned by the Salesforce API.

Show field metadata
-------------------
* Fix viewing field metadata for a Visualforce page.

Show all data
-------------
* Show the object/record input field everywhere instead of only in the developer console.
* Fix "setup" links for person accounts and for orgs with many custom fields.
* Allow editing only specific fields of a record, and refresh the data after saving.
* Improve selection.

Data export
-----------
* Support autocomplete for subqueries in the where clause.
* Sort the autocomplete results by relevance.
* Implement filtering of results (since browser search does not play nice with our lazy rendering).

Data import
-----------
* Rewrite UI to be more guided.
* Graphical display of import status.
* Support for the tooling API.

Version 0.8
===========

General
-------
* Works in the service cloud console in Chrome (worked previously only in Firefox).
* Uses new extension API for Firefox (requires Firefox 44).
* Partial support for Salesforce1/Lightning.
* Update API version to Winter 16.

Data export
-----------
* New simplified layout, that can handle larger amounts of data.

Show all data
-------------
* Allow opening the All Data window for any object or record from the developer console.
* Ability to show help text and description.
* Work around a bug in the tooling API introduced in Winter 16.
