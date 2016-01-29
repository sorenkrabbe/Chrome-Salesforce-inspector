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
