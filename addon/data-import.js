/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {csvParse} from "./csv-parse.js";
import {DescribeInfo, copyToClipboard, initScrollTable} from "./data-load.js";

class Model {

  constructor(sfHost) {
    this.sfHost = sfHost;
    this.importData = undefined;
    this.consecutiveFailures = 0;

    this.sfLink = "https://" + this.sfHost;
    this.spinnerCount = 0;
    this.showHelp = false;
    this.userInfo = "...";
    this.dataError = "";
    this.useToolingApi = false;
    this.dataFormat = "excel";
    this.importAction = "create";
    this.importType = "Account";
    this.externalId = "Id";
    this.batchSize = "200";
    this.batchConcurrency = "6";
    this.confirmPopup = null;
    this.activeBatches = 0;
    this.isProcessingQueue = false;
    this.importState = null;
    this.showStatus = {
      Queued: true,
      Processing: true,
      Succeeded: true,
      Failed: true
    };

    this.importTableResult = null;
    this.updateResult(null);

    this.describeInfo = new DescribeInfo(this.spinFor.bind(this), () => {});
    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
    }));

  }

  /**
   * Notify React that we changed something, so it will rerender the view.
   * Should only be called once at the end of an event or asynchronous operation, since each call can take some time.
   * All event listeners (functions starting with "on") should call this function if they update the model.
   * Asynchronous operations should use the spinFor function, which will call this function after the asynchronous operation completes.
   * Other functions should not call this function, since they are called by a function that does.
   * @param cb A function to be called once React has processed the update.
   */
  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
    if (this.testCallback) {
      this.testCallback();
    }
  }

  /**
   * Show the spinner while waiting for a promise.
   * didUpdate() must be called after calling spinFor.
   * didUpdate() is called when the promise is resolved or rejected, so the caller doesn't have to call it, when it updates the model just before resolving the promise, for better performance.
   * @param promise The promise to wait for.
   */
  spinFor(promise) {
    this.spinnerCount++;
    promise
      .catch(err => {
        console.error("spinFor", err);
      })
      .then(() => {
        this.spinnerCount--;
        this.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  }

  message() {
    return this.dataFormat == "excel" ? "Paste Excel data here" : "Paste CSV data here";
  }

  setData(text) {
    if (this.isWorking()) {
      return;
    }
    let separator = this.dataFormat == "excel" ? "\t" : ",";
    let data;
    try {
      data = csvParse(text, separator);
    } catch (e) {
      console.log(e);
      this.dataError = "Error: " + e.message;
      this.updateResult(null);
      return;
    }

    if (data[0] && data[0][0] && data[0][0].trimStart().startsWith("salesforce-inspector-import-options")) {
      let importOptions = new URLSearchParams(data.shift()[0].trim());
      if (importOptions.get("useToolingApi") == "1") this.useToolingApi = true;
      if (importOptions.get("useToolingApi") == "0") this.useToolingApi = false;
      if (importOptions.get("action") == "create") this.importAction = "create";
      if (importOptions.get("action") == "update") this.importAction = "update";
      if (importOptions.get("action") == "upsert") this.importAction = "upsert";
      if (importOptions.get("action") == "delete") this.importAction = "delete";
      if (importOptions.get("object")) this.importType = importOptions.get("object");
      if (importOptions.get("externalId") && this.importAction == "upsert") this.externalId = importOptions.get("externalId");
      if (importOptions.get("batchSize")) this.batchSize = importOptions.get("batchSize");
      if (importOptions.get("threads")) this.batchConcurrency = importOptions.get("threads");
    }

    if (data.length < 2) {
      this.dataError = "Error: No records to import";
      this.updateResult(null);
      return;
    }
    this.dataError = "";
    let header = data.shift().map(c => this.makeColumn(c));
    this.updateResult(null); // Two updates, the first clears state from the scrolltable
    this.updateResult({header, data});
  }

  copyOptions() {
    let importOptions = new URLSearchParams();
    importOptions.set("salesforce-inspector-import-options", "");
    importOptions.set("useToolingApi", this.useToolingApi ? "1" : "0");
    importOptions.set("action", this.importAction);
    importOptions.set("object", this.importType);
    if (this.importAction == "upsert") importOptions.set("externalId", this.externalId);
    importOptions.set("batchSize", this.batchSize);
    importOptions.set("threads", this.batchConcurrency);
    copyToClipboard(importOptions.toString());
  }

  invalidInput() {
    // We should try to allow imports to succeed even if our validation logic does not exactly match the one in Salesforce.
    // We only hard-fail on errors that prevent us from building the API request.
    // When possible, we submit the request with errors and let Salesforce give a descriptive message in the response.
    return !this.importIdColumnValid() || !this.importData.importTable || !this.importData.importTable.header.every(col => col.columnIgnore() || col.columnValid());
  }

  isWorking() {
    return this.activeBatches != 0 || this.isProcessingQueue;
  }

  columns() {
    return this.importData.importTable ? this.importData.importTable.header : [];
  }

  sobjectList() {
    let {globalDescribe} = this.describeInfo.describeGlobal(this.useToolingApi);
    if (!globalDescribe) {
      return [];
    }
    return globalDescribe.sobjects
      .filter(sobjectDescribe => sobjectDescribe.createable || sobjectDescribe.deletable || sobjectDescribe.updateable)
      .map(sobjectDescribe => sobjectDescribe.name);
  }

  idLookupList() {
    let sobjectName = this.importType;
    let sobjectDescribe = this.describeInfo.describeSobject(this.useToolingApi, sobjectName).sobjectDescribe;

    if (!sobjectDescribe) {
      return [];
    }
    return sobjectDescribe.fields.filter(field => field.idLookup).map(field => field.name);
  }

  columnList() {
    let self = this;
    return Array.from(function*() {
      let importAction = self.importAction;

      if (importAction == "delete") {
        yield "Id";
      } else {
        let sobjectName = self.importType;
        let useToolingApi = self.useToolingApi;
        let sobjectDescribe = self.describeInfo.describeSobject(useToolingApi, sobjectName).sobjectDescribe;
        if (sobjectDescribe) {
          let idFieldName = self.idFieldName();
          for (let field of sobjectDescribe.fields) {
            if (field.createable || field.updateable) {
              yield field.name;
              for (let referenceSobjectName of field.referenceTo) {
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
    return this.importAction == "create" || this.inputIdColumnIndex() > -1;
  }

  importIdColumnError() {
    if (!this.importIdColumnValid()) {
      return "Error: The field mapping has no '" + this.idFieldName() + "' column";
    }
    return "";
  }

  importTypeError() {
    let importType = this.importType;
    if (!this.sobjectList().some(s => s.toLowerCase() == importType.toLowerCase())) {
      return "Error: Unknown object";
    }
    return "";
  }

  externalIdError() {
    let externalId = this.externalId;
    if (!this.idLookupList().some(s => s.toLowerCase() == externalId.toLowerCase())) {
      return "Error: Unknown field or not an external ID";
    }
    return "";
  }

  idFieldName() {
    return this.importAction == "create" ? "" : this.importAction == "upsert" ? this.externalId : "Id";
  }

  inputIdColumnIndex() {
    let importTable = this.importData.importTable;
    if (!importTable) {
      return -1;
    }
    let idFieldName = this.idFieldName();
    return importTable.header.findIndex(c => c.columnValue.toLowerCase() == idFieldName.toLowerCase());
  }

  batchSizeError() {
    if (!(+this.batchSize > 0)) { // This also handles NaN
      return "Error: Must be a positive number";
    }
    return "";
  }

  batchConcurrencyError() {
    if (!(+this.batchConcurrency > 0)) { // This also handles NaN
      return "Error: Must be a positive number";
    }
    if (+this.batchConcurrency > 6) {
      return "Note: More than 6 threads will not help since Salesforce does not support HTTP2";
    }
    return "";
  }

  canCopy() {
    return this.importData.taggedRows != null;
  }

  copyResult(separator) {
    let header = this.importData.importTable.header.map(c => c.columnValue);
    let data = this.importData.taggedRows.filter(row => this.showStatus[row.status]).map(row => row.cells);
    copyToClipboard(csvSerialize([header, ...data], separator));
  }

  importCounts() {
    return this.importData.counts;
  }

  // Must be called whenever any of its inputs changes.
  updateImportTableResult() {
    if (this.importData.taggedRows == null) {
      this.importTableResult = null;
      if (this.resultTableCallback) {
        this.resultTableCallback(this.importTableResult);
      }
      return;
    }
    let header = this.importData.importTable.header.map(c => c.columnValue);
    let data = this.importData.taggedRows.map(row => row.cells);
    this.importTableResult = {
      table: [header, ...data],
      isTooling: this.useToolingApi,
      describeInfo: this.describeInfo,
      sfHost: this.sfHost,
      rowVisibilities: [true, ...this.importData.taggedRows.map(row => this.showStatus[row.status])],
      colVisibilities: header.map(() => true)
    };
    if (this.resultTableCallback) {
      this.resultTableCallback(this.importTableResult);
    }
  }

  confirmPopupYes() {
    this.confirmPopup = null;

    let {header, data} = this.importData.importTable;

    let statusColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__status");
    if (statusColumnIndex == -1) {
      statusColumnIndex = header.length;
      header.push(this.makeColumn("__Status"));
      for (let row of data) {
        row.push("");
      }
    }
    let resultIdColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__id");
    if (resultIdColumnIndex == -1) {
      resultIdColumnIndex = header.length;
      header.push(this.makeColumn("__Id"));
      for (let row of data) {
        row.push("");
      }
    }
    let actionColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__action");
    if (actionColumnIndex == -1) {
      actionColumnIndex = header.length;
      header.push(this.makeColumn("__Action"));
      for (let row of data) {
        row.push("");
      }
    }
    let errorColumnIndex = header.findIndex(c => c.columnValue.toLowerCase() == "__errors");
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
    this.updateResult(this.importData.importTable);
    this.importState = {
      statusColumnIndex,
      resultIdColumnIndex,
      actionColumnIndex,
      errorColumnIndex,
      importAction: this.importAction,
      useToolingApi: this.useToolingApi,
      sobjectType: this.importType,
      idFieldName: this.idFieldName(),
      inputIdColumnIndex: this.inputIdColumnIndex()
    };

    this.consecutiveFailures = 0;
    this.isProcessingQueue = true;
    this.executeBatch();
  }

  confirmPopupNo() {
    this.confirmPopup = null;
  }

  showDescribeUrl() {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("objectType", this.importType);
    if (this.useToolingApi) {
      args.set("useToolingApi", "1");
    }
    return "inspect.html?" + args;
  }

  doImport() {
    let importedRecords = this.importData.counts.Queued + this.importData.counts.Processing;
    let skippedRecords = this.importData.counts.Succeeded + this.importData.counts.Failed;
    this.confirmPopup = {
      text: importedRecords + " records will be imported."
        + (skippedRecords > 0 ? " " + skippedRecords + " records will be skipped because they have __Status Succeeded or Failed." : "")
    };
  }

  retryFailed() {
    if (!this.importData.importTable) {
      return;
    }
    let statusColumnIndex = this.importData.importTable.header.findIndex(c => c.columnValue.toLowerCase() == "__status");
    if (statusColumnIndex < 0) {
      return;
    }
    for (let row of this.importData.taggedRows) {
      if (row.status == "Failed") {
        row.cells[statusColumnIndex] = "Queued";
      }
    }
    this.updateResult(this.importData.importTable);
    this.executeBatch();
  }

  updateResult(importTable) {
    let counts = {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0};
    if (!importTable) {
      this.importData = {
        importTable: null,
        counts,
        taggedRows: null
      };
      this.updateImportTableResult();
      return;
    }
    let statusColumnIndex = importTable.header.findIndex(c => c.columnValue.toLowerCase() == "__status");
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
    // Note: caller will call this.executeBatch() if needed
    this.importData = {importTable, counts, taggedRows};
    this.updateImportTableResult();
  }

  makeColumn(column) {
    let self = this;
    let xmlName = /^[a-zA-Z_][a-zA-Z0-9_]*$/; // A (subset of a) valid XML name
    let columnVm = {
      columnValue: column,
      columnIgnore() { return columnVm.columnValue.startsWith("_"); },
      columnSkip() {
        columnVm.columnValue = "_" + columnVm.columnValue;
      },
      columnValid() {
        let columnName = columnVm.columnValue.split(":");
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
        let value = columnVm.columnValue;
        if (!self.columnList().some(s => s.toLowerCase() == value.toLowerCase())) {
          return "Error: Unknown field";
        }
        return "";
      }
    };
    return columnVm;
  }

  // Called once whenever any value is changed such that a new batch might be started (this.isProcessingQueue, this.batchSize, this.batchConcurrency, this.activeBatches or this.importData/updateResult)
  executeBatch() {
    if (!this.isProcessingQueue) {
      return;
    }

    let batchSize = +this.batchSize;
    if (!(batchSize > 0)) { // This also handles NaN
      return;
    }

    let batchConcurrency = +this.batchConcurrency;
    if (!(batchConcurrency > 0)) { // This also handles NaN
      return;
    }

    if (batchConcurrency <= this.activeBatches) {
      return;
    }

    let {statusColumnIndex, resultIdColumnIndex, actionColumnIndex, errorColumnIndex, importAction, useToolingApi, sobjectType, idFieldName, inputIdColumnIndex} = this.importState;
    let data = this.importData.importTable.data;
    let header = this.importData.importTable.header.map(c => c.columnValue);
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
      if (this.activeBatches == 0) {
        this.isProcessingQueue = false;
      }
      return;
    }
    this.activeBatches++;
    this.updateResult(this.importData.importTable);

    // When receiving invalid input, Salesforce will respond with HTTP status 500.
    // Chrome misinterprets that as the server being overloaded,
    // and will block the connection if it receives too many such errors too quickly.
    // See http://dev.chromium.org/throttling
    // To avoid that, we delay each batch a little at the beginning,
    // and we stop processing when we receive too many consecutive batch level errors.
    // Note: When a batch finishes successfully, it will start a timeout parallel to any existing timeouts,
    // so we will reach full batchConcurrency faster that timeoutDelay*batchConcurrency,
    // unless batches are slower than timeoutDelay.
    setTimeout(this.executeBatch.bind(this), 2500);

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
      if (err.name != "SalesforceSoapError") {
        throw err; // Not an HTTP error response
      }
      let errorText = err.message;
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
        this.isProcessingQueue = false;
      }
    }).then(() => {
      this.activeBatches--;
      this.updateResult(this.importData.importTable);
      this.executeBatch();
    }).catch(error => {
      console.error("Unexpected exception", error);
      this.isProcessingQueue = false;
    }));
  }

}

function csvSerialize(table, separator) {
  return table.map(row => row.map(text => "\"" + ("" + (text == null ? "" : text)).split("\"").join("\"\"") + "\"").join(separator)).join("\r\n");
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onUseToolingApiChange = this.onUseToolingApiChange.bind(this);
    this.onImportActionChange = this.onImportActionChange.bind(this);
    this.onImportTypeChange = this.onImportTypeChange.bind(this);
    this.onDataFormatChange = this.onDataFormatChange.bind(this);
    this.onDataPaste = this.onDataPaste.bind(this);
    this.onExternalIdChange = this.onExternalIdChange.bind(this);
    this.onBatchSizeChange = this.onBatchSizeChange.bind(this);
    this.onBatchConcurrencyChange = this.onBatchConcurrencyChange.bind(this);
    this.onToggleHelpClick = this.onToggleHelpClick.bind(this);
    this.onDoImportClick = this.onDoImportClick.bind(this);
    this.onToggleProcessingClick = this.onToggleProcessingClick.bind(this);
    this.onRetryFailedClick = this.onRetryFailedClick.bind(this);
    this.onCopyAsExcelClick = this.onCopyAsExcelClick.bind(this);
    this.onCopyAsCsvClick = this.onCopyAsCsvClick.bind(this);
    this.onCopyOptionsClick = this.onCopyOptionsClick.bind(this);
    this.onConfirmPopupYesClick = this.onConfirmPopupYesClick.bind(this);
    this.onConfirmPopupNoClick = this.onConfirmPopupNoClick.bind(this);
    this.unloadListener = null;
  }
  onUseToolingApiChange(e) {
    let {model} = this.props;
    model.useToolingApi = e.target.checked;
    model.updateImportTableResult();
    model.didUpdate();
  }
  onImportActionChange(e) {
    let {model} = this.props;
    model.importAction = e.target.value;
    model.didUpdate();
  }
  onImportTypeChange(e) {
    let {model} = this.props;
    model.importType = e.target.value;
    model.didUpdate();
  }
  onDataFormatChange(e) {
    let {model} = this.props;
    model.dataFormat = e.target.value;
    model.didUpdate();
  }
  onDataPaste(e) {
    let {model} = this.props;
    let text = e.clipboardData.getData("text/plain");
    model.setData(text);
    model.didUpdate();
  }
  onExternalIdChange(e) {
    let {model} = this.props;
    model.externalId = e.target.value;
    model.didUpdate();
  }
  onBatchSizeChange(e) {
    let {model} = this.props;
    model.batchSize = e.target.value;
    model.executeBatch();
    model.didUpdate();
  }
  onBatchConcurrencyChange(e) {
    let {model} = this.props;
    model.batchConcurrency = e.target.value;
    model.executeBatch();
    model.didUpdate();
  }
  onToggleHelpClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.showHelp = !model.showHelp;
    model.didUpdate(() => {
      this.scrollTable.viewportChange();
    });
  }
  onDoImportClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.doImport();
    model.didUpdate();
  }
  onToggleProcessingClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.isProcessingQueue = !model.isProcessingQueue;
    model.executeBatch();
    model.didUpdate();
  }
  onRetryFailedClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.retryFailed();
    model.didUpdate();
  }
  onCopyAsExcelClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.copyResult("\t");
  }
  onCopyAsCsvClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.copyResult(",");
  }
  onCopyOptionsClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.copyOptions();
  }
  onConfirmPopupYesClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.confirmPopupYes();
    model.didUpdate();
  }
  onConfirmPopupNoClick(e) {
    e.preventDefault();
    let {model} = this.props;
    model.confirmPopupNo();
    model.didUpdate();
  }
  componentDidMount() {
    let {model} = this.props;

    addEventListener("resize", () => { this.scrollTable.viewportChange(); });

    this.scrollTable = initScrollTable(this.refs.scroller);
    model.resultTableCallback = this.scrollTable.dataChange;
    model.updateImportTableResult();
  }
  componentDidUpdate() {
    let {model} = this.props;

    // We completely remove the listener when not needed (as opposed to just not setting returnValue in the listener),
    // because having the listener disables BFCache in Firefox (even if the listener does nothing).
    // Chrome does not have a BFCache.
    if (model.isWorking()) {
      if (!this.unloadListener) {
        this.unloadListener = e => {
          // Ask the user for confirmation before leaving
          e.returnValue = "The import will be stopped";
        };
        console.log("added listener");
        addEventListener("beforeunload", this.unloadListener);
      }
    } else if (this.unloadListener) {
      console.log("removed listener");
      removeEventListener("beforeunload", this.unloadListener);
    }
  }
  render() {
    let {model} = this.props;
    return h("div", {},
      h("img", {id: "spinner", src: "data:image/gif;base64,R0lGODlhIAAgAPUmANnZ2fX19efn5+/v7/Ly8vPz8/j4+Orq6vz8/Pr6+uzs7OPj4/f39/+0r/8gENvb2/9NQM/Pz/+ln/Hx8fDw8P/Dv/n5+f/Sz//w7+Dg4N/f39bW1v+If/9rYP96cP8+MP/h3+Li4v8RAOXl5f39/czMzNHR0fVhVt+GgN7e3u3t7fzAvPLU0ufY1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQFCAAmACwAAAAAIAAgAAAG/0CTcEhMEBSjpGgJ4VyI0OgwcEhaR8us6CORShHIq1WrhYC8Q4ZAfCVrHQ10gC12k7tRBr1u18aJCGt7Y31ZDmdDYYNKhVkQU4sCFAwGFQ0eDo14VXsDJFEYHYUfJgmDAWgmEoUXBJ2pQqJ2HIpXAp+wGJluEHsUsEMefXsMwEINw3QGxiYVfQDQ0dCoxgQl19jX0tIFzAPZ2dvRB8wh4NgL4gAPuKkIEeclAArqAALAGvElIwb1ABOpFOgrgSqDv1tREOTTt0FIAX/rDhQIQGBACHgDFQxJBxHawHBFHnQE8PFaBAtQHnYsWWKAlAkrP2r0UkBkvYERXKZKwFGcPhcAKI1NMLjt3IaZzIQYUNATG4AR1LwEAQAh+QQFCAAtACwAAAAAIAAgAAAG3MCWcEgstkZIBSFhbDqLyOjoEHhaodKoAnG9ZqUCxpPwLZtHq2YBkDq7R6dm4gFgv8vx5qJeb9+jeUYTfHwpTQYMFAKATxmEhU8kA3BPBo+EBFZpTwqXdQJdVnuXD6FWngAHpk+oBatOqFWvs10VIre4t7RFDbm5u0QevrjAQhgOwyIQxS0dySIcVipWLM8iF08mJRpcTijJH0ITRtolJREhA5lG374STuXm8iXeuctN8fPmT+0OIPj69Fn51qCJioACqT0ZEAHhvmIWADhkJkTBhoAUhwQYIfGhqSAAIfkEBQgAJgAsAAAAACAAIAAABshAk3BINCgWgCRxyWwKC5mkFOCsLhPIqdTKLTy0U251AtZyA9XydMRuu9mMtBrwro8ECHnZXldYpw8HBWhMdoROSQJWfAdcE1YBfCMJYlYDfASVVSQCdn6aThR8oE4Mo6RMBnwlrK2smahLrq4DsbKzrCG2RAC4JRF5uyYjviUawiYBxSWfThJcG8VVGB0iIlYKvk0VDR4O1tZ/s07g5eFOFhGtVebmVQOsVu3uTs3k8+DPtvgiDg3C+CCAQNbugz6C1iBwuGAlCAAh+QQFCAAtACwAAAAAIAAgAAAG28CWcEgstgDIhcJgbBYnTaQUkIE6r8bpdJHAeo9a6aNwVYXPaAChOSiZ0nBAqmmJlNzx8zx6v7/zUntGCn19Jk0BBQcPgVcbhYZYAnJXAZCFKlhrVyOXdxpfWACeEQihV54lIaeongOsTqmbsLReBiO4ubi1RQy6urxEFL+5wUIkAsQjCsYtA8ojs00sWCvQI11OKCIdGFcnygdX2yIiDh4NFU3gvwHa5fDx8uXsuMxN5PP68OwCpkb59gkEx2CawIPwVlxp4EBgMxAQ9jUTIuHDvIlDLnCIWA5WEAAh+QQFCAAmACwAAAAAIAAgAAAGyUCTcEgMjAClJHHJbAoVm6S05KwuLcip1ModRLRTblUB1nIn1fIUwG672YW0uvSuAx4JedleX1inESEDBE12cXIaCFV8GVwKVhN8AAZiVgJ8j5VVD3Z+mk4HfJ9OBaKjTAF8IqusqxWnTK2tDbBLsqwetUQQtyIOGLpCHL0iHcEmF8QiElYBXB/EVSQDIyNWEr1NBgwUAtXVVrytTt/l4E4gDqxV5uZVDatW7e5OzPLz3861+CMCDMH4FCgCaO6AvmMtqikgkKdKEAAh+QQFCAAtACwAAAAAIAAgAAAG28CWcEgstkpIwChgbDqLyGhpo3haodIowHK9ZqWRwZP1LZtLqmZDhDq7S6YmyCFiv8vxJqReb9+jeUYSfHwoTQQDIRGARhNCH4SFTwgacE8XkYQsVmlPHJl1HV1We5kOGKNPoCIeqaqgDa5OqxWytqMBALq7urdFBby8vkQHwbvDQw/GAAvILQLLAFVPK1YE0QAGTycjAyRPKcsZ2yPlAhQM2kbhwY5N3OXx5U7sus3v8vngug8J+PnyrIQr0GQFQH3WnjAQcHAeMgQKGjoTEuAAwIlDEhCIGM9VEAAh+QQFCAAmACwAAAAAIAAgAAAGx0CTcEi8cCCiJHHJbAoln6RU5KwuQcip1MptOLRTblUC1nIV1fK0xG672YO0WvSulyIWedleB1inDh4NFU12aHIdGFV8G1wSVgp8JQFiVhp8I5VVCBF2fppOIXygTgOjpEwEmCOsrSMGqEyurgyxS7OtFLZECrgjAiS7QgS+I3HCCcUjlFUTXAfFVgIAn04Bvk0BBQcP1NSQs07e499OCAKtVeTkVQysVuvs1lzx48629QAPBcL1CwnCTKzLwC+gQGoLFMCqEgQAIfkEBQgALQAsAAAAACAAIAAABtvAlnBILLZESAjnYmw6i8io6CN5WqHSKAR0vWaljsZz9S2bRawmY3Q6u0WoJkIwYr/L8aaiXm/fo3lGAXx8J00VDR4OgE8HhIVPGB1wTwmPhCtWaU8El3UDXVZ7lwIkoU+eIxSnqJ4MrE6pBrC0oQQluLm4tUUDurq8RCG/ucFCCBHEJQDGLRrKJSNWBFYq0CUBTykAAlYmyhvaAOMPBwXZRt+/Ck7b4+/jTuq4zE3u8O9P6hEW9vj43kqAMkLgH8BqTwo8MBjPWIIFDJsJmZDhX5MJtQwogNjwVBAAOw==", hidden: model.spinnerCount == 0}),
      h("div", {id: "user-info"},
        h("a", {href: model.sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
          ),
          " Salesforce Home"
        ),
        " \xa0 ",
        h("h1", {}, "Data Import"),
        h("span", {}, " / " + model.userInfo)
      ),
      h("div", {className: "conf-section"},
        h("div", {className: "conf-subsection"},
          h("div", {className: "conf-line"},
            h("label", {className: "conf-input", title: "With the tooling API you can query more metadata, but you cannot query regular data"},
              h("span", {className: "conf-label"}),
              h("span", {className: "conf-value"},
                h("input", {type: "checkbox", checked: model.useToolingApi, onChange: this.onUseToolingApiChange, disabled: model.isWorking()}),
                " Use Tooling API?"
              )
            )
          ),
          h("div", {className: "conf-line"},
            h("label", {className: "conf-input"},
              h("span", {className: "conf-label"}, "Action"),
              h("span", {className: "conf-value"},
                h("select", {value: model.importAction, onChange: this.onImportActionChange, disabled: model.isWorking()},
                  h("option", {value: "create"}, "Insert"),
                  h("option", {value: "update"}, "Update"),
                  h("option", {value: "upsert"}, "Upsert"),
                  h("option", {value: "delete"}, "Delete")
                )
              )
            )
          ),
          h("div", {className: "conf-line"},
            h("label", {className: "conf-input"},
              h("span", {className: "conf-label"}, "Object"),
              h("span", {className: "conf-value"},
                h("input", {type: "text", value: model.importType, onChange: this.onImportTypeChange, className: model.importTypeError() ? "confError" : "", disabled: model.isWorking(), list: "sobjectlist"}),
                h("div", {className: "conf-error", hidden: !model.importTypeError()}, model.importTypeError())
              )
            ),
            h("a", {className: "char-btn", href: model.showDescribeUrl(), title: "Show field info for the selected object"}, "i")
          ),
          h("div", {className: "conf-line"},
            h("span", {className: "conf-label"}, "Format"),
            h("label", {}, h("input", {type: "radio", name: "data-input-format", value: "excel", checked: model.dataFormat == "excel", onChange: this.onDataFormatChange, disabled: model.isWorking()}), " ", h("span", {}, "Excel")),
            " ",
            h("label", {}, h("input", {type: "radio", name: "data-input-format", value: "csv", checked: model.dataFormat == "csv", onChange: this.onDataFormatChange, disabled: model.isWorking()}), " ", h("span", {}, "CSV"))
          ),
          h("div", {className: "conf-line"},
            h("label", {className: "conf-input"},
              h("span", {className: "conf-label"}, "Data"),
              h("span", {className: "conf-value"},
                h("textarea", {id: "data", value: model.message(), onPaste: this.onDataPaste, className: model.dataError ? "confError" : "", disabled: model.isWorking(), readOnly: true, rows: 1}),
                h("div", {className: "conf-error", hidden: !model.dataError}, model.dataError)
              )
            )
          ),
          h("div", {className: "conf-line", hidden: model.importAction != "upsert"},
            h("label", {className: "conf-input", title: "Used in upserts to determine if an existing record should be updated or a new record should be created"},
              h("span", {className: "conf-label"}, "External ID:"),
              h("span", {className: "conf-value"},
                h("input", {type: "text", value: model.externalId, onChange: this.onExternalIdChange, className: model.externalIdError() ? "confError" : "", disabled: model.isWorking(), list: "idlookuplist"}),
                h("div", {className: "conf-error", hidden: !model.externalIdError()}, model.externalIdError())
              )
            )
          ),
          h("div", {className: "conf-line"},
            h("label", {className: "conf-input", title: "The number of records per batch. A higher value is faster but increases the risk of errors due to governor limits."},
              h("span", {className: "conf-label"}, "Batch size"),
              h("span", {className: "conf-value"},
                h("input", {type: "number", value: model.batchSize, onChange: this.onBatchSizeChange, className: (model.batchSizeError() ? "confError" : "") + " batch-size"}),
                h("div", {className: "conf-error", hidden: !model.batchSizeError()}, model.batchSizeError())
              )
            )
          ),
          h("div", {className: "conf-line"},
            h("label", {className: "conf-input", title: "The number of batches to execute concurrently. A higher number is faster but increases the risk of errors due to lock congestion."},
              h("span", {className: "conf-label"}, "Threads"),
              h("span", {className: "conf-value"},
                h("input", {type: "number", value: model.batchConcurrency, onChange: this.onBatchConcurrencyChange, className: (model.batchConcurrencyError() ? "confError" : "") + " batch-size"}),
                h("span", {hidden: !model.isWorking()}, model.activeBatches),
                h("div", {className: "conf-error", hidden: !model.batchConcurrencyError()}, model.batchConcurrencyError())
              )
            )
          ),
          h("datalist", {id: "sobjectlist"}, model.sobjectList().map(data => h("option", {key: data, value: data}))),
          h("datalist", {id: "idlookuplist"}, model.idLookupList().map(data => h("option", {key: data, value: data}))),
          h("datalist", {id: "columnlist"}, model.columnList().map(data => h("option", {key: data, value: data})))
        ),
        h("div", {className: "conf-subsection columns-mapping"},
          h("div", {className: "columns-label"}, "Field mapping"),
          h("div", {className: "conf-error confError", hidden: !model.importIdColumnError()}, model.importIdColumnError()),
          h("div", {className: "conf-value"}, model.columns().map((column, index) => h(ColumnMapper, {key: index, model, column})))
        )
      ),
      h("div", {className: "conf-line"},
        h("span", {className: "conf-label"}),
        h("a", {href: "about:blank", id: "import-help-btn", onClick: this.onToggleHelpClick}, "Import help"),
        h("button", {onClick: this.onDoImportClick, disabled: model.invalidInput() || model.isWorking() || model.importCounts().Queued == 0}, "Import"),
        h("button", {disabled: !model.isWorking(), onClick: this.onToggleProcessingClick}, model.isWorking() && !model.isProcessingQueue ? "Resume queued" : "Cancel queued"),
        h("button", {disabled: !model.importCounts().Failed > 0, onClick: this.onRetryFailedClick, className: "button-space"}, "Retry failed"),
        h("button", {disabled: !model.canCopy(), onClick: this.onCopyAsExcelClick, title: "Copy import result to clipboard for pasting into Excel or similar"}, "Copy (Excel format)"),
        h("button", {disabled: !model.canCopy(), onClick: this.onCopyAsCsvClick, className: "button-space", title: "Copy import result to clipboard for saving as a CSV file"}, "Copy (CSV)"),
        h("button", {onClick: this.onCopyOptionsClick, title: "Save these import options by pasting them into Excel in the top left cell, just above the header row"}, "Copy options")
      ),
      h("div", {hidden: !model.showHelp},
        h("p", {}, "Use for quick one-off data imports."),
        h("ul", {},
          h("li", {}, "Enter your CSV or Excel data in the box above.",
            h("ul", {},
              h("li", {}, "The input must contain a header row with field API names."),
              h("li", {}, "To use an external ID for a lookup field, the header row should contain the lookup relation name, the target sobject name and the external ID name separated by colons, e.g. \"MyLookupField__r:MyObject__c:MyExternalIdField__c\"."),
              h("li", {}, "Empty cells insert null values."),
              h("li", {}, "Number, date, time and checkbox values must conform to the relevant ", h("a", {href: "http://www.w3.org/TR/xmlschema-2/#built-in-primitive-datatypes", target: "_blank"}, "XSD datatypes"), "."),
              h("li", {}, "Columns starting with an underscore are ignored."),
              h("li", {}, "You can resume a previous import by including the \"__Status\" column in your input."),
              h("li", {}, "You can supply the other import options by clicking \"Copy options\" and pasting the options into Excel in the top left cell, just above the header row.")
            )
          ),
          h("li", {}, "Select your input format"),
          h("li", {}, "Select an action (insert, update, upsert or delete)"),
          h("li", {}, "Enter the API name of the object to import"),
          h("li", {}, "Press Import")
        ),
        h("p", {}, "Bulk API is not supported. Large data volumes may freeze or crash your browser.")
      ),
      h("div", {className: "status-group"},
        h("span", {className: "conf-label"}, "Status"),
        h(StatusBox, {model, name: "Queued"}),
        h(StatusBox, {model, name: "Processing"}),
        h(StatusBox, {model, name: "Succeeded"}),
        h(StatusBox, {model, name: "Failed"})
      ),
      h("div", {id: "result-table", ref: "scroller"}),
      model.confirmPopup ? h("div", {},
        h("div", {id: "confirm-background"},
          h("div", {id: "confirm-dialog"},
            h("h1", {}, "Import"),
            h("p", {}, "You are about to modify your data in Salesforce. This action cannot be undone."),
            h("p", {}, model.confirmPopup.text),
            h("div", {className: "dialog-buttons"},
              h("button", {onClick: this.onConfirmPopupYesClick}, "Import"),
              h("button", {onClick: this.onConfirmPopupNoClick}, "Cancel")
            )
          )
        )
      ) : null
    );
  }
}

