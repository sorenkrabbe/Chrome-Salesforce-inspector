"use strict";
if (!this.isUnitTest) {

var args = JSON.parse(atob(decodeURIComponent(location.search.substring(1))));
var options = args.options;
orgId = args.orgId;
initPopup(true);
chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
  session = message;
  var popupWin = window;

  var vm = apiExploreVm(options, popupWin);
  ko.applyBindings(vm, document.documentElement);
});

}

function apiExploreVm(options, popupWin) {
  options = options || {};
  options.apiUrl = options.apiUrl || "/services/data/";
  var defaultView = {name: "Loading", value: ""};
  var vm = {
    title: options.apiUrls ? options.apiUrls.length + " API requests, e.g. " + options.apiUrls[0] : options.apiUrl,
    spinnerCount: ko.observable(0),
    selectedTextView: ko.observable(defaultView),
    textViews: ko.observable([defaultView]),
    apiSubUrls: ko.observable([]),
    apiGroupUrls: ko.observable([]),
    openSubUrl: function(subUrl) {
      apiExplore({apiUrl: subUrl.apiUrl});
    },
    editSubUrl: function(subUrl) {
      var url = popupWin.prompt("REST API url", subUrl.apiUrl);
      if (url) {
        apiExplore({apiUrl: url});
      }
    },
    openGroupUrl: function(groupUrl) {
      apiExplore({apiUrls: groupUrl.apiUrls});
    }
  };
  function spinFor(promise) {
    vm.spinnerCount(vm.spinnerCount() + 1);
    promise.catch(function (e) { console.error("spinFor", e); }).then(stopSpinner, stopSpinner);
  }
  function stopSpinner() {
    vm.spinnerCount(vm.spinnerCount() - 1);
  }

  var apiPromise = options.apiUrls ? Promise.all(options.apiUrls.map(function(url) { return askSalesforce(url); })): askSalesforce(options.apiUrl);
  spinFor(Promise.all([apiPromise, askSalesforceSoap("/services/Soap/u/35.0", "urn:partner.soap.sforce.com", "<getUserInfo/>")]).then(function(results) {
    var result = results[0];
    var userInfo = results[1];

    /*
    Transform an arbitrary JSON structure (the `result` vaiable) into a list of two-dimensional TSV tables (the `textViews` variable), that can easily be copied into for example Excel.
    Each two-dimensional table corresponds to an array or set of related arrays in the JSON data.

    For example in a Sobject Describe, the list of fields is one table. Each row is a field, and each column is a property of that field.
    The list of picklist values is another table. Each column is a property of the picklist value, or a property of the field to which the picklist value belongs (i.e. a column inherited from the parent table).

    Map<String,TableView> tViews; // Map of all tables, keyed by the name of each table
    interface TableView {
      String name; // Name of the table, a JSON path that matches each row of the table
      TableView? parent; // For nested tables, contains a link to the parent table. A child table inherits all columns from its parent. Inherited columns are added to the end of a table.
      TableRow[] rows;
      Map<String,void> columnMap; // The set of all columns in this table, excluding columns inherited from the parent table
      String[] columnList; // The list of all columns in this table, including columns inherited from the parent table
    }
    interface TableRow {
      JsonValue value; // The value of the row, as a JSON structure not yet flattened into row format.
      TableRow parent; // For nested tables, contains a link to the corresponding row in the parent table. A child row inherits all columns from its parent. Inherited columns are added to the end of a row.
      any[] cells; // The list of all cells in this row, matching the columns in the table, including data inherited from the parent row
    }
    TextView[] textViews;
    interface TextView {
      String name; // Name of the table
      String value; // The table serialized in TSV format
      any[][]? table; // The table
    }

    In addition to building the table views of the JSON structure, we also scan it for values that look like API resource URLs, so we can display links to these.
    ApiSubUrl[] apiSubUrls;
    interface ApiSubUrl {
      String jsonPath; // The JSON path where the resource URL was found
      String apiUrl; // The URL
      String label; // A label describing the URL
    }

    We also group these URLs the same way we build tables, allowing the user to request all related resources in one go. For example, given a global describe result, the user can fetch object describes for all objects in one click.
    ApiGroupUrl[] apiGroupUrls;
    interface ApiGroupUrl {
      String jsonPath; // The JSON path where the resource URLs were found
      String[] apiUrls; // The related URLs
      String label; // A label describing the URLs
    }
    */

    // Recursively explore the JSON structure, discovering tables and their rows and columns.
    var apiSubUrls = [];
    var groupUrls = {};
    var textViews = [
      {name: "Raw JSON", value: JSON.stringify(result, null, "    ")}
    ];
    var tRow = {value: result, cells:[], parent:null}; // The root row
    var tViews = {
      "@": {name: "@", parent: null, rows: [tRow], columnMap: {}, columnList: []} // Dummy root table, always contains one row
    };
    exploreObject2(result, tRow, "", tViews["@"], "@");
    function exploreObject2(object /*JsonValue*/, tRow /*TableRow*/, columnName /*String, JSON path relative to tView.name*/, tView /*TableView*/, fullName /*String, JSON path including array indexes*/) {
      // Create the new column, if we have not created it already
      tView.columnMap[columnName] = true;

      if (object instanceof Array) {
        // Create a new table, if we have not created it already
        var childViewName = tView.name + columnName + ".*";
        var childView;
        tViews[childViewName] = childView = tViews[childViewName] || {name: childViewName, parent: tView, rows: [], columnMap: {}, columnList: []};

        for (var i = 0; i < object.length; i++) {
          if (object[i] && typeof object[i] == "object") {
            object[i]["#"] = i;
          }

          // Create the new row
          var childRow = {value: object[i], cells: [], parent: tRow};
          childView.rows.push(childRow);

          exploreObject2(object[i], childRow, "", childView, fullName + "." + i);
        }
      } else {
        if (object && typeof object == "object") {
          for (var key in object) {
            exploreObject2(object[key], tRow, columnName + "." + key, tView, fullName + "." + key);
          }
        }
      }

      if (typeof object == "string" && object.startsWith("/services/data/")) {
        apiSubUrls.push({jsonPath: fullName, apiUrl: object, label: object});
        if (tView.name != "@") {
          if (!groupUrls[tView.name + columnName]) {
            groupUrls[tView.name + columnName] = [];
          }
          groupUrls[tView.name + columnName].push(object);
        }
      }
    }

    // URLs to further explore the REST API, not grouped
    vm.apiSubUrls(apiSubUrls);

    // URLs to further explore the REST API, grouped by table columns
    var apiGroupUrls = [];
    for (var groupKey in groupUrls) {
      apiGroupUrls.push({jsonPath: groupKey, apiUrls: groupUrls[groupKey], label: groupUrls[groupKey].length + " API requests, e.g. " + groupUrls[groupKey][0]});
    }
    vm.apiGroupUrls(apiGroupUrls);

    // Build each of the discovered tables. Turn columns into a list, turn each row into a list matching the columns, and serialize as TSV.
    // Note that the tables are built in the order they are discovered. This means that a child table is always built after its parent table.
    // We can therefore re-use the build of the parent table when building the child table.
    for (var k in tViews) {
      var tView = tViews[k];
      // Add own columns
      for (var column in tView.columnMap) {
        tView.columnList.push(tView.name + column);
      }
      // Copy columns from parent table
      if (tView.parent) {
        for (var x = 0; x < tView.parent.columnList.length; x++) {
          var column = tView.parent.columnList[x];
          tView.columnList.push(column);
        }
      }
      var table = [tView.columnList];
      // Add rows
      for (var r = 0; r < tView.rows.length; r++) {
        var row = tView.rows[r];
        // Add cells to the row, matching the found columns
        for (var column in tView.columnMap) {
          // Find the value of the cell
          var fields = column.split(".");
          var value = row.value;
          for (var f = 1; f < fields.length; f++) {
            var field = fields[f];
            if (typeof value != "object") {
              value = null;
            }
            if (value != null) {
              value = value[field];
            }
          }
          if (value instanceof Array) {
            value = "[Array " + value.length + "]"
          }
          row.cells.push(value);
        }
        // Add columns from parent row
        if (row.parent) {
          for (var x = 0; x < row.parent.cells.length; x++) {
            var cell = row.parent.cells[x];
            row.cells.push(cell);
          }
        }
        table.push(row.cells);
      }
      var csvSignature = csvSerialize([
        ["Salesforce Inspector - REST API Explorer"],
        ["URL", vm.title],
        ["Rows", tView.name],
        ["Username", userInfo.querySelector("Body userName").textContent],
        ["Organization name", userInfo.querySelector("Body organizationName").textContent],
        ["Extract time", new Date().toISOString()]
      ], "\t") + "\r\n\r\n";
      textViews.push({name: "Rows: " + tView.name, value: csvSignature + csvSerialize(table, "\t"), table: table});
    }
    vm.textViews(textViews);
    // Don't update selectedTextView. No radio button will be selected, leaving the text area blank.
    // The results can be quite large and take a long time to render, so we only want to render a result once the user has explicitly selected it.
  }).catch(function(err) {
    console.error(err);
    vm.textViews([{name: "Error", value: (err && err.askSalesforceError) || err}]);
  }));

  function csvSerialize(table, separator) {
    return table.map(function(row) { return row.map(function(text) { return "\"" + ("" + (text == null ? "" : text)).split("\"").join("\"\"") + "\""; }).join(separator); }).join("\r\n");
  }

  return vm;
}