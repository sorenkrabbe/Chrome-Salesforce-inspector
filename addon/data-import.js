/* eslint-disable no-unused-vars */
/* global ko */
/* global sfConn apiVersion async */
/* global initButton */
/* global csvParse */
/* global Enumerable DescribeInfo copyToClipboard initScrollTable */
/* eslint-enable no-unused-vars */
"use strict";
{

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let vm = dataImportVm(sfHost);
    ko.applyBindings(vm, document.documentElement);

    function unloadListener(e) {
      // Ask the user for confirmation before leaving
      e.returnValue = "The import will be stopped";
    }
    // We completely remove the listener when not needed (as opposed to just not setting returnValue in the listener),
    // because having the listener disables BFCache in Firefox (even if the listener does nothing).
    // Chrome does not have a BFCache.
    ko.computed(vm.isWorking).subscribe(working => {
      if (working) {
        console.log("added listener");
        addEventListener("beforeunload", unloadListener);
      } else {
        console.log("removed listener");
        removeEventListener("beforeunload", unloadListener);
      }
    });

    let resize = ko.observable({});
    addEventListener("resize", () => { resize({}); });

    initScrollTable(
      document.querySelector("#result-box"),
      ko.computed(vm.importTableResult),
      ko.computed(() => { resize(); vm.showHelp(); return {}; })
    );

    if (parent && parent.isUnitTest) { // for unit tests
      window.testData = {vm};
      parent.postMessage({insextTestLoaded: true}, "*");
    }

  });

}

