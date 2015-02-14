function dataImport() {
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
  <title>Data Import</title>\
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
  }\
  #result-box {\
    margin-top: 3px;\
    overflow: auto;\
  }\
  #data {\
    height:17em;\
    margin-top: 3px;\
  }\
  #import-result {\
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
  .area label {\
    font-weight: bold;\
    color: #4a4a56;\
    padding-left: 15px;\
  }\
  #import-help-btn {\
    float: right;\
    margin-top: 3px;\
  }\
  #spinner {\
    position: absolute;\
    left: -15px;\
    top: -15px;\
  }\
  </style>\
  ';

  document.body.innerHTML = '\
  <img id="spinner" src="data:image/gif;base64,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" hidden>\
  <div id="user-info">...</div>\
  <div class="area">\
    <h1>Input data</h1>\
    <label>Format: <select id="data-format"><option>Excel<option>CSV</select></label>\
    <label>Action: <select id="import-action"><option value="create">Insert<option value="update">Update<option value="delete">Delete</select></label>\
    <label>Object: <input type="text" value="Account" id="import-type" list="sobjectlist"></label>\
    <datalist id="sobjectlist"></datalist>\
    <a href="about:blank" id="import-help-btn">Import help</a>\
    <textarea id="data"></textarea>\
    <div id="import-help-box" hidden>\
      <p>Use for quick one-off data imports. Support is currently limited and may destroy your data.</p>\
      <ul>\
        <li>Enter your CSV or Excel data in the box above.\
          <ul>\
            <li>The input must contain a header row with field API names.</li>\
            <li>To use an external ID for a lookup field, the header row should contain the lookup relation name, the target sobject name and the external ID name separated by colons, e.g. "MyLookupField__r:MyObject__c:MyExternalIdField__c".</li>\
            <li>Empty cells insert null values.</li>\
            <li>Number, date, time and checkbox values must conform to the relevant <a href="http://www.w3.org/TR/xmlschema-2/#built-in-primitive-datatypes" target="_blank">XSD datatypes</a>.</li>\
            <li>Columns starting with an underscore are ignored.</li>\
          </ul>\
        </li>\
        <li>Select your input format</li>\
        <li>Select an action (insert, update or delete)</li>\
        <li>Enter the API name of the object to import</li>\
        <li>Press Import</li>\
      </ul>\
      <p>Upsert is not supported. Bulk API is not supported. Batching is not supported (everything goes into one batch). Large data volumes may freeze or crash your browser.</p>\
    </div>\
  </div>\
  <div class="action-arrow">\
    <div class="arrow-body"><button id="import-btn">Import</button><div style="color:white;font-weight:bold;font-size:1.4em;margin-top:.3em;text-shadow:2px 2px 3px red">BETA!</div></div>\
    <div class="arrow-head"></div>\
  </div>\
  <div class="area">\
    <h1>Import result</h1>\
    <div id="result-box">\
      <textarea id="import-result" readonly></textarea>\
    </div>\
  </div>\
  ';

  var dataInput = document.querySelector("#data");

  var resultBox = document.querySelector("#result-box");
  function recalculateHeight() {
    resultBox.style.height = (popupWin.innerHeight - resultBox.offsetTop - 25) + "px";
  }
  dataInput.addEventListener("mousemove", recalculateHeight);
  popupWin.addEventListener("mouseup", recalculateHeight);
  popupWin.addEventListener("resize", function() {
    dataInput.style.maxHeight = (popupWin.innerHeight - 200) + "px";
    recalculateHeight();
  });

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

  document.querySelector("#import-help-btn").addEventListener("click", function(e) {
    e.preventDefault();
    if (document.querySelector("#import-help-box").hasAttribute("hidden")) {
      document.querySelector("#import-help-box").removeAttribute("hidden");
    } else {
      document.querySelector("#import-help-box").setAttribute("hidden", "");
    }
  });

  spinFor(askSalesforce("/services/data/v32.0/sobjects/").then(function(res) {
    var list = document.querySelector("#sobjectlist");
    res.sobjects.forEach(function(sobjectDescribe) {
      var opt = document.createElement("option");
      opt.value = sobjectDescribe.name;
      list.appendChild(opt);
    });
  }));

  spinFor(askSalesforceSoap('<getUserInfo/>').then(function(res) {
    document.querySelector('#user-info').textContent = res.querySelector("Body userFullName").textContent + " / " + res.querySelector("Body userName").textContent + " / " + res.querySelector("Body organizationName").textContent;
  }));

  document.querySelector("#import-btn").addEventListener("click", function() {

    var text = dataInput.value;
    var separator = document.querySelector("#data-format").value == "Excel" ? "\t" : ",";
    var data;
    try {
      data = csvParse(text, separator);
    } catch (e) {
      console.log(e);
      document.querySelector("#import-result").value = "=== ERROR ===\n" + e.message;
      dataInput.setSelectionRange(e.offsetStart, e.offsetEnd);
      return;
    }

    if (data.length < 2) {
      document.querySelector("#import-result").value = "=== ERROR ===\nNo records to import";
      return;
    }

    var header = data.shift();
    var idColumn = -1;

    for (var c = 0; c < header.length; c++) {
      if (!/^[a-zA-Z0-9_]+(:[a-zA-Z0-9_]+:[a-zA-Z0-9_]+)?$/.test(header[c])) {
        document.querySelector("#import-result").value = "=== ERROR ===\nInvalid column name: " + header[c];
        return;
      }
      if (header[c].toLowerCase() == "id") {
        idColumn = c;
      }
    }

    var action = document.querySelector("#import-action").value;
    var sobjectType = document.querySelector("#import-type").value;

    if (!/^[a-zA-Z0-9_]+$/.test(sobjectType)) {
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
            var columnName = header[c].split(":");
            if (row[c].trim() == "") {
              var field = doc.createElement("fieldsToNull");
              if (columnName.length == 1) { // Our regexp ensures there are always one or three elements in the array
                field.textContent = columnName[0];
              } else {
                field.textContent = /__r$/.test(columnName[0]) ? columnName[0].replace(/__r$/, "__c") : columnName[0] + "Id";
              }
              sobjects.appendChild(field);
            } else {
              if (columnName.length == 1) { // Our regexp ensures there are always one or three elements in the array
                // For Mozilla reviewers: doc is a SOAP XML document.
                var field = doc.createElement(columnName[0]);
                field.textContent = row[c];
              } else {
                var subType = doc.createElement("type");
                subType.textContent = columnName[1];
                // For Mozilla reviewers: doc is a SOAP XML document.
                var subField = doc.createElement(columnName[2]);
                subField.textContent = row[c];
                // For Mozilla reviewers: doc is a SOAP XML document.
                var field = doc.createElement(columnName[0]);
                field.appendChild(subType);
                field.appendChild(subField);
              }
              sobjects.appendChild(field);
            }
          }
        }
        doc.documentElement.appendChild(sobjects);
      }
    }
    var xml = new XMLSerializer().serializeToString(doc);

    if (!popupWin.confirm("You are about to modify your data in Salesforce. This action cannot be undone.")) {
        return;
    }

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