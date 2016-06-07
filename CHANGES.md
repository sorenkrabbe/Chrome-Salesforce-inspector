Version NEXT
============

General
-------
* The Inspector is now shown in regular tabs instead of popups. You can now choose if you want to open a link in the same tab (the default), or a new tab/window, using normal browser menus and shortcuts. Previously every link opened a new popup window.
* Restyled the Inspector menu to use Lightning Design. Restyling the rest will come later.
* Switched to a more robust API for getting the Salesforce session ID. It now works with all session security settings, and it works in Lightning Experience.
* Added a logo/icon.
* The salesforce hostname is now visible as a parameter in the URL bar.
* If you have an outdated browser version that is not supported by the latest version of Salesforce Inspector, Salesforce Inspector will not autoupdate.

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
