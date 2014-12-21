function dataLoader() {
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
  <title>Data Loader</title>\
  <style>\
  body {\
    font-family: Arial, Helvetica, sans-serif;\
    font-size: 11px;\
  }\
  textarea {\
    display:block;\
    width: 100%;\
    resize: vertical;\
    white-space: pre;\
    word-wrap: normal;\
  }\
  #query {\
    height: 4em;\
  }\
  #data {\
    height:17em;\
  }\
  #import-result {\
    height:17em;\
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
  #export-help-btn, #import-help-btn {\
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
  .enable-import-box {\
    position: absolute;\
    bottom: 0;\
    left: 0;\
  }\
  </style>\
  ';

  document.body.innerHTML = '\
  <img id="spinner" src="data:image/gif;base64,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" hidden>\
  <div class="area">\
    <h1>Export query</h1>\
    <label><input type="checkbox" id="query-all"> Include deleted and archived records?</label>\
    <a href="about:blank" id="export-help-btn">Export help</a>\
    <textarea id="query">select Id from Account</textarea>\
    <div id="autocomplete-results">&nbsp;</div>\
    <div id="export-help-box" hidden>\
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
    <div class="arrow-body"><button id="export-btn">Export</button></div>\
    <div class="arrow-head"></div>\
  </div>\
  <div class="area">\
    <h1>Data</h1>\
    <label><input type=radio name="data-format" checked id="data-format-excel"> Excel</label>\
    <label><input type=radio name="data-format"> CSV</label>\
    <label><input type=radio name="data-format" id="data-format-json"> JSON</label>\
    <textarea id="data"></textarea>\
  </div>\
  <div class="action-arrow" id="import-arrow" hidden>\
    <div class="arrow-body"><button id="import-btn">Import</button><div style="color:white;font-weight:bold;font-size:1.4em;margin-top:.3em;text-shadow:2px 2px 3px red">BETA!</div></div>\
    <div class="arrow-head"></div>\
  </div>\
  <div class="area" id="import-area" hidden>\
    <h1>Import result</h1>\
    <label><input type=radio name="import-action" checked id="import-action-create"> Insert</label>\
    <label><input type=radio name="import-action" id="import-action-update"> Update</label>\
    <label><input type=radio name="import-action" id="import-action-delete"> Delete</label>\
    <label>Object: <input value="Account" id="import-type" list="sobjectlist"></label>\
    <datalist id="sobjectlist"></datalist>\
    <a href="about:blank" id="import-help-btn">Import help</a>\
    <textarea id="import-result"></textarea>\
    <div id="import-help-box" hidden>\
      <p>Use for quick one-off data imports. Support is currently limited and may destroy your data.</p>\
      <ul>\
        <li>Enter your CSV or Excel data in the middle box. The input must contain a header row with field API names. Empty cells insert null values. Number, date, time and checkbox values must conform to the relevant <a href="http://www.w3.org/TR/xmlschema-2/#built-in-primitive-datatypes" target="_blank">XSD datatypes</a>. Columns starting with an underscore are ignored.</li>\
        <li>Select your input format (only Excel and CSV is supported)</li>\
        <li>Select operation (insert, update or delete)</li>\
        <li>Enter the API name of the object to import</li>\
        <li>Press Import</li>\
      </ul>\
      <p>Upsert is not supported. Bulk API is not supported. Batching is not supported (everything goes into one batch). Large data volumes may freeze or crash your browser.</p>\
    </div>\
  </div>\
  <div class="enable-import-box">\
    <label><input type="checkbox" id="enable-import"> Enable import</label>\
  </div>\
  ';

  var spinnerCount = 0;
  function spinFor(promise) {
    spinnerCount++;
    document.querySelector("#spinner").removeAttribute("hidden");
    promise.then(stopSpinner, stopSpinner);
  }
  function stopSpinner() {
    spinnerCount--;
    if (spinnerCount == 0) {
      document.querySelector("#spinner").setAttribute("hidden", "");
    }
  }

  document.querySelector("#export-help-btn").addEventListener("click", function(e) {
    e.preventDefault();
    if (document.querySelector("#export-help-box").hasAttribute("hidden")) {
      document.querySelector("#export-help-box").removeAttribute("hidden");
    } else {
      document.querySelector("#export-help-box").setAttribute("hidden", "");
    }
  });
  document.querySelector("#import-help-btn").addEventListener("click", function(e) {
    e.preventDefault();
    if (document.querySelector("#import-help-box").hasAttribute("hidden")) {
      document.querySelector("#import-help-box").removeAttribute("hidden");
    } else {
      document.querySelector("#import-help-box").setAttribute("hidden", "");
    }
  });

  document.querySelector("#enable-import").checked = localStorage.getItem("insext-import-enabled");
  function toggleImportEnabled() {
    if (document.querySelector("#enable-import").checked) {
      document.querySelector("#import-arrow").removeAttribute("hidden");
      document.querySelector("#import-area").removeAttribute("hidden");
      localStorage.setItem("insext-import-enabled", "1");
    } else {
      document.querySelector("#import-arrow").setAttribute("hidden", "");
      document.querySelector("#import-area").setAttribute("hidden", "");
      localStorage.removeItem("insext-import-enabled");
    }
  }
  document.querySelector("#enable-import").addEventListener("change", toggleImportEnabled);
  toggleImportEnabled();

  /**
   * sobjectDescribes is a map.
   * Keys are lowercased sobject API names.
   * Values are DescribeGlobalSObjectResult objects with two extra properties:
   *   - The "fields" property contains and array of DescribeFieldResult objects of all fields on the given sobject.
   *     The "fields" property does not exist if fields are not yet loaded.
   *   - The "fieldsRequest" contains a boolean, which is true if fields are loaded or a request to load them is in progress.
   */
  var sobjectDescribes = {};
  function maybeGetFields(sobjectDescribe) {
    if (sobjectDescribe && !sobjectDescribe.fields && !sobjectDescribe.fieldsRequest) {
      console.log("getting fields for " + sobjectDescribe.name);
      sobjectDescribe.fieldsRequest = true;
      spinFor(askSalesforce(sobjectDescribe.urls.describe).then(function(responseText) {
        sobjectDescribe.fields = JSON.parse(responseText).fields;
        queryAutocompleteHandler();
      }, function() {
        sobjectDescribe.fieldsRequest = false; // Request failed, allow trying again
      }));
    }
  }

  var queryInput = document.querySelector("#query");

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
    var query = queryInput.value;
    var selStart = queryInput.selectionStart;
    var selEnd = queryInput.selectionEnd;

    var autocompleteResults = document.querySelector("#autocomplete-results");
    autocompleteResults.textContent = "\u00A0";
    function makeLink(value, title) {
      var res = document.createElement("a");
      res.textContent = value;
      res.title = title;
      res.href = "about:blank"; // The normal trick of using "#" to make the link activateable does not seem to work in an about:blank page in Firefox
      res.addEventListener('click', function(e) {
        e.preventDefault();
        var newValue = e.target.textContent;
        queryInput.focus();
        queryInput.setRangeText(newValue, selStart, selEnd, "end");
        queryAutocompleteHandler();
      });
      autocompleteResults.appendChild(res);
    }

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
      autocompleteResults.textContent = "Objects:";
      for (var sName in sobjectDescribes) {
        var sobjectDescribe = sobjectDescribes[sName];
        if (sobjectDescribe.name.toLowerCase().indexOf(searchTerm) > -1 || sobjectDescribe.label.toLowerCase().indexOf(searchTerm) > -1) {
          makeLink(sobjectDescribe.name, sobjectDescribe.label);
        }
      }
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
          autocompleteResults.textContent = (fieldNames || "Field") + " values:";
          contextSobjectDescribes.forEach(function(sobjectDescribe) {
            sobjectDescribe.fields
              .filter(function(field) { return field.name.toLowerCase() == fieldName; })
              .forEach(function(field) {
                field.picklistValues
                  .filter(function(pickVal) { return pickVal.value.toLowerCase().indexOf(searchTerm) > -1 || pickVal.label.toLowerCase().indexOf(searchTerm) > -1; })
                  .forEach(function(pickVal) {
                    makeLink(pickVal.value, pickVal.label);
                  });
              });
          });
        } else {
          // Autocomplete field names
          autocompleteResults.textContent = contextSobjectDescribes.map(function(sobjectDescribe) { return sobjectDescribe.name; }).join(", ") + " fields:";
          contextSobjectDescribes.forEach(function(sobjectDescribe) {
            sobjectDescribe.fields
              .filter(function(field) { return field.name.toLowerCase().indexOf(searchTerm) > -1 || field.label.toLowerCase().indexOf(searchTerm) > -1; })
              .forEach(function(field) {
                makeLink(field.name, field.label);
                if (field.type == "reference") {
                  makeLink(field.relationshipName + ".", field.label);
                }
              });
          });
        }
      }
    }
  }
  queryInput.addEventListener("input", queryAutocompleteHandler);
  queryInput.addEventListener("select", queryAutocompleteHandler);
  // There is no event for when caret is moved without any selection or value change, so use keyup and mouseup for that.
  queryInput.addEventListener("keyup", queryAutocompleteHandler);
  queryInput.addEventListener("mouseup", queryAutocompleteHandler);

  spinFor(askSalesforce("/services/data/v32.0/sobjects/").then(function(responseText) {
    var list = document.querySelector("#sobjectlist");
    JSON.parse(responseText).sobjects.forEach(function(sobjectDescribe) {
      var opt = document.createElement("option");
      opt.value = sobjectDescribe.name;
      list.appendChild(opt);
      sobjectDescribes[sobjectDescribe.name.toLowerCase()] = sobjectDescribe;
    });
  }));
  document.querySelector("#export-btn").addEventListener("click", function() {
    document.querySelector("#export-btn").disabled = true;
    document.querySelector("#data").value = "Exporting...";
    var query = document.querySelector("#query").value;
    var separator = document.querySelector("#data-format-excel").checked ? "\t" : ",";
    var exportAsJson = document.querySelector("#data-format-json").checked;
    var queryMethod = document.querySelector("#query-all").checked ? 'queryAll' : 'query';
    var records = [];
    spinFor(askSalesforce('/services/data/v32.0/' + queryMethod + '/?q=' + encodeURIComponent(query)).then(function queryHandler(responseText) {
      var data = JSON.parse(responseText);
      var text = "";
      records = records.concat(data.records);
      if (!data.done) {
        document.querySelector("#data").value = "Exporting... Completed " +records.length + " of " + data.totalSize + " records.";
        return askSalesforce(data.nextRecordsUrl).then(queryHandler);
      }
      if (exportAsJson) {
        return JSON.stringify(records);
      }
      if (records.length == 0) {
        text += "No data exported.";
        if (data.totalSize > 0) {
          text += " " + data.totalSize + " record(s)."
        }
      } else {
        var table = [];
        /*
        Discover what columns should be in our CSV file.
        We don't want to build our own SOQL parser, so we discover the columns based on the data returned.
        This means that we cannot find the columns of cross-object relationships, when the relationship field is null for all returned records.
        We don't care, because we don't need a stable set of columns for our use case.
        */
        var header = [];
        for (var i = 0; i < records.length; i++) {
          var record = records[i];
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
        for (var i = 0; i < records.length; i++) {
          var record = records[i];
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
        text = csvSerialize(table, separator);
        
        // Set the sobject type to import as the first exported sobject type
        try {
          document.querySelector("#import-type").value = records[0].attributes.type;
        } catch(e) {
          // Ignore errors
        }
      }
      return text;
    }, function(xhr) {
      if (!xhr || xhr.readyState != 4) {
        throw xhr; // Not an HTTP error response
      }
      var data = JSON.parse(xhr.responseText);
      var text = "=== ERROR ===\n";
      for (var i = 0; i < data.length; i++) {
        text += data[i].message + "\n";
      }
      return text;
    }).then(function(text) {
      document.querySelector("#data").value = text;
      document.querySelector("#export-btn").disabled = false;
    }, function(error) {
      console.error(error);
      document.querySelector("#data").value = "UNEXPECTED EXCEPTION:" + error;
      document.querySelector("#export-btn").disabled = false;
    }));
  });

  document.querySelector("#import-btn").addEventListener("click", function() {

    if (!popupWin.confirm("You are about to modify your data in Salesforce. This action cannot be undone.")) {
        return;
    }

    if (document.querySelector("#data-format-json").checked) {
      document.querySelector("#import-result").value = "=== ERROR ===\nImport from JSON not supported.";
      return;
    }

    var text = document.querySelector("#data").value;
    var separator = document.querySelector("#data-format-excel").checked ? "\t" : ",";
    var data;
    try {
      data = csvParse(text, separator);
    } catch (e) {
      console.log(e);
      document.querySelector("#import-result").value = "=== ERROR ===\n" + e.message;
      document.querySelector("#data").setSelectionRange(e.offsetStart, e.offsetEnd);
      return;
    }

    if (data.length < 2) {
      document.querySelector("#import-result").value = "=== ERROR ===\nNo records to import";
      return;
    }

    var header = data.shift();
    var idColumn = -1;

    var apiName = /^[a-zA-Z0-9_]+$/;
    for (var c = 0; c < header.length; c++) {
      if (!apiName.test(header[c])) {
        document.querySelector("#import-result").value = "=== ERROR ===\nInvalid column name: " + header[c];
        return;
      }
      if (header[c].toLowerCase() == "id") {
        idColumn = c;
      }
    }

    var action =
      document.querySelector("#import-action-create").checked ? "create"
      : document.querySelector("#import-action-update").checked ? "update"
      : document.querySelector("#import-action-delete").checked ? "delete"
      : null;
    var sobjectType = document.querySelector("#import-type").value;

    if (!apiName.test(sobjectType)) {
      document.querySelector("#import-result").value = "=== ERROR ===\nInvalid object name: " + sobjectType;
      return;
    }

    if (action != "create" && idColumn < 0) {
      document.querySelector("#import-result").value = "=== ERROR ===\nThere is no ID column";
      return;
    }

    var doc = window.document.implementation.createDocument(null, action);
    for (var r = 0; r < data.length; r++) {
      var row = data[r];
      if (action == "delete") {
        var deleteId = doc.createElement("ID");
        deleteId.textContent = row[idColumn];
        doc.documentElement.appendChild(deleteId);
      } else {
        var sobjects = doc.createElement("sObjects");
        var type = doc.createElement("type");
        type.textContent = sobjectType;
        sobjects.appendChild(type);
        for (var c = 0; c < row.length; c++) {
          if (header[c][0] != "_") {
            if (row[c].trim() == "") {
              var field = doc.createElement("fieldsToNull");
              field.textContent = header[c];
              sobjects.appendChild(field);
            } else {
              var field = doc.createElement(header[c]);
              field.textContent = row[c];
              sobjects.appendChild(field);
            }
          }
        }
        doc.documentElement.appendChild(sobjects);
      }
    }
    var xml = new XMLSerializer().serializeToString(doc);

    document.querySelector("#import-result").value = "Importing...";

    spinFor(askSalesforceSoap(xml).then(function(res) {
      var results = res.querySelectorAll("Body result");
      var successResults = [];
      var errorResults = [];
      header.push("__Id");
      header.push("__Errors");
      for (var i = 0; i < results.length; i++) {
        var result = results[i];
        var row = data[i];
        row.push(result.querySelector("id").textContent);
        var errorNodes = result.querySelectorAll("errors");
        var errors = [];
        for (var e = 0; e < errorNodes.length; e++) {
          var errorNode = errorNodes[e];
          var fieldNodes = errorNode.querySelectorAll("fields");
          var fields = [];
          for (var f = 0; f < fieldNodes.length; f++) {
            var fieldNode = fieldNodes[f];
            fields.push(fieldNode.textContent);
          }
          var error = errorNode.querySelector("statusCode").textContent + ": " + errorNode.querySelector("message").textContent + " [" + fields.join(", ") + "]";
          errors.push(error);
        }
        row.push(errors.join(", "));
        if (result.querySelector("success").textContent == "true") {
          successResults.push(row);
        } else {
          errorResults.push(row);
        }
      }
      var importResultText = "Import completed with " + successResults.length + " success(es) and " + errorResults.length + " error(s).";
      if (successResults.length > 0) {
        successResults.unshift(header);
        importResultText += "\n\nSuccesses:\n" + csvSerialize(successResults, separator);
      }
      if (errorResults.length > 0) {
        errorResults.unshift(header);
        importResultText += "\n\nErrors:\n" + csvSerialize(errorResults, separator);
      }
      document.querySelector("#import-result").value = importResultText+ "\n";
    }, function(xhr) {
      if (!xhr || xhr.readyState != 4) {
        throw xhr; // Not an HTTP error response
      }
      var soapFaults = xhr.responseXML.querySelectorAll("faultstring");
      var text = "=== ERROR ===\n";
      for (var i = 0; i < soapFaults.length; i++) {
        text += soapFaults[i].textContent + "\n";
      }
      document.querySelector("#import-result").value = text;
    }).catch(function(error) {
      console.error(error);
      document.querySelector("#import-result").value = "UNEXPECTED EXCEPTION: " + error;
    }));

  });

  function csvSerialize(table, separator) {
    return table.map(function(row) { return row.map(function(text) { return "\"" + ("" + (text == null ? "" : text)).replace("\"", "\"\"") + "\""; }).join(separator); }).join("\r\n");
  }

  function csvParse(csv, separator) {
    var table = [];
    var row = [];
    var offset = 0;
    while (true) {
      var text, next;
      if (offset != csv.length && csv[offset] == "\"") {
        next = csv.indexOf("\"", offset + 1);
        text = "";
        while (true) {
          if (next == -1) {
            throw {message: "Quote not closed", offsetStart: offset, offsetEnd: offset + 1};
          }
          text += csv.substring(offset + 1, next);
          offset = next + 1;
          if (offset == csv.length || csv[offset] != "\"") {
            break;
          }
          text += "\"";
          next = csv.indexOf("\"", offset + 1);
        }
      } else {
        next = csv.length;
        i = csv.indexOf(separator, offset);
        if (i != -1 && i < next) {
          next = i;
        }
        var i = csv.indexOf("\n", offset);
        if (i != -1 && i < next) {
          if (i > offset && csv[i - 1] == "\r") {
            next = i - 1;
          } else {
            next = i;
          }
        }
        text = csv.substring(offset, next);
        offset = next;
      }
      row.push(text);
      if (offset == csv.length) {
        if (row.length != 1 || row[0] != "") {
          table.push(row);
        }
        if (table.length == 0) {
          throw {message: "no data", offsetStart: 0, offsetEnd: csv.length};
        }
        var len = table[0].length;
        for (var i = 0; i < table.length; i++) {
          if (table[i].length != len) {
            throw {
              message: "row " + (i + 1) + " has " + table[i].length + " cells, expected " + len,
              offsetStart: csv.split("\n").slice(0, i).join("\n").length + 1,
              offsetEnd: csv.split("\n").slice(0, i + 1).join("\n").length
            };
          }
        }
        return table;
      } else if (csv[offset] == "\n") {
        offset++;
        table.push(row);
        row = [];
      } else if (csv[offset] == "\r" && offset + 1 < csv.length && csv[offset + 1] == "\n") {
        offset += 2;
        table.push(row);
        row = [];
      } else if (csv[offset] == separator) {
        offset++;
      } else {
        throw {message: "unexpected token '" + csv[offset] + "'", offsetStart: offset, offsetEnd: offset + 1};
      }
    }
  }
}