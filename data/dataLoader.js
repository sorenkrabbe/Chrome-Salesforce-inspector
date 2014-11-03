function dataLoader() {
  // Load a blank page and then inject the HTML to work around https://bugzilla.mozilla.org/show_bug.cgi?id=792479
  // An empty string as URL loads about:blank synchronously
  var popupWin;
  if (window.unsafeWindow && window.XPCNativeWrapper) {
    // Firefox
    // Use unsafeWindow to work around https://bugzilla.mozilla.org/show_bug.cgi?id=996069
    popupWin = new XPCNativeWrapper(unsafeWindow.open('', '', 'width=850,height=800'));
  } else {
    // Chrome
    popupWin = open('', '', 'width=850,height=800');
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
  }\
  #query {\
    height: 4em;\
  }\
  #data {\
    height:10em;\
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
  </style>\
  ';

  document.body.innerHTML = '\
  <div class="area">\
    <h1>Export query</h1>\
    <label><input type="checkbox" id="query-all"> Include deleted and archived records?</label>\
    <textarea id="query">select Id from Account</textarea>\
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
  ';
  document.querySelector("#export-btn").addEventListener("click", function() {
    document.querySelector("#export-btn").disabled = true;
    document.querySelector("#data").value = "Exporting...";
    var query = document.querySelector("#query").value;
    var separator = document.querySelector("#data-format-excel").checked ? "\t" : ",";
    var exportAsJson = document.querySelector("#data-format-json").checked;
    var queryMethod = document.querySelector("#query-all").checked ? 'queryAll' : 'query';
    var records = [];
    askSalesforce('/services/data/v31.0/' + queryMethod + '/?q=' + encodeURIComponent(query)).then(function queryHandler(responseText) {
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
    }).then( function(text) {
      document.querySelector("#data").value = text;
      document.querySelector("#export-btn").disabled = false;
    }, function(error) {
      console.error(error);
      document.querySelector("#data").value = "UNEXPECTED EXCEPTION:" + error;
      document.querySelector("#export-btn").disabled = false;
    });
  });

  function csvSerialize(table, separator) {
    return table.map(function(row) { return row.map(function(text) { return "\"" + ("" + (text == null ? "" : text)).replace("\"", "\"\"") + "\""; }).join(separator); }).join("\r\n");
  }
}