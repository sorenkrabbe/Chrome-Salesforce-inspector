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

    let vm = new Model(sfHost);
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

class Model {

  constructor(sfHost) {
    this.message = this.message.bind(this);
    this.dataPaste = this.dataPaste.bind(this);
    this.setData = this.setData.bind(this);
    this.invalidInput = this.invalidInput.bind(this);
    this.isWorking = this.isWorking.bind(this);
    this.columns = this.columns.bind(this);
    this.sobjectList = this.sobjectList.bind(this);
    this.idLookupList = this.idLookupList.bind(this);
    this.columnList = this.columnList.bind(this);
    this.importIdColumnValid = this.importIdColumnValid.bind(this);
    this.importIdColumnError = this.importIdColumnError.bind(this);
    this.importTypeError = this.importTypeError.bind(this);
    this.externalIdError = this.externalIdError.bind(this);
    this.idFieldName = this.idFieldName.bind(this);
    this.inputIdColumnIndex = this.inputIdColumnIndex.bind(this);
    this.batchSizeError = this.batchSizeError.bind(this);
    this.batchConcurrencyError = this.batchConcurrencyError.bind(this);
    this.canCopy = this.canCopy.bind(this);
    this.copyAsExcel = this.copyAsExcel.bind(this);
    this.copyAsCsv = this.copyAsCsv.bind(this);
    this.copyResult = this.copyResult.bind(this);
    this.importCounts = this.importCounts.bind(this);
    this.importTableResult = this.importTableResult.bind(this);
    this.confirmPopupYes = this.confirmPopupYes.bind(this);
    this.confirmPopupNo = this.confirmPopupNo.bind(this);
    this.toggleHelp = this.toggleHelp.bind(this);
    this.showDescribeUrl = this.showDescribeUrl.bind(this);
    this.doImport = this.doImport.bind(this);
    this.toggleProcessing = this.toggleProcessing.bind(this);
    this.retryFailed = this.retryFailed.bind(this);
    this.updateResult = this.updateResult.bind(this);
    this.spinFor = this.spinFor.bind(this);
    this.makeColumn = this.makeColumn.bind(this);
    this.executeBatch = this.executeBatch.bind(this);

    this.sfHost = sfHost;
    this.importData = ko.observable();
    this.consecutiveFailures = 0;

    this.sfLink = "https://" + this.sfHost;
    this.spinnerCount = ko.observable(0);
    this.showHelp = ko.observable(false);
    this.userInfo = ko.observable("...");
    this.dataError = ko.observable("");
    this.useToolingApi = ko.observable(false);
    this.dataFormat = ko.observable("excel");
    this.importAction = ko.observable("create");
    this.importType = ko.observable("Account");
    this.externalId = ko.observable("Id");
    this.batchSize = ko.observable("200");
    this.batchConcurrency = ko.observable("6");
    this.confirmPopup = ko.observable(null);
    this.activeBatches = ko.observable(0);
    this.isProcessingQueue = ko.observable(false);
    this.importState = ko.observable(null);
    this.showStatus = {
      Queued: ko.observable(true),
      Processing: ko.observable(true),
      Succeeded: ko.observable(true),
      Failed: ko.observable(true)
    };

    this.updateResult(null);

    this.sobjectAllDescribes = ko.observable({});
    this.describeInfo = new DescribeInfo(this.spinFor, () => {
      this.sobjectAllDescribes.valueHasMutated();
    });
    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo(res.userFullName + " / " + res.userName + " / " + res.organizationName);
    }));

    this.batchSize.subscribe(this.executeBatch);
    this.batchConcurrency.subscribe(this.executeBatch);
    // Cannot subscribe to this.isProcessingQueue, this.activeBatches or this.importData, since this.executeBatch modifies them, and Knockout cannot handle these cycles
  }

  message() {
    return this.dataFormat() == "excel" ? "Paste Excel data here" : "Paste CSV data here";
  }

  dataPaste(_, e) {
    let text = e.clipboardData.getData("text/plain");
    this.setData(text);
  }

  setData(text) {
    if (this.isWorking()) {
      return;
    }
    let separator = this.dataFormat() == "excel" ? "\t" : ",";
    let data;
    try {
      data = csvParse(text, separator);
    } catch (e) {
      console.log(e);
      this.dataError("Error: " + e.message);
      this.updateResult(null);
      return;
    }

    if (data.length < 2) {
      this.dataError("Error: No records to import");
      this.updateResult(null);
      return;
    }
    this.dataError("");
    let header = data.shift().map(this.makeColumn);
    this.updateResult(null); // Two updates, the first clears state from the scrolltable
    this.updateResult({header, data});
  }

  invalidInput() {
    // We should try to allow imports to succeed even if our validation logic does not exactly match the one in Salesforce.
    // We only hard-fail on errors that prevent us from building the API request.
    // When possible, we submit the request with errors and let Salesforce give a descriptive message in the response.
    return !this.importIdColumnValid() || !this.importData().importTable || !this.importData().importTable.header.every(col => col.columnIgnore() || col.columnValid());
  }

  isWorking() {
    return this.activeBatches() != 0 || this.isProcessingQueue();
  }

  columns() {
    return this.importData().importTable && this.importData().importTable.header;
  }

  sobjectList() {
    this.sobjectAllDescribes(); // Tell Knockout we have read describe info.
    let {globalDescribe} = this.describeInfo.describeGlobal(this.useToolingApi());
    if (!globalDescribe) {
      return [];
    }
    return globalDescribe.sobjects
      .filter(sobjectDescribe => sobjectDescribe.createable || sobjectDescribe.deletable || sobjectDescribe.updateable)
      .map(sobjectDescribe => sobjectDescribe.name);
  }

  idLookupList() {
    let sobjectName = this.importType();
    this.sobjectAllDescribes(); // Tell Knockout we have read describe info.
    let sobjectDescribe = this.describeInfo.describeSobject(this.useToolingApi(), sobjectName).sobjectDescribe;

    if (!sobjectDescribe) {
      return [];
    }
    return sobjectDescribe.fields.filter(field => field.idLookup).map(field => field.name);
  }

  columnList() {
    let self = this;
    return Array.from(function*() {
      let importAction = self.importAction();

      if (importAction == "delete") {
        yield "Id";
      } else {
        let sobjectName = self.importType();
        let useToolingApi = self.useToolingApi();
        self.sobjectAllDescribes(); // Tell Knockout we have read describe info.
        let sobjectDescribe = self.describeInfo.describeSobject(useToolingApi, sobjectName).sobjectDescribe;
        if (sobjectDescribe) {
          let idFieldName = self.idFieldName();
          for (let field of sobjectDescribe.fields) {
            if (field.createable || field.updateable) {
              yield field.name;
              for (let referenceSobjectName of field.referenceTo) {
                self.sobjectAllDescribes(); // Tell Knockout we have read describe info.
                let referenceSobjectDescribe = self.describeInfo.describeSobject(useToolingApi, referenceSobjectName).sobjectDescribe;
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
  }

  importIdColumnValid() {
    return this.importAction() == "create" || this.inputIdColumnIndex() > -1;
  }

  importIdColumnError() {
    if (!this.importIdColumnValid()) {
      return "Error: The field mapping has no '" + this.idFieldName() + "' column";
    }
    return "";
  }

  importTypeError() {
    let importType = this.importType();
    if (!this.sobjectList().some(s => s.toLowerCase() == importType.toLowerCase())) {
      return "Error: Unknown object";
    }
    return "";
  }

  externalIdError() {
    let externalId = this.externalId();
    if (!this.idLookupList().some(s => s.toLowerCase() == externalId.toLowerCase())) {
      return "Error: Unknown field or not an external ID";
    }
    return "";
  }

  idFieldName() {
    return this.importAction() == "create" ? "" : this.importAction() == "upsert" ? this.externalId() : "Id";
  }

  inputIdColumnIndex() {
    let importTable = this.importData().importTable;
    if (!importTable) {
      return -1;
    }
    let idFieldName = this.idFieldName();
    return importTable.header.findIndex(c => c.columnValue().toLowerCase() == idFieldName.toLowerCase());
  }

  batchSizeError() {
    if (!(+this.batchSize() > 0)) { // This also handles NaN
      return "Error: Must be a positive number";
    }
    return "";
  }

  batchConcurrencyError() {
    if (!(+this.batchConcurrency() > 0)) { // This also handles NaN
      return "Error: Must be a positive number";
    }
    if (+this.batchConcurrency() > 6) {
      return "Note: More than 6 threads will not help since Salesforce does not support HTTP2";
    }
    return "";
  }

  canCopy() {
    return this.importData().taggedRows != null;
  }

  copyAsExcel() {
    this.copyResult("\t");
  }

  copyAsCsv() {
    this.copyResult(",");
  }

  copyResult(separator) {
    let header = this.importData().importTable.header.map(c => c.columnValue());
    let data = this.importData().taggedRows.filter(row => this.showStatus[row.status]()).map(row => row.cells);
    copyToClipboard(csvSerialize([header, ...data], separator));
  }

  importCounts() {
    return this.importData().counts;
  }

  importTableResult() {
    if (this.importData().taggedRows == null) {
      return null;
    }
    let header = this.importData().importTable.header.map(c => c.columnValue());
    let data = this.importData().taggedRows.map(row => row.cells);
    return {
      table: [header, ...data],
      isTooling: this.useToolingApi(),
      describeInfo: this.describeInfo,
      sfHost: this.sfHost,
      rowVisibilities: [true, ...this.importData().taggedRows.map(row => this.showStatus[row.status]())],
      colVisibilities: header.map(() => true)
    };
  }

  confirmPopupYes() {
    this.confirmPopup(null);

    let {header, data} = this.importData().importTable;

    let statusColumnIndex = header.findIndex(c => c.columnValue().toLowerCase() == "__status");
    if (statusColumnIndex == -1) {
      statusColumnIndex = header.length;
      header.push(this.makeColumn("__Status"));
      for (let row of data) {
        row.push("");
      }
    }
    let resultIdColumnIndex = header.findIndex(c => c.columnValue().toLowerCase() == "__id");
    if (resultIdColumnIndex == -1) {
      resultIdColumnIndex = header.length;
      header.push(this.makeColumn("__Id"));
      for (let row of data) {
        row.push("");
      }
    }
    let actionColumnIndex = header.findIndex(c => c.columnValue().toLowerCase() == "__action");
    if (actionColumnIndex == -1) {
      actionColumnIndex = header.length;
      header.push(this.makeColumn("__Action"));
      for (let row of data) {
        row.push("");
      }
    }
    let errorColumnIndex = header.findIndex(c => c.columnValue().toLowerCase() == "__errors");
    if (errorColumnIndex == -1) {
      errorColumnIndex = header.length;
      header.push(this.makeColumn("__Errors"));
      for (let row of data) {
        row.push("");
      }
    }
    for (let row of data) {
      if (["queued", "processing", ""].includes(row[statusColumnIndex].toLowerCase())) {
        row[statusColumnIndex] = "Queued";
      }
    }
    this.updateResult(this.importData().importTable);
    this.importState({
      statusColumnIndex,
      resultIdColumnIndex,
      actionColumnIndex,
      errorColumnIndex,
      importAction: this.importAction(),
      useToolingApi: this.useToolingApi(),
      sobjectType: this.importType(),
      idFieldName: this.idFieldName(),
      inputIdColumnIndex: this.inputIdColumnIndex()
    });

    this.consecutiveFailures = 0;
    this.isProcessingQueue(true);
    this.executeBatch();
  }

  confirmPopupNo() {
    this.confirmPopup(null);
  }

  toggleHelp() {
    this.showHelp(!this.showHelp());
  }

  showDescribeUrl() {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("objectType", this.importType());
    if (this.useToolingApi()) {
      args.set("useToolingApi", "1");
    }
    return "inspect.html?" + args;
  }

  doImport() {
    let importedRecords = this.importData().counts.Queued + this.importData().counts.Processing;
    let skippedRecords = this.importData().counts.Succeeded + this.importData().counts.Failed;
    this.confirmPopup({
      text: importedRecords + " records will be imported."
        + (skippedRecords > 0 ? " " + skippedRecords + " records will be skipped because they have __Status Succeeded or Failed." : "")
    });
  }

  toggleProcessing() {
    this.isProcessingQueue(!this.isProcessingQueue());
  }

  retryFailed() {
    if (!this.importData().importTable) {
      return;
    }
    let statusColumnIndex = this.importData().importTable.header.findIndex(c => c.columnValue().toLowerCase() == "__status");
    if (statusColumnIndex < 0) {
      return;
    }
    for (let row of this.importData().taggedRows) {
      if (row.status == "Failed") {
        row.cells[statusColumnIndex] = "Queued";
      }
    }
    this.updateResult(this.importData().importTable);
    this.executeBatch();
  }

  updateResult(importTable) {
    let counts = {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0};
    if (!importTable) {
      this.importData({
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
        : cells[statusColumnIndex].toLowerCase() == "processing" && !this.isWorking() ? "Queued"
        : cells[statusColumnIndex].toLowerCase() == "processing" ? "Processing"
        : cells[statusColumnIndex].toLowerCase() == "succeeded" ? "Succeeded"
        : "Failed";
      counts[status]++;
      taggedRows.push({status, cells});
    }
    this.importData({importTable, counts, taggedRows});
  }

  spinFor(promise) {
    let stopSpinner = () => {
      this.spinnerCount(this.spinnerCount() - 1);
    };
    this.spinnerCount(this.spinnerCount() + 1);
    promise.catch(e => { console.error("spinFor", e); }).then(stopSpinner, stopSpinner);
  }

  makeColumn(column) {
    let self = this;
    let xmlName = /^[a-zA-Z_][a-zA-Z0-9_]*$/; // A (subset of a) valid XML name
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
        if (!self.columnList().some(s => s.toLowerCase() == value.toLowerCase())) {
          return "Error: Unknown field";
        }
        return "";
      }
    };
    return columnVm;
  }

  executeBatch() {
    if (!this.isProcessingQueue()) {
      return;
    }

    let batchSize = +this.batchSize();
    if (!(batchSize > 0)) { // This also handles NaN
      return;
    }

    let batchConcurrency = +this.batchConcurrency();
    if (!(batchConcurrency > 0)) { // This also handles NaN
      return;
    }

    if (batchConcurrency <= this.activeBatches()) {
      return;
    }

    let {statusColumnIndex, resultIdColumnIndex, actionColumnIndex, errorColumnIndex, importAction, useToolingApi, sobjectType, idFieldName, inputIdColumnIndex} = this.importState();
    let data = this.importData().importTable.data;
    let header = this.importData().importTable.header.map(c => c.columnValue());
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
      if (this.activeBatches() == 0) {
        this.isProcessingQueue(false);
      }
      return;
    }
    this.activeBatches(this.activeBatches() + 1);
    this.updateResult(this.importData().importTable);

    // When receiving invalid input, Salesforce will respond with HTTP status 500.
    // Chrome misinterprets that as the server being overloaded,
    // and will block the connection if it receives too many such errors too quickly.
    // See http://dev.chromium.org/throttling
    // To avoid that, we delay each batch a little at the beginning,
    // and we stop processing when we receive too many consecutive batch level errors.
    // Note: When a batch finishes successfully, it will start a timeout parallel to any existing timeouts,
    // so we will reach full batchConcurrency faster that timeoutDelay*batchConcurrency,
    // unless batches are slower than timeoutDelay.
    setTimeout(this.executeBatch, 2500);

    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, useToolingApi ? "Tooling" : "Enterprise"), importAction, importArgs).then(res => {
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
      this.consecutiveFailures = 0;
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
      this.consecutiveFailures++;
      // If a whole batch has failed (as opposed to individual records failing),
      // too many times in a row, we stop the import.
      // This is useful when an error will affect all batches, for example a field name being misspelled.
      // This also helps prevent throtteling in Chrome.
      // A batch failing might not affect all batches, so we wait for a few consecutive errors before we stop.
      // For example, a whole batch will fail if one of the field values is of an incorrect type or format.
      if (this.consecutiveFailures >= 3) {
        this.isProcessingQueue(false);
      }
    }).then(() => {
      this.activeBatches(this.activeBatches() - 1);
      this.updateResult(this.importData().importTable);
      this.executeBatch();
    }).catch(error => {
      console.error("Unexpected exception", error);
      this.isProcessingQueue(false);
    }));
  }

}

function csvSerialize(table, separator) {
  return table.map(row => row.map(text => "\"" + ("" + (text == null ? "" : text)).split("\"").join("\"\"") + "\"").join(separator)).join("\r\n");
}
