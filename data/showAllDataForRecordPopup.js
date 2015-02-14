function showAllData(recordDesc) {
  // Load a blank page and then inject the HTML to work around https://bugzilla.mozilla.org/show_bug.cgi?id=792479
  // An empty string as URL loads about:blank synchronously
  var popupWin;
  if (window.unsafeWindow && window.XPCNativeWrapper) {
    // Firefox
    // Use unsafeWindow to work around https://bugzilla.mozilla.org/show_bug.cgi?id=996069
    popupWin = new XPCNativeWrapper(unsafeWindow.open("", "", "width=850,height=800,scrollbars=yes"));
  } else {
    // Chrome
    popupWin = open("", "", "width=850,height=800,scrollbars=yes");
  }
  window.addEventListener("pagehide", function() {
    // All JS runs in the parent window, and will stop working when the parent goes away. Therefore close the popup.
    popupWin.close();
  });
  var document = popupWin.document;
  document.head.innerHTML = '\
  <title data-bind="text: title()"></title>\
  <style>\
  body {\
    font-family: Arial, Helvetica, sans-serif;\
    font-size: 11px;\
  }\
  table {\
    width: 100%;\
    border-spacing: 0px;\
    font-size: 11px;\
    table-layout: fixed;\
  }\
  .value-text {\
    word-wrap: break-word;\
    white-space: pre-wrap;\
  }\
  tr.calculated {\
    color: #777777;\
    font-style: italic;\
  }\
  tr:hover, tr.calculated:hover {\
    background-color: lightblue;\
  }\
  th {\
    text-align: left;\
  }\
  .field-label {\
    width: 20em;\
  }\
  .field-name {\
    width: 20em;\
  }\
  .field-value {\
    text-align: right;\
  }\
  .field-type {\
    text-align: right;\
    width: 9em;\
  }\
  .field-setup {\
    text-align: right;\
    width: 4em;\
  }\
  span[tabindex], td[tabindex], th[tabindex] {\
    text-decoration: underline;\
    cursor: pointer;\
    color: darkblue;\
  }\
  #fieldDetailsView {\
    position: fixed;\
    top: 0;\
    right: 0;\
    bottom: 0;\
    left: 0;\
    background: rgba(0,0,0,0.8);\
    z-index: 99999;\
  }\
  \
  #fieldDetailsView > div.container {\
    width: 400px;\
    height: 500px;\
    position: relative;\
    margin: 10% auto;\
    border-radius: 10px;\
    background: #fff;\
  }\
  #fieldDetailsView > div.container > div.mainContent {\
    overflow: auto;\
    height: 470px;\
    padding: 5px 20px 13px 20px;\
  }\
  .closeLnk {\
    background: #606061;\
    color: #FFFFFF;\
    line-height: 25px;\
    position: absolute;\
    right: -12px;\
    text-align: center;\
    top: -10px;\
    width: 24px;\
    text-decoration: none;\
    font-weight: bold;\
    border-radius: 12px;\
    box-shadow: 1px 1px 3px #000;\
  }\
  .closeLnk:hover {\
    background: #00d9ff;\
  }\
  .filter-input {\
    width: 20em;\
  }\
  .error-message {\
    font-size: 1.2em;\
    font-weight: bold;\
    margin: 1em 0;\
    background-color: #fe3;\
    padding: .5em;\
    border: 1px solid red;\
    border-radius: 7px;\
  }\
  #spinner {\
    position: absolute;\
    left: -15px;\
    top: -15px;\
  }\
  </style>\
  ';

  document.body.innerHTML = '\
  <img id="spinner" src="data:image/gif;base64,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" data-bind="visible: spinnerCount() > 0">\
  <h1>\
    <span data-bind="if: objectName()"><a href="about:blank" data-bind="text: objectName(), click: showObjectMetadata"></a></span>\
    <span data-bind="text: recordHeading()"></span>\
  </h1>\
  <div data-bind="foreach: errorMessages, visible: errorMessages().length > 0" class="error-message"><div data-bind="text: $data"></div></div>\
  <input class="filter-input" placeholder="Filter" data-bind="value: fieldRowsFilter, valueUpdate: \'input\'" autofocus>\
  <table>\
    <thead>\
      <th class="field-label" tabindex="0" data-bind="click: sortByLabel">Field Label</th>\
      <th class="field-name" tabindex="0" data-bind="click: sortByName">API Name</th>\
      <th class="field-value" tabindex="0" data-bind="click: sortByValue">Value</th>\
      <th class="field-type" tabindex="0" data-bind="click: sortByType">Type</th>\
      <th class="field-setup">Setup</th>\
    </thead>\
    <tbody id="dataTableBody" data-bind="foreach: fieldRows">\
      <tr data-bind="css: {calculated: fieldIsCalculated}, visible: visible()">\
        <td data-bind="text: fieldLabel" class="field-label"></td>\
        <td data-bind="text: fieldName, attr: {title: summary()}, click: openDetails" tabindex="0" class="field-name"></td>\
        <td class="field-value">\
          <!-- ko if: isId() --><a href="about:blank" data-bind="text: dataValue(), click: showRecordId" class="value-text"></a><!-- /ko -->\
          <!-- ko if: !isId() --><span data-bind="text: dataValue()" class="value-text"></span><!-- /ko -->\
        </td>\
        <td data-bind="text: fieldTypeDesc" class="field-type"></td>\
        <td class="field-setup"><a href="about:blank" data-bind="visible: setupLink(), attr: {href: setupLink()}" target="_blank">Setup</a></td>\
      </tr>\
    </tbody>\
  </table>\
  <div data-bind="if: fieldDetails()">\
    <div id="fieldDetailsView">\
      <div class="container">\
        <a href="about:blank" class="closeLnk" data-bind="click: closeFieldDetails">X</a>\
        <div class="mainContent">\
          <h3>All available metadata for "<span data-bind="text: fieldDetails().name"></span>"</h3>\
          <input placeholder="Filter" data-bind="value: fieldDetailsFilter, valueUpdate: \'input\', hasFocus: fieldDetailsFilterFocus">\
          <table>\
            <thead><tr><th>Key</th><th>Value</th></tr></thead>\
            <tbody data-bind="foreach: fieldDetails().rows">\
              <tr data-bind="visible: visible()">\
                <td data-bind="text: key"></td>\
                <td data-bind="text: value"></td>\
              </tr>\
            </tbody>\
          </table>\
        </div>\
      </div>\
    </div>\
  </div>\
  ';

  var objectData = ko.observable(null);
  var recordData = ko.observable(null);
  var toolingFieldDefinitions = ko.observable({});
  var fieldIds = ko.observable({});

  var vm = {
    spinnerCount: ko.observable(0),
    recordHeading: function() {
      return recordData() ? "(" + recordData().Name + " / " + recordData().Id + ")" : "Loading all data..."
    },
    objectName: function() {
      return objectData() && objectData().name;
    },
    title: function() {
      return (objectData() ? "ALL DATA: " + objectData().name + " " : "") + vm.recordHeading();
    },
    errorMessages: ko.observableArray(),
    fieldRowsFilter: ko.observable(""),
    fieldRows: ko.observableArray(),
    sortByLabel: function() {
      sortFieldRows("label", function(r) { return r.fieldLabel; });
    },
    sortByName: function() {
      sortFieldRows("name", function(r) { return r.fieldName; });
    },
    sortByValue: function() {
      sortFieldRows("dataValue", function(r) { return "" + r.dataValue(); });
    },
    sortByType: function() {
      sortFieldRows("type", function(r) { return r.fieldTypeDesc; });
    },
    fieldDetailsFilterFocus: ko.observable(false),
    fieldDetailsFilter: ko.observable(""),
    fieldDetails: ko.observable(null),
    closeFieldDetails: function() {
      vm.fieldDetails(null);
    },
    showObjectMetadata: function() {
      showAllFieldMetadata(objectData());
    }
  };

  function FieldRow(fieldDescribe, sobjectDescribe) {
    var fieldTypeDesc =
      fieldDescribe.type == "reference"
        ? "[" + fieldDescribe.referenceTo.join(", ") + "]"
        : fieldDescribe.type
          + (fieldDescribe.length != 0 ? " (" + fieldDescribe.length + ")" : "")
          + (fieldDescribe.precision != 0 || fieldDescribe.scale ? " (" + fieldDescribe.precision + ", " + fieldDescribe.scale + ")" : "")
          + (fieldDescribe.calculated ? "*" : "");
    function fieldDescription() {
      return toolingFieldDefinitions()[fieldDescribe.name] && toolingFieldDefinitions()[fieldDescribe.name].Metadata.description;
    }

    var fieldVm = {
      fieldLabel: fieldDescribe.label,
      fieldName: fieldDescribe.name,
      fieldTypeDesc: fieldTypeDesc,
      fieldIsCalculated: fieldDescribe.calculated,
      dataValue: function() {
        return recordData() && recordData()[fieldDescribe.name];
      },
      setupLink: function() {
        return getFieldSetupLink(fieldIds(), sobjectDescribe, fieldDescribe);
      },
      summary: function() {
        return fieldDescribe.name + "\n"
          + (fieldDescribe.calculatedFormula ? "Formula: " + fieldDescribe.calculatedFormula + "\n" : "")
          + (fieldDescription() ? "Description: " + fieldDescription() + "\n" : "")
          + (fieldDescribe.inlineHelpText ? "Help text: " + fieldDescribe.inlineHelpText + "\n" : "")
          + (fieldDescribe.picklistValues.length > 0 ? "Picklist values: " + fieldDescribe.picklistValues.map(function(pickval) { return pickval.value; }).join(", ") + "\n" : "")
          ;
      },
      isId: function() {
        return fieldDescribe.type == "reference" && fieldVm.dataValue();
      },
      openDetails: function() {
        var map = {};
        for (var key in fieldDescribe) {
          map[key] = fieldDescribe[key];
        }
        map.dataValue = fieldVm.dataValue();
        map.description = fieldDescription();
        showAllFieldMetadata(map);
      },
      showRecordId: function() {
        showAllData({recordId: fieldVm.dataValue()});
      },
      visible: function() {
        var value = vm.fieldRowsFilter().trim().toLowerCase();
        var row = fieldVm.fieldLabel + "," + fieldVm.fieldName + "," + fieldVm.dataValue() + "," + fieldVm.fieldTypeDesc;
        return !value || row.toLowerCase().indexOf(value) != -1;
      }
    };
    return fieldVm;
  }

  function showAllFieldMetadata(allFieldMetadata) {
    var fieldDetailVms = [];
    for (var key in allFieldMetadata) {
      var value = JSON.stringify(allFieldMetadata[key]);
      fieldDetailVms.push({
        key: key,
        value: value,
        visible: function() {
          var value = vm.fieldDetailsFilter().trim().toLowerCase();
          return !value || this.toLowerCase().indexOf(value) != -1;
        }.bind(key + "," + value)
      });
    }
    vm.fieldDetails({rows: fieldDetailVms, name: allFieldMetadata.name});
    vm.fieldDetailsFilterFocus(true);
  }

  var sortCol = "";
  var sortDir = -1;
  function sortFieldRows(col, value) {
    sortDir = col == sortCol ? -sortDir : 1;
    sortCol = col;
    vm.fieldRows.sort(function(a, b) {
      return sortDir * value(a).trim().localeCompare(value(b).trim());
    });
  }

  ko.applyBindings(vm, document.documentElement);

  function spinFor(actionName, promise) {
    vm.spinnerCount(vm.spinnerCount() + 1);
    promise
      .then(null, function(error) {
        if (error && error.responseText) {
          error = error.responseText;
        }
        console.error(error);
        vm.errorMessages.push("Error " + actionName + ": " + error);
      })
      .then(stopSpinner, stopSpinner);
  }
  function stopSpinner() {
    vm.spinnerCount(vm.spinnerCount() - 1);
  }

  // Fetch object data using object describe call
  var sobjectDescribePromise;
  if ("recordId" in recordDesc) {
    sobjectDescribePromise = loadMetadataForRecordId(recordDesc.recordId);
  } else if ("recordAttributes" in recordDesc) {
    sobjectDescribePromise = askSalesforce("/services/data/v33.0/" + (recordDesc.useToolingApi ? "tooling/" : "") + "sobjects/" + recordDesc.recordAttributes.type + "/describe/");
  } else {
    throw "unknown input for showAllData";
  }
  spinFor("getting metadata", sobjectDescribePromise.then(function(sobjectDescribe) {
    // Display the retrieved object data
    objectData(sobjectDescribe);
    vm.fieldRows.removeAll();
    sobjectDescribe.fields.forEach(function(fieldDescribe) {
      vm.fieldRows.push(new FieldRow(fieldDescribe, sobjectDescribe));
    });
    
    // Fetch record data using record retrieve call
    if (sobjectDescribe.retrieveable) {
      var recordDataPromise;
      if ("recordId" in recordDesc) {
        if (recordDesc.recordId.length < 15) {
          recordDataPromise = Promise.resolve({}); // Just a prefix, don't attempt to load the record
        } else {
          recordDataPromise = askSalesforce(sobjectDescribe.urls.rowTemplate.replace("{ID}", recordDesc.recordId));
        }
      } else if ("recordAttributes" in recordDesc) {
        recordDataPromise = askSalesforce(recordDesc.recordAttributes.url);
      } else {
        throw "unknown input for showAllData";
      }
      spinFor("getting record data", recordDataPromise.then(function(res) {
        recordData(res);
      }));
    } else {
      recordData({}); // Hides the loading indicator
      vm.errorMessages.push("This object does not support showing all data");
    }

    // Fetch extra field metadata (field descriptions) using Tooling API call
    spinFor("getting field descriptions", askSalesforce("/services/data/v33.0/tooling/query/?q=" + encodeURIComponent("select QualifiedApiName, Metadata from FieldDefinition where EntityDefinitionId = '" + sobjectDescribe.name + "'"))
      .then(function(res) {
        var map = {};
        res.records.forEach(function(fd) {
          map[fd.QualifiedApiName] = fd;
        });
        toolingFieldDefinitions(map);
      }));

    spinFor("getting setup links", loadFieldSetupData(sobjectDescribe.name).then(function(res) {
      fieldIds(res);
    }));

  }));

}