class ColumnMapper extends React.Component {
  constructor(props) {
    super(props);
    this.onColumnValueChange = this.onColumnValueChange.bind(this);
    this.onColumnSkipClick = this.onColumnSkipClick.bind(this);
  }
  onColumnValueChange(e) {
    let {model, column} = this.props;
    column.columnValue = e.target.value;
    model.didUpdate();
  }
  onColumnSkipClick(e) {
    let {model, column} = this.props;
    e.preventDefault();
    column.columnSkip();
    model.didUpdate();
  }
  render() {
    let {model, column} = this.props;
    return h("div", {className: "conf-line"},
      h("input", {type: "text", list: "columnlist", value: column.columnValue, onChange: this.onColumnValueChange, className: column.columnError() ? "confError" : "", disabled: model.isWorking()}),
      h("div", {className: "conf-error", hidden: !column.columnError()}, h("span", {}, column.columnError()), " ", h("a", {href: "about:blank", onClick: this.onColumnSkipClick, hidden: model.isWorking(), title: "Don't import this column"}, "Skip"))
    );
  }
}

class StatusBox extends React.Component {
  constructor(props) {
    super(props);
    this.onShowStatusChange = this.onShowStatusChange.bind(this);
  }
  onShowStatusChange(e) {
    let {model, name} = this.props;
    model.showStatus[name] = e.target.checked;
    model.updateImportTableResult();
    model.didUpdate();
  }
  render() {
    let {model, name} = this.props;
    return h("label", {className: model.importCounts()[name] == 0 ? "statusGroupEmpty" : ""}, h("input", {type: "checkbox", checked: model.showStatus[name], onChange: this.onShowStatusChange}), " " + model.importCounts()[name] + " " + name);
  }
}

{

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model(sfHost);
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({model});
    }

  });

}
