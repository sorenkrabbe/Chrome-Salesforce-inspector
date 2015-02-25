function dataExport() {
  // Load a blank page and then inject the HTML to work around https://bugzilla.mozilla.org/show_bug.cgi?id=792479
  // An empty string as URL loads about:blank synchronously
  var popupWin;
  if (window.unsafeWindow && window.XPCNativeWrapper) {
    // Firefox
    // Use unsafeWindow to work around https://bugzilla.mozilla.org/show_bug.cgi?id=996069
    popupWin = new XPCNativeWrapper(unsafeWindow.open('', '', 'width=850,height=800,scrollbars=yes'));
  } else {
    // Chrome
    popupWin = open('', '', 'width=850,height=800,scrollbars=yes');
  }
  window.addEventListener("pagehide", function() {
    // All JS runs in the parent window, and will stop working when the parent goes away. Therefore close the popup.
    popupWin.close();
  });
  var document = popupWin.document;
  document.head.innerHTML = '\
  <title>Data Export</title>\
  <style>\
  body {\
    font-family: Arial, Helvetica, sans-serif;\
    font-size: 11px;\
    overflow: hidden;\
    margin-top: 0;\
  }\
  #user-info {\
    background-color: #1797c0;\
    color: white;\
    padding: .5em;\
    border-radius: 0 0 10px 10px;\
    margin-bottom: 8px;\
  }\
  textarea {\
    display:block;\
    width: 100%;\
    resize: vertical;\
    white-space: pre;\
    word-wrap: normal;\
    font-size: 11px;\
  }\
  textarea[hidden] {\
    display: none;\
  }\
  table {\
    border-collapse: collapse;\
  }\
  th, td {\
    text-align: left;\
    font-size: 11px;\
    border: 1px solid gray;\
    background-color: white;\
    white-space: pre;\
  }\
  #result-box {\
    margin-top: 3px;\
    overflow: auto;\
  }\
  #query {\
    height: 4em;\
    margin-top: 3px;\
  }\
  #result-text {\
    height: calc(100% - 2px);\
    resize: none;\
  }\
  .area {\
    background-color: #F8F8F8;\
    padding: 3px;\
    border-radius: 5px;\
    border: 1px solid #E0E3E5;\
    border-top: 3px solid #1797C0;\
  }\
  h1 {\
    font-size: 1.2em;\
    margin: 0px;\
    display: inline;\
  }\
  .action-arrow {\
    text-align: center;\
  }\
  .arrow-body {\
    background-color: green;\
    width: 100px;\
    margin: 0 auto;\
    padding-top: 5px;\
  }\
  .arrow-head{\
    border-left: 50px solid transparent;\
    border-right: 50px solid transparent;\
    border-top: 15px solid green;\
    width: 0;\
    margin: 0 auto -8px;\
    position: relative;\
  }\
  .area input[type="radio"], .area input[type="checkbox"] {\
    vertical-align: middle;\
    margin: 0 2px 0 0;\
  }\
  .area label {\
    padding-left: 10px;\
  }\
  #export-help-btn {\
    float: right;\
  }\
  #autocomplete-results {\
    white-space: pre;\
    overflow: hidden;\
  }\
  #autocomplete-results a {\
    padding-left: 5px;\
  }\
  #spinner {\
    position: absolute;\
    left: -15px;\
    top: -15px;\
  }\
  .cancel-btn {\
    float: right;\
    height: 1.3em;\
    border: 1px solid gray;\
  }\
  </style>\
  ';

  document.body.innerHTML = '\
  <img id="spinner" src="data:image/gif;base64,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" data-bind="visible: spinnerCount() > 0">\
  <div id="user-info" data-bind="text: userInfo"></div>\
  <div class="area">\
    <h1>Export query</h1>\
    <label><input type="checkbox" data-bind="checked: queryAll, disable: queryTooling"> Include deleted and archived records?</label>\
    <label title="With the tooling API you can query more metadata, but you cannot query regular data"><input type="checkbox" data-bind="checked: queryTooling, disable: queryAll"> Use Tooling API?</label>\
    <a href="about:blank" id="export-help-btn" data-bind="click: toggleHelp">Export help</a>\
    <textarea id="query" data-bind="style: {maxHeight: (winInnerHeight() - 200) + \'px\'}">select Id from Account</textarea>\
    <div id="autocomplete-results"><span data-bind="text: autocompleteTitle"></span><span data-bind="foreach: autocompleteResults"><a data-bind="text: value, attr: {title: title}, click: $parent.autocompleteClick" href="about:blank"></a></span></div>\
    <div data-bind="visible: showHelp">\
      <p>Use for quick one-off data exports.</p>\
      <ul>\
        <li>Enter a <a href="http://www.salesforce.com/us/developer/docs/soql_sosl/" target="_blank">SOQL query</a> in the box above</li>\
        <li>Select your output format</li>\
        <li>Press Export</li>\
      </ul>\
      <p>Supports the full SOQL language. The columns in the CSV output depend on the returned data. Using subqueries may cause the output to grow rapidly. Bulk API is not supported. Large data volumes may freeze or crash your browser.</p>\
    </div>\
  </div>\
  <div class="action-arrow">\
    <div class="arrow-body"><button data-bind="disable: exportResultVm().isWorking, click: doExport">Export</button></div>\
    <div class="arrow-head"></div>\
  </div>\
  <div class="area" id="result-area">\
    <h1>Export result</h1>\
    <label><input type=radio name="data-format" value="table" data-bind="checked: dataFormat"> Table</label>\
    <label><input type=radio name="data-format" value="excel" data-bind="checked: dataFormat"> Excel</label>\
    <label><input type=radio name="data-format" value="csv" data-bind="checked: dataFormat"> CSV</label>\
    <label><input type=radio name="data-format" value="json" data-bind="checked: dataFormat"> JSON</label>\
    <button class="cancel-btn" data-bind="visible: exportResultVm().isWorking, click: stopExport">Stop</button>\
    <div id="result-box" data-bind="style: {height: (winInnerHeight() - resultBoxOffsetTop() - 25) + \'px\'}">\
      <textarea id="result-text" readonly data-bind="text: exportResultVm().resultText, visible: !exportResultVm().resultTable"></textarea>\
      <table data-bind="dom: exportResultVm().resultTable, visible: exportResultVm().resultTable"></table>\
    </div>\
  </div>\
  ';

  var exportResult = ko.observable({isWorking: false, exportStatus: "", exportedRecords: [], exportedTooling: false});

  var vm = {
    spinnerCount: ko.observable(0),
    showHelp: ko.observable(false),
    userInfo: ko.observable("..."),
    winInnerHeight: ko.observable(0),
    resultBoxOffsetTop: ko.observable(0),
    queryAll: ko.observable(false),
    queryTooling: ko.observable(false),
    autocompleteTitle: ko.observable("\u00A0"),
    autocompleteResults: ko.observable([]),
    dataFormat: ko.observable("excel"),
    autocompleteClick: null,
    exportResultVm: ko.computed(computeExportResultVm),
    toggleHelp: function() {
      vm.showHelp(!vm.showHelp());
    },
    doExport: doExport,
    stopExport: stopExport
  };

  ko.applyBindings(vm, document.documentElement);

  function spinFor(promise) {
    vm.spinnerCount(vm.spinnerCount() + 1);
    promise.then(stopSpinner, stopSpinner);
  }
  function stopSpinner() {
    vm.spinnerCount(vm.spinnerCount() - 1);
  }

  /**
   * sobjectDescribes is a map.
   * Keys are lowercased sobject API names.
   * Values are DescribeGlobalSObjectResult objects with two extra properties:
   *   - The "fields" property contains and array of DescribeFieldResult objects of all fields on the given sobject.
   *     The "fields" property does not exist if fields are not yet loaded.
   *   - The "fieldsRequest" contains a boolean, which is true if fields are loaded or a request to load them is in progress.
   */
  var sobjectDataDescribes = {};
  var sobjectToolingDescribes = {};
  function maybeGetFields(sobjectDescribe) {
    if (sobjectDescribe && !sobjectDescribe.fields && !sobjectDescribe.fieldsRequest) {
      console.log("getting fields for " + sobjectDescribe.name);
      sobjectDescribe.fieldsRequest = true;
      spinFor(askSalesforce(sobjectDescribe.urls.describe).then(function(res) {
        sobjectDescribe.fields = res.fields;
        queryAutocompleteHandler();
      }, function() {
        sobjectDescribe.fieldsRequest = false; // Request failed, allow trying again
      }));
    }
  }
  spinFor(askSalesforce("/services/data/v33.0/sobjects/").then(function(res) {
    res.sobjects.forEach(function(sobjectDescribe) {
      sobjectDataDescribes[sobjectDescribe.name.toLowerCase()] = sobjectDescribe;
    });
    queryAutocompleteHandler();
  }));
  spinFor(askSalesforce("/services/data/v33.0/tooling/sobjects/").then(function(res) {
    res.sobjects.forEach(function(sobjectDescribe) {
      sobjectToolingDescribes[sobjectDescribe.name.toLowerCase()] = sobjectDescribe;
    });
    queryAutocompleteHandler();
  }));

  spinFor(askSalesforceSoap('<getUserInfo/>').then(function(res) {
    vm.userInfo(res.querySelector("Body userFullName").textContent + " / " + res.querySelector("Body userName").textContent + " / " + res.querySelector("Body organizationName").textContent);
  }));

  var queryInput = document.querySelector("#query");

  var resultBox = document.querySelector("#result-box");
  function recalculateHeight() {
    vm.resultBoxOffsetTop(resultBox.offsetTop);
  }
  queryInput.addEventListener("mousemove", recalculateHeight);
  popupWin.addEventListener("mouseup", recalculateHeight);
  popupWin.addEventListener("resize", function() {
    vm.winInnerHeight(popupWin.innerHeight);
    recalculateHeight(); // a resize event is fired when the window is opened after resultBox.offsetTop has been initialized, so initializes vm.resultBoxOffsetTop
  });

  /**
   * SOQL query autocomplete handling.
   * Put caret at the end of a word or select some text to autocomplete it.
   * Searches for both label and API name.
   * Autocompletes sobject names after the "from" keyword.
   * Autocompletes field names, if the "from" keyword exists followed by a valid object name.
   * Supports relationship fields.
   * Autocompletes picklist values.
   * Does not yet support subqueries.
   */
  function queryAutocompleteHandler() {
    var sobjectDescribes = vm.queryTooling() ? sobjectToolingDescribes : sobjectDataDescribes;
    var query = queryInput.value;
    var selStart = queryInput.selectionStart;
    var selEnd = queryInput.selectionEnd;

    vm.autocompleteTitle("\u00A0");
    vm.autocompleteResults([]);
    vm.autocompleteClick = function(item) {
      queryInput.focus();
      queryInput.setRangeText(item.value, selStart, selEnd, "end");
      queryAutocompleteHandler();
    };

    // Find out what sobject we are querying, by using the word after the "from" keyword.
    // Assuming no subqueries, we should find the correct sobjectName. There should be only one "from" keyword, and strings (which may contain the word "from") are only allowed after the real "from" keyword.
    var sobjectName = (/(^|\s)from\s*([a-zA-Z0-9_]*)/.exec(query) || ["", "", ""])[2];
    var sobjectDescribe = sobjectDescribes[sobjectName.toLowerCase()];
    maybeGetFields(sobjectDescribe);

    // Find the token we want to autocomplete. This is the selected text, or the last word before the cursor.
    var searchTerm = (selStart != selEnd
      ? query.substring(selStart, selEnd)
      : query.substring(0, selStart).match(/[a-zA-Z0-9_]*$/)[0]).toLowerCase();
    selStart = selEnd - searchTerm.length;

    // If we are just after the "from" keyword, autocomplete the sobject name
    if (query.substring(0, selStart).match(/(^|\s)from\s*$/)) {
      var ar = [];
      for (var sName in sobjectDescribes) {
        var sobjectDescribe = sobjectDescribes[sName];
        if (sobjectDescribe.name.toLowerCase().indexOf(searchTerm) > -1 || sobjectDescribe.label.toLowerCase().indexOf(searchTerm) > -1) {
          ar.push({value: sobjectDescribe.name, title: sobjectDescribe.label});
        }
      }
      vm.autocompleteTitle("Objects:");
      vm.autocompleteResults(ar);
      return;
    }

    if (sobjectDescribe && sobjectDescribe.fields) {

      /*
       * The context of a field is used to support queries on relationship fields.
       *
       * For example: If the cursor is at the end of the query "select Id from Contact where Account.Owner.Usern"
       * then the the searchTerm we want to autocomplete is "Usern", the contextPath is "Account.Owner." and the sobjectName is "Contact"
       *
       * When autocompleting picklist values in the query "select Id from Contact where Account.Type = 'Cus"
       * then the searchTerm we want to autocomplete is "Cus", the fieldName is "Type", the contextPath is "Account." and the sobjectName is "Contact"
       */

      var contextEnd = selStart;

      // If we are within a string, autocomplete picklist values
      var isInString = query.substring(0, selStart).match(/\s*[<>=!]+\s*'([^' ]*)$/);
      var fieldName = null;
      if (isInString) {
        var fieldEnd = selStart - isInString[0].length;
        fieldName = query.substring(0, fieldEnd).match(/[a-zA-Z0-9_]*$/)[0].toLowerCase();
        contextEnd = fieldEnd - fieldName.length;
        selStart -= isInString[1].length;
      }

      /*
      contextSobjectDescribes is a set of describe results for the relevant context sobjects.
      Example: "select Subject, Who.Name from Task"
      The context sobjects for "Subject" is {"Task"}.
      The context sobjects for "Who" is {"Task"}.
      The context sobjects for "Name" is {"Contact", "Lead"}.
      */
      var contextSobjectDescribes = [sobjectDescribe];
      var contextPath = query.substring(0, contextEnd).match(/[a-zA-Z0-9_\.]*$/)[0].toLowerCase();
      if (contextPath) {
        var contextFields = contextPath.split(".");
        contextFields.pop(); // always empty
        contextFields.forEach(function(referenceFieldName) {
          var newContextSobjectDescribes = new Set();
          contextSobjectDescribes.forEach(function(sobjectDescribe) {
            sobjectDescribe.fields
              .filter(function(field) { return field.relationshipName && field.relationshipName.toLowerCase() == referenceFieldName; })
              .forEach(function(field) {
                field.referenceTo.forEach(function(referencedSobjectName) {
                  var referencedSobjectDescribe = sobjectDescribes[referencedSobjectName.toLowerCase()];
                  maybeGetFields(referencedSobjectDescribe);
                  if (referencedSobjectDescribe && referencedSobjectDescribe.fields) {
                    newContextSobjectDescribes.add(referencedSobjectDescribe);
                  }
                });
              });
          });
          contextSobjectDescribes = [];
          newContextSobjectDescribes.forEach(function(d) { contextSobjectDescribes.push(d); });
        });
      }

      if (contextSobjectDescribes.length > 0) {
        if (isInString) {
          // Autocomplete picklist values
          var fieldNames = contextSobjectDescribes
            .map(function(sobjectDescribe) {
              return sobjectDescribe.fields
                .filter(function(field) { return field.name.toLowerCase() == fieldName; })
                .map(function(field) { return sobjectDescribe.name + "." + field.name; })
                .join(", ");
            })
            .join(", ");
          var ar = [];
          contextSobjectDescribes.forEach(function(sobjectDescribe) {
            sobjectDescribe.fields
              .filter(function(field) { return field.name.toLowerCase() == fieldName; })
              .forEach(function(field) {
                field.picklistValues
                  .filter(function(pickVal) { return pickVal.value.toLowerCase().indexOf(searchTerm) > -1 || pickVal.label.toLowerCase().indexOf(searchTerm) > -1; })
                  .forEach(function(pickVal) {
                    ar.push({value: pickVal.value, title: pickVal.label});
                  });
              });
          });
          vm.autocompleteTitle((fieldNames || "Field") + " values:");
          vm.autocompleteResults(ar);
        } else {
          // Autocomplete field names
          var ar = [];
          contextSobjectDescribes.forEach(function(sobjectDescribe) {
            sobjectDescribe.fields
              .filter(function(field) { return field.name.toLowerCase().indexOf(searchTerm) > -1 || field.label.toLowerCase().indexOf(searchTerm) > -1; })
              .forEach(function(field) {
                ar.push({value: field.name, title: field.label});
                if (field.type == "reference") {
                  ar.push({value: field.relationshipName + ".", title: field.label});
                }
              });
          });
          vm.autocompleteTitle(contextSobjectDescribes.map(function(sobjectDescribe) { return sobjectDescribe.name; }).join(", ") + " fields:");
          vm.autocompleteResults(ar);
        }
      }
    }
  }
  queryInput.addEventListener("input", queryAutocompleteHandler);
  queryInput.addEventListener("select", queryAutocompleteHandler);
  // There is no event for when caret is moved without any selection or value change, so use keyup and mouseup for that.
  queryInput.addEventListener("keyup", queryAutocompleteHandler);
  queryInput.addEventListener("mouseup", queryAutocompleteHandler);

  function computeExportResultVm() {
    if (exportResult().exportStatus != null) {
      return {
        isWorking: exportResult().isWorking,
        resultText: exportResult().exportStatus
      };
    }
    var expRecords = exportResult().exportedRecords;
    var exportAsJson = vm.dataFormat() == "json";
    if (exportAsJson) {
      return {
        isWorking: exportResult().isWorking,
        resultText: JSON.stringify(expRecords, null, "  ")
      };
    }
    var table = [];
    /*
    Discover what columns should be in our CSV file.
    We don't want to build our own SOQL parser, so we discover the columns based on the data returned.
    This means that we cannot find the columns of cross-object relationships, when the relationship field is null for all returned records.
    We don't care, because we don't need a stable set of columns for our use case.
    */
    var header = [];
    for (var i = 0; i < expRecords.length; i++) {
      var record = expRecords[i];
      function discoverColumns(record, prefix) {
        for (var field in record) {
          if (field == "attributes") {
            continue;
          }
          var column = prefix + field;
          if (header.indexOf(column) < 0) {
            header.push(column);
          }
          if (typeof record[field] == "object" && record[field] != null) {
            discoverColumns(record[field], column + ".");
          }
        }
      }
      discoverColumns(record, "");
    }
    table.push(header);
    /*
    Now we have the columns, we add the records to the CSV table.
    */
    for (var i = 0; i < expRecords.length; i++) {
      var record = expRecords[i];
      var row = [];
      for (var c = 0; c < header.length; c++) {
        var column = header[c].split(".");
        var value = record;
        for (var f = 0; f < column.length; f++) {
          var field = column[f];
          if (typeof value != "object") {
            value = null;
          }
          if (value != null) {
            value = value[field];
          }
        }
        if (typeof value == "object" && value != null && value.attributes && value.attributes.type) {
          value = "[" + value.attributes.type + "]";
        }
        row.push(value);
      }
      table.push(row);
    }
    if (vm.dataFormat() == "table") {
      // Here we do raw DOM manipulation. Consider refactoring into using Knockout.js data binding.
      var trs = [];
      for (var r = 0; r < table.length; r++) {
        var row = table[r];
        var tr = document.createElement("tr");
        if (true) {
          var td = document.createElement(r == 0 ? "th" : "td");
          if (r == 0) {
            td.textContent = "+";
          } else {
            var a = document.createElement("a");
            a.href = "about:blank";
            a.textContent = "+";
            a.title = "Show all data";
            a.sfRecordAttributes = expRecords[r - 1].attributes;
            a.addEventListener("click", function(e) {
              e.preventDefault();
              showAllData({recordAttributes: e.target.sfRecordAttributes, useToolingApi: exportResult().exportedTooling});
            });
            td.appendChild(a);
          }
          tr.appendChild(td);
        }
        row.forEach(function(cell) {
          var td = document.createElement(r == 0 ? "th" : "td");
          td.textContent = cell;
          tr.appendChild(td);
        });
        trs.push(tr);
      }
      return {
        isWorking: exportResult().isWorking,
        resultTable: trs
      };
    } else {
      var separator = vm.dataFormat() == "excel" ? "\t" : ",";
      return {
        isWorking: exportResult().isWorking,
        resultText: csvSerialize(table, separator)
      };
    }
  }

  vm.queryTooling.subscribe(function() {
    queryAutocompleteHandler();
  });

  var exportProgress = {};
  function doExport() {
    var exportedTooling = vm.queryTooling();
    var exportedRecords = [];
    exportResult({
      isWorking: true,
      exportStatus: "Exporting...",
      exportedRecords: exportedRecords,
      exportedTooling: exportedTooling
    });
    var query = queryInput.value;
    var queryMethod = exportedTooling ? 'tooling/query' : vm.queryAll() ? 'queryAll' : 'query';
    spinFor(askSalesforce('/services/data/v33.0/' + queryMethod + '/?q=' + encodeURIComponent(query), exportProgress).then(function queryHandler(data) {
      exportedRecords = exportedRecords.concat(data.records);
      if (!data.done) {
        exportResult({
          isWorking: true,
          exportStatus: "Exporting... Completed " + exportedRecords.length + " of " + data.totalSize + " records.",
          exportedRecords: exportedRecords,
          exportedTooling: exportedTooling
        });
        return askSalesforce(data.nextRecordsUrl, exportProgress).then(queryHandler);
      }
      if (exportedRecords.length == 0) {
        exportResult({
          isWorking: false,
          exportStatus: data.totalSize > 0 ? "No data exported. " + data.totalSize + " record(s)." : "No data exported.",
          exportedRecords: exportedRecords,
          exportedTooling: exportedTooling
        });
        return null;
      }
      exportResult({
        isWorking: false,
        exportStatus: null,
        exportedRecords: exportedRecords,
        exportedTooling: exportedTooling
      });
      return null;
    }, function(xhr) {
      if (!xhr || xhr.readyState != 4) {
        throw xhr; // Not an HTTP error response
      }
      var data = JSON.parse(xhr.responseText);
      var text = "=== ERROR ===\n";
      for (var i = 0; i < data.length; i++) {
        text += data[i].message + "\n";
      }
      exportResult({
        isWorking: false,
        exportStatus: text,
        exportedRecords: exportedRecords,
        exportedTooling: exportedTooling
      });
      return null;
    }).then(null, function(error) {
      console.error(error);
      exportResult({
        isWorking: false,
        exportStatus: "UNEXPECTED EXCEPTION:" + error,
        exportedRecords: exportedRecords,
        exportedTooling: exportedTooling
      });
    }));
  }

  function stopExport() {
    exportProgress.abort({records: [], done: true, totalSize: 0});
  }

  function csvSerialize(table, separator) {
    return table.map(function(row) { return row.map(function(text) { return "\"" + ("" + (text == null ? "" : text)).replace("\"", "\"\"") + "\""; }).join(separator); }).join("\r\n");
  }

}