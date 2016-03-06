"use strict";
if (!this.isUnitTest) {

var args = JSON.parse(atob(decodeURIComponent(location.search.substring(1))));
orgId = args.orgId;
initButton(true);
chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
  session = message;

  var vm = dataImportVm(copyToClipboard);
  ko.applyBindings(vm, document.documentElement);

  var resize = ko.observable({});
  window.addEventListener("resize", function() {
    resize({});
  });

  initScrollTable(
    document.querySelector("#result-box"),
    ko.computed(vm.importTableResult),
    ko.computed(function() { resize(); vm.showHelp(); return {}; })
  );

});

}

function dataImportVm(copyToClipboard) {

  var importData = ko.observable();

  var vm = {
    spinnerCount: ko.observable(0),
    showHelp: ko.observable(false),
    userInfo: ko.observable("..."),
    dataError: ko.observable(""),
    message: function() { return vm.dataFormat() == "excel" ? "Paste Excel data here" : "Paste CSV data here"; },
    dataPaste: function(_, e) {
      var text = e.clipboardData.getData("text/plain");
      vm.setData(text);
    },
    setData: function(text) {
      if (vm.isWorking()) {
        return false;
      }
      var separator = vm.dataFormat() == "excel" ? "\t" : ",";
      var data;
      try {
        data = csvParse(text, separator);
      } catch (e) {
        console.log(e);
        vm.dataError("Error: " + e.message);
        updateResult(null);
        return;
      }

      if (data.length < 2) {
        vm.dataError("Error: No records to import");
        updateResult(null);
        return;
      }
      vm.dataError("");
      var header = data.shift().map(makeColumn);
      updateResult(null); // Two updates, the first clears state from the scrolltable
      updateResult({header: header, data: data});
    },
    invalidInput: function() {
      // We should try to allow imports to succeed even if our validation logic does not exactly match the one in Salesforce.
      // We only hard-fail on errors that prevent us from building the API request.
      // When possible, we submit the request with errors and let Salesforce give a descriptive message in the response.
      return !vm.importIdColumnValid() || !importData().importTable || !importData().importTable.header.every(function(col) { return col.columnIgnore() || col.columnValid(); });
    },
    isWorking: function() {
      return vm.activeBatches() != 0 || vm.isProcessingQueue();
    },
    columns: function() {
      return importData().importTable && importData().importTable.header;
    },

    sobjectList: function() {
      return describeInfo.describeGlobal(vm.useToolingApi()).filter(function(sobjectDescribe) { return sobjectDescribe.createable || sobjectDescribe.deletable || sobjectDescribe.updateable; }).map(function(sobjectDescribe) { return sobjectDescribe.name; });
    },
    idLookupList: function() {
      var sobjectName = vm.importType();
      var sobjectDescribe = describeInfo.describeSobject(vm.useToolingApi(), sobjectName).sobjectDescribe;

      if (!sobjectDescribe) {
        return [];
      }
      return sobjectDescribe.fields.filter(function(field) { return field.idLookup; }).map(function(field) { return field.name; });
    },
    columnList: function() {
      var importAction = vm.importAction();

      var res = [];
      if (importAction == "delete") {
        res.push("Id");
      } else {
        var sobjectName = vm.importType();
        var useToolingApi = vm.useToolingApi();
        var sobjectDescribe = describeInfo.describeSobject(useToolingApi, sobjectName).sobjectDescribe;
        if (sobjectDescribe) {
          var idFieldName = vm.idFieldName();
          sobjectDescribe.fields.forEach(function(field) {
            if (field.createable || field.updateable) {
              res.push(field.name);
              field.referenceTo.forEach(function(referenceSobjectName) {
                var referenceSobjectDescribe = describeInfo.describeSobject(useToolingApi, referenceSobjectName).sobjectDescribe;
                if (referenceSobjectDescribe) {
                  referenceSobjectDescribe.fields.forEach(function(referenceField) {
                    if (referenceField.idLookup) {
                      res.push(field.relationshipName + ":" + referenceSobjectDescribe.name + ":" + referenceField.name);
                    }
                  });
                }
              });
            } else if (field.idLookup && field.name.toLowerCase() == idFieldName.toLowerCase()) {
              res.push(field.name);
            }
          });
        }
      }
      res.push("__Status");
      res.push("__Id");
      res.push("__Action");
      res.push("__Errors");
      return res;
    },
    useToolingApi: ko.observable(false),
    dataFormat: ko.observable("excel"),
    importAction: ko.observable("create"),
    importIdColumnValid: function() {
      return vm.importAction() == "create" || vm.inputIdColumnIndex() > -1;
    },
    importIdColumnError: function() {
      if (!vm.importIdColumnValid()) {
        return "Error: The field mapping has no '" + vm.idFieldName() + "' column";
      }
      return "";
    },
    importType: ko.observable("Account"),
    importTypeError: function() {
      var importType = vm.importType();
      if (!vm.sobjectList().some(function(s) { return s.toLowerCase() == importType.toLowerCase(); })) {
        return "Error: Unknown object";
      }
      return "";
    },
    externalId: ko.observable("Id"),
    externalIdError: function() {
      var externalId = vm.externalId();
      if (!vm.idLookupList().some(function(s) { return s.toLowerCase() == externalId.toLowerCase(); })) {
        return "Error: Unknown field or not an external ID";
      }
      return "";
    },
    idFieldName: function() {
      return vm.importAction() == "create" ? "" : vm.importAction() == "upsert" ? vm.externalId() : "Id";
    },
    inputIdColumnIndex: function() {
      var importTable = importData().importTable;
      if (!importTable) {
        return -1;
      }
      var idFieldName = vm.idFieldName();
      return importTable.header.findIndex(function(c) { return c.columnValue().toLowerCase() == idFieldName.toLowerCase(); });
    },
    batchSize: ko.observable("200"),
    batchSizeError: function() {
      if (!(+vm.batchSize() > 0)) { // This also handles NaN
        return "Error: Must be a positive number";
      }
      return "";
    },
    // If positive: The number of successful batches since the last failed batch
    // If negative: The number of failed batches since the last successful batch
    // Record level failures don't count
    batchMaxConcurrency: ko.observable(0),
    batchConcurrency: ko.observable("10"),
    batchConcurrencyError: function() {
      if (!(+vm.batchConcurrency() > 0)) { // This also handles NaN
        return "Error: Must be a positive number";
      }
      return "";
    },
    confirmPopup: ko.observable(null),
    activeBatches: ko.observable(0),
    isProcessingQueue: ko.observable(false),
    importState: ko.observable(null),
    showStatus: {
      Queued: ko.observable(true),
      Processing: ko.observable(true),
      Succeeded: ko.observable(true),
      Failed: ko.observable(true)
    },
    canCopy: function() {
      return importData().taggedRows != null;
    },
    copyAsExcel: function() {
      vm.copyResult("\t");
    },
    copyAsCsv: function() {
      vm.copyResult(",");
    },
    copyResult: function(separator) {
      var header = importData().importTable.header.map(c => c.columnValue());
      var data = importData().taggedRows.filter(row => vm.showStatus[row.status]()).map(row => row.cells);
      copyToClipboard(csvSerialize([header].concat(data), separator));
    },
    importCounts: function() {
      return importData().counts;
    },
    importTableResult: function() {
      if (importData().taggedRows == null) {
        return null;
      }
      var header = importData().importTable.header.map(c => c.columnValue());
      var data = importData().taggedRows.map(row => row.cells);
      return {
        table: [header].concat(data),
        isTooling: undefined, // Only used in data export
        rowVisibilities: [true].concat(importData().taggedRows.map(row => vm.showStatus[row.status]())),
        colVisibilities: header.map(c => true)
      };
    },
    confirmPopupYes: function() {
      vm.confirmPopup(null);

      var header = importData().importTable.header;
      var data = importData().importTable.data;

      var statusColumnIndex = header.findIndex(function(c) { return c.columnValue().toLowerCase() == "__status"; });
      if (statusColumnIndex == -1) {
        statusColumnIndex = header.length;
        header.push(makeColumn("__Status"));
        data.forEach(function(row) {
          row.push("");
        });
      }
      var resultIdColumnIndex = header.findIndex(function(c) { return c.columnValue().toLowerCase() == "__id"; });
      if (resultIdColumnIndex == -1) {
        resultIdColumnIndex = header.length;
        header.push(makeColumn("__Id"));
        data.forEach(function(row) {
          row.push("");
        });
      }
      var actionColumnIndex = header.findIndex(function(c) { return c.columnValue().toLowerCase() == "__action"; });
      if (actionColumnIndex == -1) {
        actionColumnIndex = header.length;
        header.push(makeColumn("__Action"));
        data.forEach(function(row) {
          row.push("");
        });
      }
      var errorColumnIndex = header.findIndex(function(c) { return c.columnValue().toLowerCase() == "__errors"; });
      if (errorColumnIndex == -1) {
        errorColumnIndex = header.length;
        header.push(makeColumn("__Errors"));
        data.forEach(function(row) {
          row.push("");
        });
      }
      data.forEach(function(row) {
        if (["queued", "processing", ""].indexOf(row[statusColumnIndex].toLowerCase()) > -1) {
          row[statusColumnIndex] = "Queued";
        }
      });
      updateResult(importData().importTable);
      vm.importState({
        statusColumnIndex: statusColumnIndex,
        resultIdColumnIndex: resultIdColumnIndex,
        actionColumnIndex: actionColumnIndex,
        errorColumnIndex: errorColumnIndex,
        importAction: vm.importAction(),
        useToolingApi: vm.useToolingApi(),
        sobjectType: vm.importType(),
        idFieldName: vm.idFieldName(),
        inputIdColumnIndex: vm.inputIdColumnIndex()
      });

      vm.isProcessingQueue(true);
      vm.batchMaxConcurrency(1);
      executeBatch();
    },
    confirmPopupNo: function() {
      vm.confirmPopup(null);
    },
    toggleHelp: function() {
      vm.showHelp(!vm.showHelp());
    },
    showDescribeUrl: function() {
      return showAllDataUrl({
        recordAttributes: {type: vm.importType(), url: null},
        useToolingApi: vm.useToolingApi()
      });
    },
    doImport: function() {
      var importedRecords = importData().counts.Queued + importData().counts.Processing;
      var skippedRecords = importData().counts.Succeeded + importData().counts.Failed;
      vm.confirmPopup({
        text: importedRecords + " records will be imported."
          + (skippedRecords > 0 ? " " + skippedRecords + " records will be skipped because they have __Status Succeeded or Failed." : "")
      });
    },
    toggleProcessing: function() {
      vm.isProcessingQueue(!vm.isProcessingQueue());
    },
    retryFailed: function() {
      if (!importData().importTable) {
        return;
      }
      var statusColumnIndex = importData().importTable.header.findIndex(function(c) { return c.columnValue().toLowerCase() == "__status"; });
      if (statusColumnIndex < 0) {
        return;
      }
      importData().taggedRows.forEach(function(row) {
        if (row.status == "Failed") {
          row.cells[statusColumnIndex] = "Queued";
        }
      });
      updateResult(importData().importTable);
      executeBatch();
    }
  };
  updateResult(null);
  function updateResult(importTable) {
    var counts = {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0};
    if (!importTable) {
      importData({
        importTable: null,
        counts: counts,
        taggedRows: null
      });
      return;
    }
    var statusColumnIndex = importTable.header.findIndex(function(c) { return c.columnValue().toLowerCase() == "__status"; });
    var taggedRows = [];
    importTable.data.forEach(function(cells) {
      var status = statusColumnIndex < 0 ? "Queued"
        : cells[statusColumnIndex].toLowerCase() == "queued" ? "Queued"
        : cells[statusColumnIndex].toLowerCase() == "" ? "Queued"
        : cells[statusColumnIndex].toLowerCase() == "processing" && !vm.isWorking() ? "Queued"
        : cells[statusColumnIndex].toLowerCase() == "processing" ? "Processing"
        : cells[statusColumnIndex].toLowerCase() == "succeeded" ? "Succeeded"
        : "Failed";
      counts[status]++;
      taggedRows.push({status: status, cells: cells});
    });
    importData({
      importTable: importTable,
      counts: counts,
      taggedRows: taggedRows
    });
  }

  function spinFor(promise) {
    vm.spinnerCount(vm.spinnerCount() + 1);
    promise.catch(function (e) { console.error("spinFor", e); }).then(stopSpinner, stopSpinner);
  }
  function stopSpinner() {
    vm.spinnerCount(vm.spinnerCount() - 1);
  }

  var describeInfo = new DescribeInfo(spinFor);
  spinFor(askSalesforceSoap("/services/Soap/u/" + apiVersion, "urn:partner.soap.sforce.com", "<getUserInfo/>").then(function(res) {
    vm.userInfo(res.querySelector("Body userFullName").textContent + " / " + res.querySelector("Body userName").textContent + " / " + res.querySelector("Body organizationName").textContent);
  }));

  var xmlName = /^[a-zA-Z_][a-zA-Z0-9_]*$/; // A (subset of a) valid XML name
  function makeColumn(column) {
    var columnVm = {
      columnValue: ko.observable(column),
      columnIgnore: function() { return columnVm.columnValue().startsWith("_"); },
      columnSkip: function() {
        columnVm.columnValue("_" + columnVm.columnValue());
      },
      columnValid: function() {
        var columnName = columnVm.columnValue().split(":");
        // Ensure there are 1 or 3 elements, so we know if we should treat it as a normal field or an external ID
        if (columnName.length != 1 && columnName.length != 3) {
          return false;
        }
        // Ensure that createElement will not throw, see https://dom.spec.whatwg.org/#dom-document-createelement
        if (!xmlName.test(columnName[0])) {
          return false;
        }
        // Ensure that createElement will not throw, see https://dom.spec.whatwg.org/#dom-document-createelement
        if (columnName.length == 3 && !xmlName.test(columnName[2])) {
          return false;
        }
        return true;
      },
      columnError: function() {
        if (columnVm.columnIgnore()) {
          return "";
        }
        if (!columnVm.columnValid()) {
          return "Error: Invalid field name";
        }
        var value = columnVm.columnValue();
        if (!vm.columnList().some(function(s) { return s.toLowerCase() == value.toLowerCase(); })) {
          return "Error: Unknown field";
        }
        return "";
      }
    };
    return columnVm;
  }

  vm.batchSize.subscribe(executeBatch);
  vm.batchConcurrency.subscribe(executeBatch);
  // Cannot subscribe to vm.isProcessingQueue, vm.activeBatches or importData, since executeBatch modifies them, and Knockout cannot handle these cycles

  function executeBatch() {
    if (!vm.isProcessingQueue()) {
      return;
    }

    var batchSize = +vm.batchSize();
    if (!(batchSize > 0)) { // This also handles NaN
      return;
    }

    var batchConcurrency = +vm.batchConcurrency();
    if (!(batchConcurrency > 0)) { // This also handles NaN
      return;
    }

    // We start slowly and grow the number of concurrent batches until we reach batchConcurrency
    // If a batch fails (the whole batch, not individual records), we slow down again
    if (Math.min(Math.max(vm.batchMaxConcurrency(), 1), batchConcurrency) <= vm.activeBatches()) {
      return;
    }

    // If we reach three consecutive failed batches, we stop, since it is likely all other batches will fail
    // See also http://dev.chromium.org/throttling
    if (vm.batchMaxConcurrency() <= -3) {
      vm.isProcessingQueue(false);
      return;
    }

    var importState = vm.importState();
    var data = importData().importTable.data;
    var header = importData().importTable.header.map(function(c) { return c.columnValue(); });
    var batchRows = [];
    var doc = window.document.implementation.createDocument(null, importState.importAction);
    if (importState.importAction == "upsert") {
      var extId = doc.createElement("externalIDFieldName");
      extId.textContent = importState.idFieldName;
      doc.documentElement.appendChild(extId);
    }

    for (var r = 0; r < data.length; r++) {
      if (batchRows.length == batchSize) {
        break;
      }
      var row = data[r];
      if (row[importState.statusColumnIndex] != "Queued") {
        continue;
      }
      batchRows.push(row);
      row[importState.statusColumnIndex] = "Processing";
      if (importState.importAction == "delete") {
        var deleteId = doc.createElement("ID");
        deleteId.textContent = row[importState.inputIdColumnIndex];
        doc.documentElement.appendChild(deleteId);
      } else {
        var sobjects = doc.createElement("sObjects");
        sobjects.setAttribute("xsi:type", importState.sobjectType);
        for (var c = 0; c < row.length; c++) {
          if (header[c][0] != "_") {
            var columnName = header[c].split(":");
            if (row[c].trim() == "") {
              if (c != importState.inputIdColumnIndex) {
                var field = doc.createElement("fieldsToNull");
                if (columnName.length == 1) { // Our validation ensures there are always one or three elements in the array
                  field.textContent = columnName[0];
                } else {
                  field.textContent = /__r$/.test(columnName[0]) ? columnName[0].replace(/__r$/, "__c") : columnName[0] + "Id";
                }
                sobjects.appendChild(field);
              }
            } else {
              if (columnName.length == 1) { // Our validation ensures there are always one or three elements in the array
                // For Mozilla reviewers: `doc` is a SOAP XML document, which is never interpreted as a HTML or XHTML document, so using dynamic element names is secure in this case.
                var field = doc.createElement(columnName[0]);
                field.textContent = row[c];
              } else {
                // For Mozilla reviewers: `doc` is a SOAP XML document, which is never interpreted as a HTML or XHTML document, so using dynamic element names is secure in this case.
                var subField = doc.createElement(columnName[2]);
                subField.textContent = row[c];
                // For Mozilla reviewers: `doc` is a SOAP XML document, which is never interpreted as a HTML or XHTML document, so using dynamic element names is secure in this case.
                var field = doc.createElement(columnName[0]);
                field.setAttribute("xsi:type", columnName[1]);
                field.appendChild(subField);
              }
              sobjects.appendChild(field);
            }
          }
        }
        doc.documentElement.appendChild(sobjects);
      }
    }
    if (batchRows.length == 0) {
      vm.isProcessingQueue(false);
      return;
    }
    var batchXml = new XMLSerializer().serializeToString(doc);
    vm.activeBatches(vm.activeBatches() + 1);
    updateResult(importData().importTable);
    executeBatch();

    spinFor(askSalesforceSoap(importState.useToolingApi ? "/services/Soap/T/" + apiVersion : "/services/Soap/c/" + apiVersion, importState.useToolingApi ? "urn:tooling.soap.sforce.com" : "urn:enterprise.soap.sforce.com", batchXml).then(function(res) {
      var results = res.querySelectorAll("Body result");
      for (var i = 0; i < results.length; i++) {
        var result = results[i];
        var row = batchRows[i];
        if (result.querySelector("success").textContent == "true") {
          row[importState.statusColumnIndex] = "Succeeded";
          row[importState.actionColumnIndex] =
            importState.importAction == "create" ? "Inserted"
            : importState.importAction == "update" ? "Updated"
            : importState.importAction == "upsert" ? (result.querySelector("created").textContent == "true" ? "Inserted" : "Updated")
            : importState.importAction == "delete" ? "Deleted"
            : "Unknown";
        } else {
          row[importState.statusColumnIndex] = "Failed";
          row[importState.actionColumnIndex] = "";
        }
        row[importState.resultIdColumnIndex] = result.querySelector("id").textContent;
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
        row[importState.errorColumnIndex] = errors.join(", ");
      }
      vm.batchMaxConcurrency(Math.max(vm.batchMaxConcurrency(), 0) + 1);
    }, function(xhr) {
      if (!xhr || xhr.readyState != 4) {
        throw xhr; // Not an HTTP error response
      }
      var errorText;
      if (xhr.responseXML != null) {
        var soapFaults = xhr.responseXML.querySelectorAll("faultstring");
        var errors = [];
        for (var i = 0; i < soapFaults.length; i++) {
          errors.push(soapFaults[i].textContent);
        }
        errorText = errors.join(", ");
      } else {
        console.error(xhr);
        errorText = "Connection to Salesforce failed" + (xhr.status != 0 ? " (HTTP " + xhr.status + ")" : "");
      }
      batchRows.forEach(function(row) {
        row[importState.statusColumnIndex] = "Failed";
        row[importState.resultIdColumnIndex] = "";
        row[importState.actionColumnIndex] = "";
        row[importState.errorColumnIndex] = errorText;
      });
      vm.batchMaxConcurrency(Math.min(vm.batchMaxConcurrency(), 0) - 1);
    }).then(function() {
      vm.activeBatches(vm.activeBatches() - 1);
      updateResult(importData().importTable);
      executeBatch();
    }).catch(function(error) {
      console.error("Unexpected exception", error);
      vm.isProcessingQueue(false);
    }));
  }

  function csvSerialize(table, separator) {
    return table.map(function(row) { return row.map(function(text) { return "\"" + ("" + (text == null ? "" : text)).split("\"").join("\"\"") + "\""; }).join(separator); }).join("\r\n");
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

  return vm;
}