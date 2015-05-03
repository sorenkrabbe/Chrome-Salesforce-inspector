function apiExplore(options) {
  // Load a blank page and then inject the HTML to work around https://bugzilla.mozilla.org/show_bug.cgi?id=792479
  // An empty string as URL loads about:blank synchronously
  var popupWin;
  if (window.unsafeWindow && window.XPCNativeWrapper) {
    // Firefox
    // Use unsafeWindow to work around https://bugzilla.mozilla.org/show_bug.cgi?id=996069
    popupWin = new XPCNativeWrapper(unsafeWindow.open("", "", "width=900,height=800,scrollbars=yes"));
  } else {
    // Chrome
    popupWin = open("", "", "width=900,height=800,scrollbars=yes");
  }
  window.addEventListener("pagehide", function() {
    // All JS runs in the parent window, and will stop working when the parent goes away. Therefore close the popup.
    popupWin.close();
  });
  var document = popupWin.document;
  document.head.innerHTML = '\
  <title data-bind="text: title">Explore</title>\
  <style>\
  body {\
    font-family: Arial, Helvetica, sans-serif;\
    font-size: 11px;\
  }\
  select {\
    width: 100%;\
  }\
  textarea {\
    display:block;\
    width: 100%;\
    height: 15em;\
    resize: vertical;\
    word-wrap: normal;\
    font-size: 11px;\
  }\
  li:hover {\
    background-color: lightblue;\
  }\
  input[type=radio] {\
    margin: 0;\
    vertical-align: middle;\
  }\
  </style>\
  ';

  document.body.innerHTML = '\
  <textarea readonly data-bind="text: selectedTextView().value"></textarea>\
  <img id="spinner" src="data:image/gif;base64,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" data-bind="visible: spinnerCount() > 0">\
  <ul data-bind="foreach: textViews">\
    <li><label><input type="radio" name="textView" data-bind="value: $data, checked: $parent.selectedTextView"> <span data-bind="text: name"></span></label></li>\
  </ul>\
  <ul data-bind="foreach: apiGroupUrls">\
    <li><a href="about:blank" data-bind="text: jsonPath, click: $parent.openGroupUrl"></a> - <span data-bind="text: label"></span></li>\
  </ul>\
  <ul data-bind="foreach: apiSubUrls">\
    <li><a href="about:blank" data-bind="text: jsonPath, click: $parent.openSubUrl"></a> - <span data-bind="text: label"></span> <a href="about:blank" data-bind="click: $parent.editSubUrl">Edit</a></li>\
  </ul>\
  <a href="https://www.salesforce.com/us/developer/docs/api_rest/" target="_blank">REST API documentation</a>\
  ';

  var vm = apiExploreVm(options, popupWin);
  ko.applyBindings(vm, document.documentElement);
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
  spinFor(Promise.all([apiPromise, askSalesforceSoap("<getUserInfo/>")]).then(function(results) {
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
          object[i]["#"] = i;

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
      textViews.push({name: "Rows: " + tView.name, value: csvSignature + csvSerialize(table, "\t")});
    }
    vm.textViews(textViews);
    // Don't update selectedTextView. No radio button will be selected, leaving the text area blank.
    // The results can be quite large and take a long time to render, so we only want to render a result once the user has explicitly selected it.
  }).catch(function(xhr) {
    console.error(xhr);
    vm.textViews([{name: "Error", value: (xhr && xhr.responseText) || xhr}]);
  }));

  function csvSerialize(table, separator) {
    return table.map(function(row) { return row.map(function(text) { return "\"" + ("" + (text == null ? "" : text)).split("\"").join("\"\"") + "\""; }).join(separator); }).join("\r\n");
  }

  return vm;
}