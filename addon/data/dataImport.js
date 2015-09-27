var args = JSON.parse(atob(decodeURIComponent(location.search.substring(1))));
var orgId = args.orgId;
chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
  session = message;
  var popupWin = window;

  var dataInput = document.querySelector("#data");
  var dataInputVm = {
    setSelectionRange: function(offsetStart, offsetEnd) { dataInput.setSelectionRange(offsetStart, offsetEnd); },
    getValue: function() { return dataInput.value; }
  };

  var vm = dataImportVm(dataInputVm);
  ko.applyBindings(vm, document.documentElement);

  var resultBox = document.querySelector("#result-box");
  function recalculateHeight() {
    vm.resultBoxOffsetTop(resultBox.offsetTop);
  }
  if (this.self && self.port) {
    // Firefox
    // Firefox does not fire a resize event. The next best thing is to listen to when the browser changes the style.height attribute.
    new MutationObserver(recalculateHeight).observe(dataInput, {attributes: true});
  } else {
    // Chrome
    // Chrome does not fire a resize event and does not allow us to get notified when the browser changes the style.height attribute.
    // Instead we listen to a few events which are often fired at the same time.
    // This is not required in Firefox, and Mozilla reviewers don't like it for performance reasons, so we only do this in Chrome via browser detection.
    dataInput.addEventListener("mousemove", recalculateHeight);
    popupWin.addEventListener("mouseup", recalculateHeight);
  }
  vm.showHelp.subscribe(recalculateHeight);
  vm.importAction.subscribe(recalculateHeight);
  popupWin.addEventListener("resize", function() {
    vm.winInnerHeight(popupWin.innerHeight);
    recalculateHeight(); // a resize event is fired when the window is opened after resultBox.offsetTop has been initialized, so initializes vm.resultBoxOffsetTop
  });

});