function dataImportVm(sfHost) {

  let importData = ko.observable();
  let consecutiveFailures = 0;

  let vm = {
    sfLink: "https://" + sfHost,
    spinnerCount: ko.observable(0),
    showHelp: ko.observable(false),
    userInfo: ko.observable("..."),
    dataError: ko.observable(""),
    message() { return vm.dataFormat() == "excel" ? "Paste Excel data here" : "Paste CSV data here"; },
    dataPaste(_, e) {
      let text = e.clipboardData.getData("text/plain");
      vm.setData(text);
    },
    setData(text) {
      if (vm.isWorking()) {
        return;
      }
      let separator = vm.dataFormat() == "excel" ? "\t" : ",";
      let data;
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
      let header = data.shift().map(makeColumn);
      updateResult(null); // Two updates, the first clears state from the scrolltable
      updateResult({header, data});
    },
    invalidInput() {
      // We should try to allow imports to succeed even if our validation logic does not exactly match the one in Salesforce.
      // We only hard-fail on errors that prevent us from building the API request.
      // When possible, we submit the request with errors and let Salesforce give a descriptive message in the response.
      return !vm.importIdColumnValid() || !importData().importTable || !importData().importTable.header.every(col => col.columnIgnore() || col.columnValid());
    },
    isWorking() {
      return vm.activeBatches() != 0 || vm.isProcessingQueue();
    },
    columns() {
      return importData().importTable && importData().importTable.header;
    },

    sobjectList() {
      let {globalDescribe} = describeInfo.describeGlobal(vm.useToolingApi());
      if (!globalDescribe) {
        return [];
      }
      return globalDescribe.sobjects
        .filter(sobjectDescribe => sobjectDescribe.createable || sobjectDescribe.deletable || sobjectDescribe.updateable)
        .map(sobjectDescribe => sobjectDescribe.name);
    },
    idLookupList() {
      let sobjectName = vm.importType();
      let sobjectDescribe = describeInfo.describeSobject(vm.useToolingApi(), sobjectName).sobjectDescribe;

      if (!sobjectDescribe) {
        return [];
      }
      return sobjectDescribe.fields.filter(field => field.idLookup).map(field => field.name);
    },
    columnList() {
      return Array.from(function*() {
        let importAction = vm.importAction();

        if (importAction == "delete") {
          yield "Id";
        } else {
          let sobjectName = vm.importType();
          let useToolingApi = vm.useToolingApi();
          let sobjectDescribe = describeInfo.describeSobject(useToolingApi, sobjectName).sobjectDescribe;
          if (sobjectDescribe) {
            let idFieldName = vm.idFieldName();
            for (let field of sobjectDescribe.fields) {
              if (field.createable || field.updateable) {
                yield field.name;
                for (let referenceSobjectName of field.referenceTo) {
                  let referenceSobjectDescribe = describeInfo.describeSobject(useToolingApi, referenceSobjectName).sobjectDescribe;
                  if (referenceSobjectDescribe) {
                    for (let referenceField of referenceSobjectDescribe.fields) {
                      if (referenceField.idLookup) {
                        yield field.relationshipName + ":" + referenceSobjectDescribe.name + ":" + referenceField.name;
                      }
                    }
                  }
                }
              } else if (field.idLookup && field.name.toLowerCase() == idFieldName.toLowerCase()) {
                yield field.name;
              }
            }
          }
        }
        yield "__Status";
        yield "__Id";
        yield "__Action";
        yield "__Errors";
      }());
    },
    useToolingApi: ko.observable(false),
    dataFormat: ko.observable("excel"),
    importAction: ko.observable("create"),
    importIdColumnValid() {
      return vm.importAction() == "create" || vm.inputIdColumnIndex() > -1;
    },
    importIdColumnError() {
      if (!vm.importIdColumnValid()) {
        return "Error: The field mapping has no '" + vm.idFieldName() + "' column";
      }
      return "";
    },
    importType: ko.observable("Account"),
    importTypeError() {
      let importType = vm.importType();
      if (!vm.sobjectList().some(s => s.toLowerCase() == importType.toLowerCase())) {
        return "Error: Unknown object";
      }
      return "";
    },
    externalId: ko.observable("Id"),
    externalIdError() {
      let externalId = vm.externalId();
      if (!vm.idLookupList().some(s => s.toLowerCase() == externalId.toLowerCase())) {
        return "Error: Unknown field or not an external ID";
      }
      return "";
    },
    idFieldName() {
      return vm.importAction() == "create" ? "" : vm.importAction() == "upsert" ? vm.externalId() : "Id";
    },
    inputIdColumnIndex() {
      let importTable = importData().importTable;
      if (!importTable) {
        return -1;
      }
      let idFieldName = vm.idFieldName();
      return importTable.header.findIndex(c => c.columnValue().toLowerCase() == idFieldName.toLowerCase());
    },
    batchSize: ko.observable("200"),
    batchSizeError() {
      if (!(+vm.batchSize() > 0)) { // This also handles NaN
        return "Error: Must be a positive number";
      }
      return "";
    },
    batchConcurrency: ko.observable("6"),
    batchConcurrencyError() {
      if (!(+vm.batchConcurrency() > 0)) { // This also handles NaN
        return "Error: Must be a positive number";
      }
      if (+vm.batchConcurrency() > 6) {
        return "Note: More than 6 threads will not help since Salesforce does not support HTTP2";
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
    canCopy() {
      return importData().taggedRows != null;
    },
    copyAsExcel() {
      vm.copyResult("\t");
    },
    copyAsCsv() {
      vm.copyResult(",");
    },
    copyResult(separator) {
      let header = importData().importTable.header.map(c => c.columnValue());
      let data = importData().taggedRows.filter(row => vm.showStatus[row.status]()).map(row => row.cells);
      copyToClipboard(csvSerialize([header, ...data], separator));
    },
    importCounts() {
      return importData().counts;
    },
    importTableResult() {
      if (importData().taggedRows == null) {
        return null;
      }
      let header = importData().importTable.header.map(c => c.columnValue());
      let data = importData().taggedRows.map(row => row.cells);
      return {
        table: [header, ...data],
        isTooling: vm.useToolingApi(),
        describeInfo,
        sfHost,
        rowVisibilities: [true, ...importData().taggedRows.map(row => vm.showStatus[row.status]())],
        colVisibilities: header.map(() => true)
      };
    },
    confirmPopupYes() {
      vm.confirmPopup(null);

      let {header, data} = importData().importTable;

      let statusColumnIndex = header.findIndex(c => c.columnValue().toLowerCase() == "__status");
      if (statusColumnIndex == -1) {
        statusColumnIndex = header.length;
        header.push(makeColumn("__Status"));
        for (let row of data) {
          row.push("");
        }
      }
      let resultIdColumnIndex = header.findIndex(c => c.columnValue().toLowerCase() == "__id");
      if (resultIdColumnIndex == -1) {
        resultIdColumnIndex = header.length;
        header.push(makeColumn("__Id"));
        for (let row of data) {
          row.push("");
        }
      }
      let actionColumnIndex = header.findIndex(c => c.columnValue().toLowerCase() == "__action");
      if (actionColumnIndex == -1) {
        actionColumnIndex = header.length;
        header.push(makeColumn("__Action"));
        for (let row of data) {
          row.push("");
        }
      }
      let errorColumnIndex = header.findIndex(c => c.columnValue().toLowerCase() == "__errors");
      if (errorColumnIndex == -1) {
        errorColumnIndex = header.length;
        header.push(makeColumn("__Errors"));
        for (let row of data) {
          row.push("");
        }
      }
      for (let row of data) {
        if (["queued", "processing", ""].includes(row[statusColumnIndex].toLowerCase())) {
          row[statusColumnIndex] = "Queued";
        }
      }
      updateResult(importData().importTable);
      vm.importState({
        statusColumnIndex,
        resultIdColumnIndex,
        actionColumnIndex,
        errorColumnIndex,
        importAction: vm.importAction(),
        useToolingApi: vm.useToolingApi(),
        sobjectType: vm.importType(),
        idFieldName: vm.idFieldName(),
        inputIdColumnIndex: vm.inputIdColumnIndex()
      });

      consecutiveFailures = 0;
      vm.isProcessingQueue(true);
      executeBatch();
    },
    confirmPopupNo() {
      vm.confirmPopup(null);
    },
    toggleHelp() {
      vm.showHelp(!vm.showHelp());
    },
    showDescribeUrl() {
      let args = new URLSearchParams();
      args.set("host", sfHost);
      args.set("objectType", vm.importType());
      if (vm.useToolingApi()) {
        args.set("useToolingApi", "1");
      }
      return "inspect.html?" + args;
    },
    doImport() {
      let importedRecords = importData().counts.Queued + importData().counts.Processing;
      let skippedRecords = importData().counts.Succeeded + importData().counts.Failed;
      vm.confirmPopup({
        text: importedRecords + " records will be imported."
          + (skippedRecords > 0 ? " " + skippedRecords + " records will be skipped because they have __Status Succeeded or Failed." : "")
      });
    },
    toggleProcessing() {
      vm.isProcessingQueue(!vm.isProcessingQueue());
    },
    retryFailed() {
      if (!importData().importTable) {
        return;
      }
      let statusColumnIndex = importData().importTable.header.findIndex(c => c.columnValue().toLowerCase() == "__status");
      if (statusColumnIndex < 0) {
        return;
      }
      for (let row of importData().taggedRows) {
        if (row.status == "Failed") {
          row.cells[statusColumnIndex] = "Queued";
        }
      }
      updateResult(importData().importTable);
      executeBatch();
    }
  };
  updateResult(null);
  function updateResult(importTable) {
    let counts = {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0};
    if (!importTable) {
      importData({
        importTable: null,
        counts,
        taggedRows: null
      });
      return;
    }
    let statusColumnIndex = importTable.header.findIndex(c => c.columnValue().toLowerCase() == "__status");
    let taggedRows = [];
    for (let cells of importTable.data) {
      let status = statusColumnIndex < 0 ? "Queued"
        : cells[statusColumnIndex].toLowerCase() == "queued" ? "Queued"
        : cells[statusColumnIndex].toLowerCase() == "" ? "Queued"
        : cells[statusColumnIndex].toLowerCase() == "processing" && !vm.isWorking() ? "Queued"
        : cells[statusColumnIndex].toLowerCase() == "processing" ? "Processing"
        : cells[statusColumnIndex].toLowerCase() == "succeeded" ? "Succeeded"
        : "Failed";
      counts[status]++;
      taggedRows.push({status, cells});
    }
    importData({importTable, counts, taggedRows});
  }

  function spinFor(promise) {
    vm.spinnerCount(vm.spinnerCount() + 1);
    promise.catch(e => { console.error("spinFor", e); }).then(stopSpinner, stopSpinner);
  }
  function stopSpinner() {
    vm.spinnerCount(vm.spinnerCount() - 1);
  }

  let describeInfo = new DescribeInfo(spinFor);
  spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
    vm.userInfo(res.userFullName + " / " + res.userName + " / " + res.organizationName);
  }));

  let xmlName = /^[a-zA-Z_][a-zA-Z0-9_]*$/; // A (subset of a) valid XML name
  function makeColumn(column) {
    let columnVm = {
      columnValue: ko.observable(column),
      columnIgnore() { return columnVm.columnValue().startsWith("_"); },
      columnSkip() {
        columnVm.columnValue("_" + columnVm.columnValue());
      },
      columnValid() {
        let columnName = columnVm.columnValue().split(":");
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
      columnError() {
        if (columnVm.columnIgnore()) {
          return "";
        }
        if (!columnVm.columnValid()) {
          return "Error: Invalid field name";
        }
        let value = columnVm.columnValue();
        if (!vm.columnList().some(s => s.toLowerCase() == value.toLowerCase())) {
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

    let batchSize = +vm.batchSize();
    if (!(batchSize > 0)) { // This also handles NaN
      return;
    }

    let batchConcurrency = +vm.batchConcurrency();
    if (!(batchConcurrency > 0)) { // This also handles NaN
      return;
    }

    if (batchConcurrency <= vm.activeBatches()) {
      return;
    }

    let {statusColumnIndex, resultIdColumnIndex, actionColumnIndex, errorColumnIndex, importAction, useToolingApi, sobjectType, idFieldName, inputIdColumnIndex} = vm.importState();
    let data = importData().importTable.data;
    let header = importData().importTable.header.map(c => c.columnValue());
    let batchRows = [];
    let importArgs = {};
    if (importAction == "upsert") {
      importArgs.externalIDFieldName = idFieldName;
    }
    if (importAction == "delete") {
      importArgs.ID = [];
    } else {
      importArgs.sObjects = [];
    }

    for (let row of data) {
      if (batchRows.length == batchSize) {
        break;
      }
      if (row[statusColumnIndex] != "Queued") {
        continue;
      }
      batchRows.push(row);
      row[statusColumnIndex] = "Processing";
      if (importAction == "delete") {
        importArgs.ID.push(row[inputIdColumnIndex]);
      } else {
        let sobject = {};
        sobject["$xsi:type"] = sobjectType;
        sobject.fieldsToNull = [];
        for (let c = 0; c < row.length; c++) {
          if (header[c][0] != "_") {
            let columnName = header[c].split(":");
            if (row[c].trim() == "") {
              if (c != inputIdColumnIndex) {
                let field;
                let [fieldName] = columnName;
                if (columnName.length == 1) { // Our validation ensures there are always one or three elements in the array
                  field = fieldName;
                } else {
                  field = /__r$/.test(fieldName) ? fieldName.replace(/__r$/, "__c") : fieldName + "Id";
                }
                sobject.fieldsToNull.push(field);
              }
            } else if (columnName.length == 1) { // Our validation ensures there are always one or three elements in the array
              let [fieldName] = columnName;
              sobject[fieldName] = row[c];
            } else {
              let [fieldName, typeName, subFieldName] = columnName;
              sobject[fieldName] = {
                "$xsi:type": typeName,
                [subFieldName]: row[c]
              };
            }
          }
        }
        importArgs.sObjects.push(sobject);
      }
    }
    if (batchRows.length == 0) {
      if (vm.activeBatches() == 0) {
        vm.isProcessingQueue(false);
      }
      return;
    }
    vm.activeBatches(vm.activeBatches() + 1);
    updateResult(importData().importTable);

    // When receiving invalid input, Salesforce will respond with HTTP status 500.
    // Chrome misinterprets that as the server being overloaded,
    // and will block the connection if it receives too many such errors too quickly.
    // See http://dev.chromium.org/throttling
    // To avoid that, we delay each batch a little at the beginning,
    // and we stop processing when we receive too many consecutive batch level errors.
    // Note: When a batch finishes successfully, it will start a timeout parallel to any existing timeouts,
    // so we will reach full batchConcurrency faster that timeoutDelay*batchConcurrency,
    // unless batches are slower than timeoutDelay.
    setTimeout(executeBatch, 2500);

    spinFor(sfConn.soap(sfConn.wsdl(apiVersion, useToolingApi ? "Tooling" : "Enterprise"), importAction, importArgs).then(res => {
      let results = sfConn.asArray(res);
      for (let i = 0; i < results.length; i++) {
        let result = results[i];
        let row = batchRows[i];
        if (result.success == "true") {
          row[statusColumnIndex] = "Succeeded";
          row[actionColumnIndex]
            = importAction == "create" ? "Inserted"
            : importAction == "update" ? "Updated"
            : importAction == "upsert" ? (result.created == "true" ? "Inserted" : "Updated")
            : importAction == "delete" ? "Deleted"
            : "Unknown";
        } else {
          row[statusColumnIndex] = "Failed";
          row[actionColumnIndex] = "";
        }
        row[resultIdColumnIndex] = result.id || "";
        row[errorColumnIndex] = sfConn.asArray(result.errors).map(errorNode =>
          errorNode.statusCode
            + ": " + errorNode.message
            + " [" + sfConn.asArray(errorNode.fields).join(", ") + "]"
        ).join(", ");
      }
      consecutiveFailures = 0;
    }, err => {
      let errorText = err && err.sfConnError;
      if (!errorText) {
        throw err; // Not an HTTP error response
      }
      for (let row of batchRows) {
        row[statusColumnIndex] = "Failed";
        row[resultIdColumnIndex] = "";
        row[actionColumnIndex] = "";
        row[errorColumnIndex] = errorText;
      }
      consecutiveFailures++;
      // If a whole batch has failed (as opposed to individual records failing),
      // too many times in a row, we stop the import.
      // This is useful when an error will affect all batches, for example a field name being misspelled.
      // This also helps prevent throtteling in Chrome.
      // A batch failing might not affect all batches, so we wait for a few consecutive errors before we stop.
      // For example, a whole batch will fail if one of the field values is of an incorrect type or format.
      if (consecutiveFailures >= 3) {
        vm.isProcessingQueue(false);
      }
    }).then(() => {
      vm.activeBatches(vm.activeBatches() - 1);
      updateResult(importData().importTable);
      executeBatch();
    }).catch(error => {
      console.error("Unexpected exception", error);
      vm.isProcessingQueue(false);
    }));
  }

  function csvSerialize(table, separator) {
    return table.map(row => row.map(text => "\"" + ("" + (text == null ? "" : text)).split("\"").join("\"\"") + "\"").join(separator)).join("\r\n");
  }

  return vm;
}