function dataImportVm(dataInput) {

  var importError = ko.observable(null);
  var maxResults = ko.observable(0);
  var sobjectDataDescribes = ko.observable({});
  var importData = ko.observable({
    header: null,
    data: null,
    statusColumnIndex: -1,
    stopProcessing: function() {}
  });

  var vm = {
    spinnerCount: ko.observable(0),
    showHelp: ko.observable(false),
    userInfo: ko.observable("..."),
    winInnerHeight: ko.observable(0),
    resultBoxOffsetTop: ko.observable(0),
    sobjectList: ko.observable([]),
    idLookupList: idLookupList,
    columnList: columnList,
    dataFormat: ko.observable("excel"),
    importAction: ko.observable("create"),
    importType: ko.observable("Account"),
    externalId: ko.observable("Id"),
    batchSize: ko.observable("200"),
    batchConcurrency: ko.observable("10"),
    confirmPopup: ko.observable(null),
    activeBatches: ko.observable(0),
    dataResultFormat: ko.observable("excel"),
    showStatus: {
      Queued: ko.observable(true),
      Processing: ko.observable(true),
      Succeeded: ko.observable(true),
      Failed: ko.observable(true),
      Canceled: ko.observable(true)
    },
    importResult: function() {
      var counts = {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0};
      if (importError()) {
        return {counts: counts, text: importError(), hasMore: null};
      }
      if (importData().data == null) {
        return {counts: counts, text: "", hasMore: null};
      }
      var statusColumnIndex = importData().statusColumnIndex;
      importData().data.forEach(function(row) {
        counts[row[statusColumnIndex]]++;
      });
      var filteredData = importData().data.filter(function(row) { return vm.showStatus[row[statusColumnIndex]](); });
      var hasMore = null;
      if (filteredData.length > maxResults()) {
        hasMore = "Showing " + maxResults() + " of " + filteredData.length + " rows";
        filteredData = filteredData.slice(0, maxResults());
      }
      return {
        counts: counts,
        text: csvSerialize([importData().header].concat(filteredData), vm.dataResultFormat() == "excel" ? "\t" : ","),
        hasMore: hasMore
      };
    },
    confirmPopupYes: function() {
      vm.confirmPopup().action();
      vm.confirmPopup(null);
    },
    confirmPopupNo: function() {
      vm.confirmPopup(null);
    },
    showMore: function() {
      maxResults(maxResults() * 5);
    },
    toggleHelp: function() {
      vm.showHelp(!vm.showHelp());
    },
    showDescribe: function() {
      showAllData({
        recordAttributes: {type: vm.importType(), url: null},
        useToolingApi: false
      });
    },
    doImport: doImport,
    stopImport: function() {
      importData().stopProcessing();
    }
  };

  function spinFor(promise) {
    vm.spinnerCount(vm.spinnerCount() + 1);
    promise.catch(function (e) { console.error("spinFor", e); }).then(stopSpinner, stopSpinner);
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
  function maybeGetFields(sobjectDescribe) {
    if (!sobjectDescribe.fieldsRequest) {
      console.log("getting fields for " + sobjectDescribe.name);
      sobjectDescribe.fieldsRequest = true;
      spinFor(askSalesforce(sobjectDescribe.urls.describe).then(function(res) {
        sobjectDescribe.fields = res.fields;
        sobjectDataDescribes.valueHasMutated();
      }, function() {
        sobjectDescribe.fieldsRequest = false; // Request failed, allow trying again
      }));
    }
  }
  spinFor(askSalesforce("/services/data/v34.0/sobjects/").then(function(res) {
    vm.sobjectList(res.sobjects.filter(function(sobjectDescribe) { return sobjectDescribe.createable || sobjectDescribe.deletable || sobjectDescribe.updateable; }).map(function(sobjectDescribe) { return sobjectDescribe.name; }));
    res.sobjects.forEach(function(sobjectDescribe) {
      sobjectDataDescribes()[sobjectDescribe.name.toLowerCase()] = sobjectDescribe;
    });
    sobjectDataDescribes.valueHasMutated();
  }));

  spinFor(askSalesforceSoap("<getUserInfo/>").then(function(res) {
    vm.userInfo(res.querySelector("Body userFullName").textContent + " / " + res.querySelector("Body userName").textContent + " / " + res.querySelector("Body organizationName").textContent);
  }));

  function idLookupList() {
    var sobjectName = vm.importType();
    var sobjectDescribe = sobjectDataDescribes()[sobjectName.toLowerCase()];

    if (!sobjectDescribe) {
      return [];
    }
    if (!sobjectDescribe.fields) {
      maybeGetFields(sobjectDescribe);
      return [];
    }
    return sobjectDescribe.fields.filter(function(field) { return field.idLookup; }).map(function(field) { return field.name; });
  }

  function columnList() {
    var sobjectName = vm.importType();
    var sobjectDescribe = sobjectDataDescribes()[sobjectName.toLowerCase()];
    var importAction = vm.importAction();
    var idFieldName = importAction == "upsert" ? vm.externalId() : "Id";

    var res = [idFieldName];
    if (sobjectDescribe) {
      if (sobjectDescribe.fields) {
        sobjectDescribe.fields.forEach(function(field) {
          if (field.createable || field.updateable) {
            res.push(field.name);
            field.referenceTo.forEach(function(referenceSobjectName) {
              var referenceSobjectDescribe = sobjectDataDescribes()[referenceSobjectName.toLowerCase()];
              if (referenceSobjectDescribe) {
                if (referenceSobjectDescribe.fields) {
                  referenceSobjectDescribe.fields.forEach(function(referenceField) {
                    if (referenceField.idLookup) {
                      res.push(field.relationshipName + ":" + referenceSobjectDescribe.name + ":" + referenceField.name);
                    }
                  });
                } else {
                  maybeGetFields(referenceSobjectDescribe);
                }
              }
            });
          }
        });
      } else {
        maybeGetFields(sobjectDescribe);
      }
    }
    res.push("__Status");
    res.push("__Id");
    res.push("__Action");
    res.push("__Errors");
    return res;
  }

  function doImport() {

    var text = dataInput.getValue();
    var separator = vm.dataFormat() == "excel" ? "\t" : ",";
    var data;
    try {
      data = csvParse(text, separator);
    } catch (e) {
      console.log(e);
      importError("=== ERROR ===\n" + e.message);
      dataInput.setSelectionRange(e.offsetStart, e.offsetEnd);
      return;
    }

    if (data.length < 2) {
      importError("=== ERROR ===\nNo records to import");
      return;
    }

    var importAction = vm.importAction();
    var sobjectType = vm.importType();

    if (!/^[a-zA-Z0-9_]+$/.test(sobjectType)) {
      importError("=== ERROR ===\nInvalid object name: " + sobjectType);
      return;
    }

    var header = data.shift();
    var inputIdColumnIndex = -1;
    var idFieldName = importAction == "upsert" ? vm.externalId() : "Id";

    for (var c = 0; c < header.length; c++) {
      if (header[c][0] != "_" && !/^[a-zA-Z0-9_]+(:[a-zA-Z0-9_]+:[a-zA-Z0-9_]+)?$/.test(header[c])) {
        importError("=== ERROR ===\nInvalid column name: " + header[c]);
        return;
      }
      if (header[c].toLowerCase() == idFieldName.toLowerCase()) {
        inputIdColumnIndex = c;
      }
    }

    if (importAction != "create" && inputIdColumnIndex < 0) {
      importError("=== ERROR ===\nThere is no " + idFieldName + " column");
      return;
    }

    var batchSize = +vm.batchSize();
    if (!(batchSize > 0)) { // This also handles NaN
      importError("=== ERROR ===\nBatch size must be a positive number");
      return;
    }

    var batchConcurrency = +vm.batchConcurrency();
    if (!(batchConcurrency > 0)) { // This also handles NaN
      importError("=== ERROR ===\nBatch concurrency must be a positive number");
      return;
    }

    var statusColumnIndex = header.indexOf("__Status");
    if (statusColumnIndex == -1) {
      statusColumnIndex = header.length;
      header.push("__Status");
      data.forEach(function(row) {
        row.push("");
      });
    }
    var resultIdColumnIndex = header.indexOf("__Id");
    if (resultIdColumnIndex == -1) {
      resultIdColumnIndex = header.length;
      header.push("__Id");
      data.forEach(function(row) {
        row.push("");
      });
    }
    var actionColumnIndex = header.indexOf("__Action");
    if (actionColumnIndex == -1) {
      actionColumnIndex = header.length;
      header.push("__Action");
      data.forEach(function(row) {
        row.push("");
      });
    }
    var errorColumnIndex = header.indexOf("__Errors");
    if (errorColumnIndex == -1) {
      errorColumnIndex = header.length;
      header.push("__Errors");
      data.forEach(function(row) {
        row.push("");
      });
    }

    var batchRows, doc;
    function startBatch() {
      batchRows = [];
      doc = window.document.implementation.createDocument(null, importAction);
      if (importAction == "upsert") {
        var extId = doc.createElement("externalIDFieldName");
        extId.textContent = idFieldName;
        doc.documentElement.appendChild(extId);
      }
    }
    function endBatch() {
      batches.push({
        batchXml: new XMLSerializer().serializeToString(doc),
        batchRows: batchRows
      });
    }

    var batches = [];
    var importedRecords = 0;
    var skippedRecords = 0;
    startBatch();
    for (var r = 0; r < data.length; r++) {
      if (batchRows.length == batchSize) {
        endBatch();
        startBatch();
      }
      var row = data[r];
      if (row[statusColumnIndex] == "Succeeded") {
        skippedRecords++;
        continue;
      }
      importedRecords++;
      batchRows.push(row);
      row[statusColumnIndex] = "Queued";
      if (importAction == "delete") {
        var deleteId = doc.createElement("ID");
        deleteId.textContent = row[inputIdColumnIndex];
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
              if (c != inputIdColumnIndex) {
                var field = doc.createElement("fieldsToNull");
                if (columnName.length == 1) { // Our regexp ensures there are always one or three elements in the array
                  field.textContent = columnName[0];
                } else {
                  field.textContent = /__r$/.test(columnName[0]) ? columnName[0].replace(/__r$/, "__c") : columnName[0] + "Id";
                }
                sobjects.appendChild(field);
              }
            } else {
              if (columnName.length == 1) { // Our regexp ensures there are always one or three elements in the array
                // For Mozilla reviewers: `doc` is a SOAP XML document, which is never interpreted as a HTML or XHTML document, so using dynamic element names is secure in this case.
                var field = doc.createElement(columnName[0]);
                field.textContent = row[c];
              } else {
                var subType = doc.createElement("type");
                subType.textContent = columnName[1];
                // For Mozilla reviewers: `doc` is a SOAP XML document, which is never interpreted as a HTML or XHTML document, so using dynamic element names is secure in this case.
                var subField = doc.createElement(columnName[2]);
                subField.textContent = row[c];
                // For Mozilla reviewers: `doc` is a SOAP XML document, which is never interpreted as a HTML or XHTML document, so using dynamic element names is secure in this case.
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
    endBatch();

    if (vm.activeBatches() > 0) {
      importError("=== ERROR ===\nCannot start a new import while another is still in progress");
      return;
    }

    vm.confirmPopup({
      text: importedRecords + " records will be imported."
        + (skippedRecords > 0 ? " " + skippedRecords + " records will be skipped because they have __Status Succeeded." : ""),
      action: startProcessing
    });

    function updateResult() {
      importData({header: header, data: data, statusColumnIndex: statusColumnIndex, stopProcessing: stopProcessing});
    }

    function stopProcessing() {
      while (batches.length > 0) {
        var batch = batches.shift();
        vm.activeBatches(vm.activeBatches() - 1);
        batch.batchRows.forEach(function(row) {
          row[statusColumnIndex] = "Canceled";
        });
      }
      updateResult();
    }

    function startProcessing() {
      maxResults(1000);
      importError(null);
      updateResult();

      vm.activeBatches(batches.length);
      for (var i = 0; i < batchConcurrency && batches.length > 0; i++) {
        executeBatch();
      }
    }

    function executeBatch() {
      var batch = batches.shift();
      batch.batchRows.forEach(function(row) {
        row[statusColumnIndex] = "Processing";
      });
      updateResult();
      spinFor(askSalesforceSoap(batch.batchXml).then(function(res) {
        var results = res.querySelectorAll("Body result");
        for (var i = 0; i < results.length; i++) {
          var result = results[i];
          var row = batch.batchRows[i];
          if (result.querySelector("success").textContent == "true") {
            row[statusColumnIndex] = "Succeeded";
            row[actionColumnIndex] =
              importAction == "create" ? "Inserted"
              : importAction == "update" ? "Updated"
              : importAction == "upsert" ? (result.querySelector("created").textContent == "true" ? "Inserted" : "Updated")
              : importAction == "delete" ? "Deleted"
              : "Unknown";
          } else {
            row[statusColumnIndex] = "Failed";
            row[actionColumnIndex] = "";
          }
          row[resultIdColumnIndex] = result.querySelector("id").textContent;
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
          row[errorColumnIndex] = errors.join(", ");
        }
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
        batch.batchRows.forEach(function(row) {
          row[statusColumnIndex] = "Failed";
          row[resultIdColumnIndex] = "";
          row[actionColumnIndex] = "";
          row[errorColumnIndex] = errorText;
        });
      }).then(function() {
        updateResult();
        vm.activeBatches(vm.activeBatches() - 1);
        if (batches.length > 0) {
          executeBatch();
        }
      }).catch(function(error) {
        console.error("Unexpected exception", error);
        importError("UNEXPECTED EXCEPTION: " + error);
      }));
    }

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