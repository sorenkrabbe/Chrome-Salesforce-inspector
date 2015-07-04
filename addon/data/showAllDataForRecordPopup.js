function showAllData(recordDesc) {
  // Load a blank page and then inject the HTML to work around https://bugzilla.mozilla.org/show_bug.cgi?id=792479
  // An empty string as URL loads about:blank synchronously
  var popupWin;
  if (window.unsafeWindow && window.XPCNativeWrapper) {
    // Firefox
    // Use unsafeWindow to work around https://bugzilla.mozilla.org/show_bug.cgi?id=996069
    popupWin = new XPCNativeWrapper(unsafeWindow.open("", "", "width=850,height=800,scrollbars=yes"));
    // Note: The normal trick of using <a href="#" onclick="..."> to make a link activateable does not seem to work in an about:blank page in Firefox. Therefore we use <a href="about:blank" onclick="..."> instead.
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
  .value-blank {\
    color: #aaa;\
    font-style: italic;\
  }\
  .value-unknown {\
    color: #aaa;\
    font-style: italic;\
  }\
  tr.fieldCalculated {\
    font-style: italic;\
  }\
  tr.fieldHidden, tr.fieldHidden td[tabindex], tr.fieldHidden a[href] {\
    color: #777;\
  }\
  tr:hover {\
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
  .field-value textarea {\
    width: 100%;\
    resize: vertical;\
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
    width: 600px;\
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
  #fieldDetailsView td {\
    white-space: pre;\
  }\
  #fieldDetailsView .isString {\
    color: #990;\
  }\
  #fieldDetailsView .isNumber {\
    color: #909;\
  }\
  #fieldDetailsView .isBoolean {\
    color: #099;\
  }\
  .filter-input {\
    width: 20em;\
  }\
  h1 {\
    margin: 0;\
  }\
  .error-message {\
    font-size: 1.2em;\
    font-weight: bold;\
    margin: .5em 0;\
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
  .object-bar {\
    margin: .5em 0;\
  }\
  .object-actions {\
    float: right;\
  }\
  .child-list {\
    text-align: right;\
    width: 4em;\
  }\
  .child-setup {\
    text-align: right;\
    width: 4em;\
  }\
  .char-btn {\
    color: white;\
    text-decoration: none;\
    background-color: gray;\
    display: inline-block;\
    width: 14px;\
    height: 14px;\
    border-radius: 7px;\
    line-height: 14px;\
    text-align: center;\
    margin-left: -22px;\
  }\
  </style>\
  ';

  document.body.innerHTML = '\
  <img id="spinner" src="data:image/gif;base64,R0lGODlhIAAgAPUmANnZ2fX19efn5+/v7/Ly8vPz8/j4+Orq6vz8/Pr6+uzs7OPj4/f39/+0r/8gENvb2/9NQM/Pz/+ln/Hx8fDw8P/Dv/n5+f/Sz//w7+Dg4N/f39bW1v+If/9rYP96cP8+MP/h3+Li4v8RAOXl5f39/czMzNHR0fVhVt+GgN7e3u3t7fzAvPLU0ufY1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQFCAAmACwAAAAAIAAgAAAG/0CTcEhMEBSjpGgJ4VyI0OgwcEhaR8us6CORShHIq1WrhYC8Q4ZAfCVrHQ10gC12k7tRBr1u18aJCGt7Y31ZDmdDYYNKhVkQU4sCFAwGFQ0eDo14VXsDJFEYHYUfJgmDAWgmEoUXBJ2pQqJ2HIpXAp+wGJluEHsUsEMefXsMwEINw3QGxiYVfQDQ0dCoxgQl19jX0tIFzAPZ2dvRB8wh4NgL4gAPuKkIEeclAArqAALAGvElIwb1ABOpFOgrgSqDv1tREOTTt0FIAX/rDhQIQGBACHgDFQxJBxHawHBFHnQE8PFaBAtQHnYsWWKAlAkrP2r0UkBkvYERXKZKwFGcPhcAKI1NMLjt3IaZzIQYUNATG4AR1LwEAQAh+QQFCAAtACwAAAAAIAAgAAAG3MCWcEgstkZIBSFhbDqLyOjoEHhaodKoAnG9ZqUCxpPwLZtHq2YBkDq7R6dm4gFgv8vx5qJeb9+jeUYTfHwpTQYMFAKATxmEhU8kA3BPBo+EBFZpTwqXdQJdVnuXD6FWngAHpk+oBatOqFWvs10VIre4t7RFDbm5u0QevrjAQhgOwyIQxS0dySIcVipWLM8iF08mJRpcTijJH0ITRtolJREhA5lG374STuXm8iXeuctN8fPmT+0OIPj69Fn51qCJioACqT0ZEAHhvmIWADhkJkTBhoAUhwQYIfGhqSAAIfkEBQgAJgAsAAAAACAAIAAABshAk3BINCgWgCRxyWwKC5mkFOCsLhPIqdTKLTy0U251AtZyA9XydMRuu9mMtBrwro8ECHnZXldYpw8HBWhMdoROSQJWfAdcE1YBfCMJYlYDfASVVSQCdn6aThR8oE4Mo6RMBnwlrK2smahLrq4DsbKzrCG2RAC4JRF5uyYjviUawiYBxSWfThJcG8VVGB0iIlYKvk0VDR4O1tZ/s07g5eFOFhGtVebmVQOsVu3uTs3k8+DPtvgiDg3C+CCAQNbugz6C1iBwuGAlCAAh+QQFCAAtACwAAAAAIAAgAAAG28CWcEgstgDIhcJgbBYnTaQUkIE6r8bpdJHAeo9a6aNwVYXPaAChOSiZ0nBAqmmJlNzx8zx6v7/zUntGCn19Jk0BBQcPgVcbhYZYAnJXAZCFKlhrVyOXdxpfWACeEQihV54lIaeongOsTqmbsLReBiO4ubi1RQy6urxEFL+5wUIkAsQjCsYtA8ojs00sWCvQI11OKCIdGFcnygdX2yIiDh4NFU3gvwHa5fDx8uXsuMxN5PP68OwCpkb59gkEx2CawIPwVlxp4EBgMxAQ9jUTIuHDvIlDLnCIWA5WEAAh+QQFCAAmACwAAAAAIAAgAAAGyUCTcEgMjAClJHHJbAoVm6S05KwuLcip1ModRLRTblUB1nIn1fIUwG672YW0uvSuAx4JedleX1inESEDBE12cXIaCFV8GVwKVhN8AAZiVgJ8j5VVD3Z+mk4HfJ9OBaKjTAF8IqusqxWnTK2tDbBLsqwetUQQtyIOGLpCHL0iHcEmF8QiElYBXB/EVSQDIyNWEr1NBgwUAtXVVrytTt/l4E4gDqxV5uZVDatW7e5OzPLz3861+CMCDMH4FCgCaO6AvmMtqikgkKdKEAAh+QQFCAAtACwAAAAAIAAgAAAG28CWcEgstkpIwChgbDqLyGhpo3haodIowHK9ZqWRwZP1LZtLqmZDhDq7S6YmyCFiv8vxJqReb9+jeUYSfHwoTQQDIRGARhNCH4SFTwgacE8XkYQsVmlPHJl1HV1We5kOGKNPoCIeqaqgDa5OqxWytqMBALq7urdFBby8vkQHwbvDQw/GAAvILQLLAFVPK1YE0QAGTycjAyRPKcsZ2yPlAhQM2kbhwY5N3OXx5U7sus3v8vngug8J+PnyrIQr0GQFQH3WnjAQcHAeMgQKGjoTEuAAwIlDEhCIGM9VEAAh+QQFCAAmACwAAAAAIAAgAAAGx0CTcEi8cCCiJHHJbAoln6RU5KwuQcip1MptOLRTblUC1nIV1fK0xG672YO0WvSulyIWedleB1inDh4NFU12aHIdGFV8G1wSVgp8JQFiVhp8I5VVCBF2fppOIXygTgOjpEwEmCOsrSMGqEyurgyxS7OtFLZECrgjAiS7QgS+I3HCCcUjlFUTXAfFVgIAn04Bvk0BBQcP1NSQs07e499OCAKtVeTkVQysVuvs1lzx48629QAPBcL1CwnCTKzLwC+gQGoLFMCqEgQAIfkEBQgALQAsAAAAACAAIAAABtvAlnBILLZESAjnYmw6i8io6CN5WqHSKAR0vWaljsZz9S2bRawmY3Q6u0WoJkIwYr/L8aaiXm/fo3lGAXx8J00VDR4OgE8HhIVPGB1wTwmPhCtWaU8El3UDXVZ7lwIkoU+eIxSnqJ4MrE6pBrC0oQQluLm4tUUDurq8RCG/ucFCCBHEJQDGLRrKJSNWBFYq0CUBTykAAlYmyhvaAOMPBwXZRt+/Ck7b4+/jTuq4zE3u8O9P6hEW9vj43kqAMkLgH8BqTwo8MBjPWIIFDJsJmZDhX5MJtQwogNjwVBAAOw==" data-bind="visible: spinnerCount() > 0">\
  <h1>\
    <span data-bind="if: objectName()"><a href="about:blank" data-bind="text: objectName(), click: showObjectMetadata"></a></span>\
    <span data-bind="text: recordHeading()"></span>\
  </h1>\
  <div data-bind="foreach: errorMessages, visible: errorMessages().length > 0" class="error-message"><div data-bind="text: $data"></div></div>\
  <div class="object-bar">\
    <div class="object-actions">\
      <button title="View this record in Salesforce" data-bind="enable: canView(), click: doView">View</button>\
      <button title="Inline edit the values of this record" data-bind="enable: canEdit(), visible: !isEditing(), click: doEdit">Edit</button>\
      <button title="Inline edit the values of this record" data-bind="visible: isEditing(), click: doSave">Save</button>\
    </div>\
    <input class="filter-input" placeholder="Filter" data-bind="value: fieldRowsFilter, valueUpdate: \'input\', hasFocus: fieldRowsFilterFocus">\
    <a href="about:blank" class="char-btn" data-bind="click: clearAndFocusFilter">X</a>\
  </div>\
  <table>\
    <thead>\
      <th class="field-label" tabindex="0" data-bind="click: sortByLabel">Field Label</th>\
      <th class="field-name" tabindex="0" data-bind="click: sortByName">API Name</th>\
      <th class="field-value" tabindex="0" data-bind="click: sortByValue">Value</th>\
      <th class="field-type" tabindex="0" data-bind="click: sortByType">Type</th>\
      <th class="field-setup">Setup</th>\
    </thead>\
    <tbody id="dataTableBody" data-bind="foreach: fieldRows">\
      <tr data-bind="css: {fieldCalculated: fieldIsCalculated(), fieldHidden: fieldIsHidden()}, visible: visible()">\
        <td data-bind="text: fieldLabel()" class="field-label"></td>\
        <td data-bind="text: fieldName, attr: {title: summary()}, click: openDetails" tabindex="0" class="field-name"></td>\
        <td class="field-value">\
          <!-- ko if: isId() && !showEdit() --><a href="about:blank" data-bind="text: dataStringValue(), click: showRecordId" class="value-text"></a><!-- /ko -->\
          <!-- ko if: !isId() && !showEdit() --><span data-bind="text: dataStringValue()" class="value-text"></span><!-- /ko -->\
          <!-- ko if: !hasDataValue() --><span class="value-unknown">(Unknown)</span><!-- /ko -->\
          <!-- ko if: hasBlankValue() --><span class="value-blank">(Blank)</span><!-- /ko -->\
          <textarea data-bind="visible: showEdit(), value: dataStringValue"></textarea>\
        </td>\
        <td class="field-type">\
          <span data-bind="text: fieldTypeDesc(), visible: !referenceTypes()"></span>\
          <span data-bind="foreach: referenceTypes()">\
            <a href="about:blank" data-bind="text: $data, click: $parent.showReference"></a>\
          </span>\
        </td>\
        <td class="field-setup"><a href="about:blank" data-bind="visible: setupLink(), attr: {href: setupLink()}" target="_blank">Setup</a></td>\
      </tr>\
    </tbody>\
  </table>\
  <hr>\
  <table>\
    <thead>\
      <th class="child-name">Relationship Name</th>\
      <th class="child-object">Child Object</th>\
      <th class="child-field">Field</th>\
      <th class="child-list">List</th>\
      <th class="child-setup">Setup</th>\
    </thead>\
    <tbody id="dataTableBody" data-bind="foreach: childRows">\
      <tr data-bind="visible: visible()">\
        <td data-bind="text: childName, click: openDetails" tabindex="0" class="child-name"></td>\
        <td class="child-object"><a href="about:blank" data-bind="text: childObject, click: showChildObject"></a></td>\
        <td data-bind="text: childField" class="child-field"></td>\
        <td class="child-list"><a href="about:blank" data-bind="click: queryList, visible: $parent.canView()" title="Export records in this related list">List</a></td>\
        <td class="child-setup"><a href="about:blank" data-bind="visible: setupLink(), attr: {href: setupLink()}" target="_blank">Setup</a></td>\
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
                <td><a href="about:blank" data-bind="click: $parent.fieldDetailsFilterClick, visible: $parent.fieldDetails().showFilterButton" title="Show fields with this property">🔍</a> <span data-bind="text: key"></span></td>\
                <td data-bind="text: value, css: {isString: isString, isNumber: isNumber, isBoolean: isBoolean}"></td>\
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
  var fieldIds = ko.observable({});

  var vm = {
    spinnerCount: ko.observable(0),
    recordHeading: function() {
      if (recordData()) {
        return "(" + recordData().Name + " / " + recordData().Id + ")";
      }
      if (objectData()) {
        return"(" + objectData().label + " / " + objectData().keyPrefix + ")";
      }
      return "Loading all data...";
    },
    sobjectName: ko.observable(),
    objectName: function() {
      // Get with correct case if available, otherwise just return the input.
      return objectData() ? objectData().name : vm.sobjectName();
    },
    title: function() {
      return (objectData() ? "ALL DATA: " + objectData().name + " " : "") + vm.recordHeading();
    },
    errorMessages: ko.observableArray(),
    fieldRowsFilterFocus: ko.observable(true),
    fieldRowsFilter: ko.observable(""),
    fieldRows: ko.observableArray(),
    childRows: ko.observableArray(),
    clearAndFocusFilter: function() {
      vm.fieldRowsFilter("");
      vm.fieldRowsFilterFocus(true);
    },
    sortByLabel: function() {
      sortFieldRows("label");
    },
    sortByName: function() {
      sortFieldRows("name");
    },
    sortByValue: function() {
      sortFieldRows("dataValue");
    },
    sortByType: function() {
      sortFieldRows("type");
    },
    fieldDetailsFilterFocus: ko.observable(false),
    fieldDetailsFilter: ko.observable(""),
    fieldDetails: ko.observable(null),
    isEditing: ko.observable(false),
    closeFieldDetails: function() {
      vm.fieldDetails(null);
    },
    showObjectMetadata: function() {
      var objectDescribe = objectData();
      var props = {};
      addProperties(props, objectDescribe, "", {fields: true, childRelationships: true});
      showAllFieldMetadata(objectDescribe.name, props, false);
    },
    fieldDetailsFilterClick: function(field) {
      vm.closeFieldDetails();
      vm.fieldRowsFilter(field.key + "=" + JSON.stringify(field.value));
    },
    canEdit: function() {
      return objectData() && objectData().updateable && recordData() && recordData().Id;
    },
    doEdit: function() {
      vm.isEditing(true);
    },
    doSave: function() {
      var record = {};
      vm.fieldRows().forEach(function(fieldRow) {
        fieldRow.saveDataValue(record);
      });
      spinFor(
        "saving record",
        askSalesforce("/services/data/v34.0/sobjects/" + objectData().name + "/" + recordData().Id, null, {method: "PATCH", body: record})
          .then(function() {
            vm.errorMessages.push("Record saved successfully");
          })
      );
    },
    canView: function() {
      return recordData() && recordData().Id;
    },
    doView: function() {
      open("https://" + window.document.location.hostname + "/" + recordData().Id);
    }
  };

  function FieldRow(fieldName) {
    function fieldProperties() {
      var props = {};
      if (typeof fieldVm.dataTypedValue() != "undefined") {
        addProperties(props, {dataValue: fieldVm.dataTypedValue()}, "", {});
      }
      if (fieldVm.fieldDescribe()) {
      addProperties(props, fieldVm.fieldDescribe(), "desc.", {});
      }
      if (fieldVm.entityParticle()) {
        addProperties(props, fieldVm.entityParticle(), "part.", {});
      }
      return props;
    }

    var fieldVm = {
      fieldDescribe: ko.observable(),
      dataTypedValue: ko.observable(),
      dataStringValue: ko.observable(""),
      entityParticle: ko.observable(),

      fieldLabel: function() {
        if (fieldVm.fieldDescribe()) {
          return fieldVm.fieldDescribe().label;
        }
        if (fieldVm.entityParticle()) {
          return fieldVm.entityParticle().Label;
        }
        return "Unknown Label";
      },
      fieldName: fieldName,
      fieldTypeDesc: function() {
        var fieldDescribe = fieldVm.fieldDescribe();
        if (fieldDescribe) {
          return fieldDescribe.type == "reference"
          ? "[" + fieldDescribe.referenceTo.join(", ") + "]"
          : (fieldDescribe.type || "")
            + (fieldDescribe.length ? " (" + fieldDescribe.length + ")" : "")
            + (fieldDescribe.precision || fieldDescribe.scale ? " (" + fieldDescribe.precision + ", " + fieldDescribe.scale + ")" : "")
            + (fieldDescribe.calculated ? "*" : "");
        }
        var particle = fieldVm.entityParticle();
        if (particle) {
          return particle.DataType == "reference" && particle.FieldDefinition.ReferenceTo.referenceTo
          ? "[" + particle.FieldDefinition.ReferenceTo.referenceTo.join(", ") + "]"
          : (particle.DataType || "")
            + (particle.Length ? " (" + particle.Length + ")" : "")
            + (particle.Precision || particle.Scale ? " (" + particle.Precision + ", " + particle.Scale + ")" : "")
            + (particle.IsCalculated ? "*" : "");
        }
        return "(Unknown)";
      },
      referenceTypes: function() {
        var fieldDescribe = fieldVm.fieldDescribe();
        if (fieldDescribe) {
          return fieldDescribe.type == "reference" ? fieldDescribe.referenceTo : null;
        }
        var particle = fieldVm.entityParticle();
        if (particle) {
          return particle.DataType == "reference" ? particle.FieldDefinition.ReferenceTo.referenceTo : null;
        }
        return [];
      },
      fieldIsCalculated: function() {
        if (fieldVm.fieldDescribe()) {
          return fieldVm.fieldDescribe().calculated;
        }
        if (fieldVm.entityParticle()) {
          return fieldVm.entityParticle().IsCalculated;
        }
        return false;
      },
      fieldIsHidden: function() {
        return !fieldVm.fieldDescribe();
      },
      hasDataValue: function() {
        return typeof fieldVm.dataTypedValue() != "undefined";
      },
      hasBlankValue: function() {
        return fieldVm.dataTypedValue() === null;
      },
      saveDataValue: function(recordData) {
        if (fieldVm.fieldDescribe() && fieldVm.fieldDescribe().updateable) {
          recordData[fieldVm.fieldDescribe().name] = fieldVm.dataStringValue() == "" ? null : fieldVm.dataStringValue();
        }
      },
      setupLink: function() {
        var custom = fieldVm.fieldDescribe() ? fieldVm.fieldDescribe().custom : fieldName.endsWith("__c");
        return getFieldSetupLink(fieldIds(), {name: vm.objectName()}, {name: fieldName, custom: custom});
      },
      summary: function() {
        var fieldDescribe = fieldVm.fieldDescribe();
        if (fieldDescribe) {
          return fieldName + "\n"
            + (fieldDescribe.calculatedFormula ? "Formula: " + fieldDescribe.calculatedFormula + "\n" : "")
            + (fieldDescribe.inlineHelpText ? "Help text: " + fieldDescribe.inlineHelpText + "\n" : "")
            + (fieldDescribe.picklistValues && fieldDescribe.picklistValues.length > 0 ? "Picklist values: " + fieldDescribe.picklistValues.map(function(pickval) { return pickval.value; }).join(", ") + "\n" : "")
            ;
        }
        // Entity particle does not contain any of this information
        return fieldName + "\n(Details not available)";
      },
      showEdit: function() {
        return vm.isEditing() && fieldVm.fieldDescribe() && fieldVm.fieldDescribe().updateable;
      },
      isId: function() {
        if (fieldVm.fieldDescribe()) {
          return fieldVm.fieldDescribe().type == "reference" && !!fieldVm.dataTypedValue();
        }
        if (fieldVm.entityParticle()) {
          return fieldVm.entityParticle().DataType == "reference" && !!fieldVm.dataTypedValue();
        }
        return false;
      },
      openDetails: function() {
        showAllFieldMetadata(fieldName, fieldProperties(), true);
      },
      showRecordId: function() {
        showAllData({recordId: fieldVm.dataTypedValue()});
      },
      showReference: function() {
        showAllData({
          recordAttributes: {type: this, url: null},
          useToolingApi: false
        });
      },
      sortKeys: {
        label: function() { return fieldVm.fieldLabel().trim(); },
        name: function() { return fieldVm.fieldName.trim(); },
        dataValue: function() { return fieldVm.hasDataValue() ? fieldVm.dataStringValue().trim() : "\uFFFD"; },
        type: function() { return fieldVm.fieldTypeDesc().trim(); }
      },
      visible: function() {
        var values = vm.fieldRowsFilter().trim().split(/[ \t]+/);
        return values.every(function(value) {
          var pair = value.split("=");
          if (pair.length == 2) {
            try {
              return fieldProperties()[pair[0]] === JSON.parse(pair[1]);
            } catch(e) {
              return false;
            }
          } else {
            var row = fieldVm.fieldLabel() + "," + fieldVm.fieldName + "," + fieldVm.dataStringValue() + "," + fieldVm.fieldTypeDesc();
            return row.toLowerCase().indexOf(value.toLowerCase()) != -1;
          }
        });
      }
    };
    return fieldVm;
  }

  function ChildRow(childDescribe) {
    function childProperties() {
      var props = {};
      addProperties(props, childDescribe, "child.", {});
      return props;
    }

    var childVm = {
      childName: childDescribe.relationshipName,
      childObject: childDescribe.childSObject,
      childField: childDescribe.field,
      visible: function() {
        var values = vm.fieldRowsFilter().trim().split(/[ \t]+/);
        return values.every(function(value) {
          var pair = value.split("=");
          if (pair.length == 2) {
            try {
              return childProperties()[pair[0]] === JSON.parse(pair[1]);
            } catch(e) {
              return false;
            }
          } else {
            var row = childVm.childName + "," + childVm.childObject + "," + childVm.childField;
            return row.toLowerCase().indexOf(value.toLowerCase()) != -1;
          }
        });
      },
      openDetails: function() {
        showAllFieldMetadata(childDescribe.relationshipName, childProperties(), true);
      },
      showChildObject: function() {
        showAllData({
          recordAttributes: {type: childDescribe.childSObject, url: null},
          useToolingApi: false
        });
      },
      setupLink: function() {
        return getFieldSetupLink(fieldIds(), {name: childDescribe.childSObject}, {name: childDescribe.field, custom: childDescribe.field.endsWith("__c")});
      },
      queryList: function() {
        dataExport({query: "select Id from " + childDescribe.childSObject + " where " + childDescribe.field + " = '" + recordData().Id + "'"});
      }
    };
    return childVm;
  }

  function addProperties(map, object, prefix, ignore) {
    for (var key in object) {
      var value = object[key];
      if (ignore[key]) {
      } else if (value && typeof value == "object") {
        addProperties(map, value, prefix + key + ".", {});
      } else {
        map[prefix + key] = value;
      }
    }
  }
  function showAllFieldMetadata(name, allFieldMetadata, showFilterButton) {
    var fieldDetailVms = [];
    for (var key in allFieldMetadata) {
      var value = allFieldMetadata[key];
      fieldDetailVms.push({
        key: key,
        value: value,
        isString: typeof value == "string",
        isNumber: typeof value == "number",
        isBoolean: typeof value == "boolean",
        visible: function() {
          var value = vm.fieldDetailsFilter().trim().toLowerCase();
          return !value || this.toLowerCase().indexOf(value) != -1;
        }.bind(key + "," + value)
      });
    }
    vm.fieldDetails({rows: fieldDetailVms, name: name, showFilterButton: showFilterButton});
    vm.fieldDetailsFilterFocus(true);
  }

  var sortCol = "name";
  var sortDir = 1;
  function sortFieldRows(col) {
    sortDir = col == sortCol ? -sortDir : 1;
    sortCol = col;
    resortFieldRows();
  }
  function resortFieldRows() {
    vm.fieldRows.sort(function(a, b) {
      return sortDir * a.sortKeys[sortCol]().localeCompare(b.sortKeys[sortCol]());
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

  var sobjectInfoPromise;
  if ("recordId" in recordDesc) {
    sobjectInfoPromise = Promise
      .all([
        askSalesforce('/services/data/v34.0/sobjects/'),
        askSalesforce('/services/data/v34.0/tooling/sobjects/')
      ])
      .then(function(responses) {
        var currentObjKeyPrefix = recordDesc.recordId.substring(0, 3);
        for (var x = 0; x < responses.length; x++) {
          var generalMetadataResponse = responses[x];
          for (var i = 0; i < generalMetadataResponse.sobjects.length; i++) {
            var sobject = generalMetadataResponse.sobjects[i];
            if (sobject.keyPrefix == currentObjKeyPrefix || sobject.name.toLowerCase() == recordDesc.recordId.toLowerCase()) {
              var sobjectInfo = {};
              sobjectInfo.sobjectName = sobject.name;
              sobjectInfo.sobjectDescribePromise = askSalesforce(sobject.urls.describe);
              if (recordDesc.recordId.length < 15) {
                sobjectInfo.recordDataPromise = null; // Just a prefix, don't attempt to load the record
              } else if (!sobject.retrieveable) {
                sobjectInfo.recordDataPromise = null;
                vm.errorMessages.push("This object does not support showing all data");
              } else {
                sobjectInfo.recordDataPromise = askSalesforce(sobject.urls.rowTemplate.replace("{ID}", recordDesc.recordId));
              }
              return sobjectInfo;
            }
          }
        }
        throw 'Unknown salesforce object: ' + recordDesc.recordId;
      });
  } else if ("recordAttributes" in recordDesc) {
    var sobjectInfo = {};
    sobjectInfo.sobjectName = recordDesc.recordAttributes.type;
    sobjectInfo.sobjectDescribePromise = askSalesforce("/services/data/v34.0/" + (recordDesc.useToolingApi ? "tooling/" : "") + "sobjects/" + recordDesc.recordAttributes.type + "/describe/");
    if (!recordDesc.recordAttributes.url) {
      sobjectInfo.recordDataPromise = null; // No record url
    } else {
      sobjectInfo.recordDataPromise = askSalesforce(recordDesc.recordAttributes.url);
    }
    sobjectInfoPromise = Promise.resolve(sobjectInfo);
  } else {
    throw "unknown input for showAllData";
  }
  spinFor("describing global", sobjectInfoPromise.then(function(sobjectInfo) {

    vm.sobjectName(sobjectInfo.sobjectName);

    var fieldMap = {};

    // Fetch object data using object describe call
    spinFor("describing object", sobjectInfo.sobjectDescribePromise.then(function(sobjectDescribe) {
      // Display the retrieved object data
      objectData(sobjectDescribe);
      sobjectDescribe.fields.forEach(function(fieldDescribe) {
        var fieldRow = fieldMap[fieldDescribe.name];
        if (!fieldRow) {
          fieldRow = new FieldRow(fieldDescribe.name);
          vm.fieldRows.push(fieldRow);
          fieldMap[fieldDescribe.name] = fieldRow;
        }
        fieldRow.fieldDescribe(fieldDescribe);
      });
      resortFieldRows();
      sobjectDescribe.childRelationships.forEach(function(childDescribe) {
        vm.childRows.push(new ChildRow(childDescribe));
      });
    }));

    // Fetch record data using record retrieve call
    if (sobjectInfo.recordDataPromise) {
      spinFor("retrieving record", sobjectInfo.recordDataPromise.then(function(res) {
        for (var name in res) {
          if (name != "attributes") {
            var fieldRow = fieldMap[name];
            if (!fieldRow) {
              fieldRow = new FieldRow(name);
              vm.fieldRows.push(fieldRow);
              fieldMap[name] = fieldRow;
            }
            fieldRow.dataTypedValue(res[name]);
            fieldRow.dataStringValue(res[name] == null ? "" : "" + res[name]);
          }
        }
        resortFieldRows();
        recordData(res);
      }));
    }

    // Fetch fields using Tooling API call, which contains fields not readable by the current user, but fails if the user does not have access to the Tooling API, and is much less stable.
    // These fields are not queried since Salesforce returns an error for some objects if these fields are incluced in the query: IsApiFilterable, IsApiSortable, IsApiGroupable, FieldDefinition.IsApiFilterable, FieldDefinition.IsApiSortable, FieldDefinition.IsApiGroupable, FieldDefinition.DataType, IsCompactLayoutable, FieldDefinition.IsCompactLayoutable
    spinFor("querying tooling particles", askSalesforce("/services/data/v34.0/tooling/query/?q=" + encodeURIComponent("select\
      Id, DurableId, QualifiedApiName, EntityDefinitionId, FieldDefinitionId, NamespacePrefix, DeveloperName, MasterLabel, Label, Length, DataType, ServiceDataTypeId, ExtraTypeInfo, IsCalculated, IsHighScaleNumber, IsHtmlFormatted, IsNameField, IsNillable, IsWorkflowFilterable, Precision, Scale, IsFieldHistoryTracked, IsListVisible,\
      FieldDefinition.Id, FieldDefinition.DurableId, FieldDefinition.QualifiedApiName, FieldDefinition.EntityDefinitionId, FieldDefinition.NamespacePrefix, FieldDefinition.DeveloperName, FieldDefinition.MasterLabel, FieldDefinition.Label, FieldDefinition.Length, FieldDefinition.ServiceDataTypeId, FieldDefinition.ExtraTypeInfo, FieldDefinition.IsCalculated, FieldDefinition.IsHighScaleNumber, FieldDefinition.IsHtmlFormatted, FieldDefinition.IsNameField, FieldDefinition.IsNillable, FieldDefinition.IsWorkflowFilterable, FieldDefinition.Precision, FieldDefinition.Scale, FieldDefinition.IsFieldHistoryTracked, FieldDefinition.IsListFilterable, FieldDefinition.IsListSortable, FieldDefinition.IsListVisible, FieldDefinition.ControllingFieldDefinitionId, FieldDefinition.LastModifiedDate, FieldDefinition.LastModifiedById, FieldDefinition.PublisherId, FieldDefinition.RunningUserFieldAccessId, FieldDefinition.RelationshipName, FieldDefinition.ReferenceTo, FieldDefinition.ReferenceTargetField,\
      ServiceDataType.Id, ServiceDataType.DurableId, ServiceDataType.Name, ServiceDataType.IsComplex, ServiceDataType.ServiceId, ServiceDataType.Namespace, ServiceDataType.NamespacePrefix,\
      FieldDefinition.Publisher.Id, FieldDefinition.Publisher.DurableId, FieldDefinition.Publisher.Name, FieldDefinition.Publisher.NamespacePrefix, FieldDefinition.Publisher.IsSalesforce\
      from EntityParticle where EntityDefinition.QualifiedApiName = '" + sobjectInfo.sobjectName + "'"))
      .then(function(res) {
        res.records.forEach(function(entityParticle) {
          var fieldRow = fieldMap[entityParticle.QualifiedApiName];
          if (!fieldRow) {
            fieldRow = new FieldRow(entityParticle.QualifiedApiName);
            vm.fieldRows.push(fieldRow);
            fieldMap[entityParticle.QualifiedApiName] = fieldRow;
          }
          fieldRow.entityParticle(entityParticle);
        });
        resortFieldRows();
      }));
    /*
    // Uncomment this code to test if the query works for all objects in an org. If it fails for some objects, it may be fixable by querying less fields.
    spinFor("testing", askSalesforce("/services/data/v34.0/tooling/query/?q=" + encodeURIComponent("select QualifiedApiName from EntityDefinition ")).then(function(res) {
      res.records.forEach(function(record) {
        spinFor("testing for " + record.QualifiedApiName, askSalesforce("/services/data/v34.0/tooling/query/?q=" + encodeURIComponent("select\
      Id, DurableId, QualifiedApiName, EntityDefinitionId, FieldDefinitionId, NamespacePrefix, DeveloperName, MasterLabel, Label, Length, DataType, ServiceDataTypeId, ExtraTypeInfo, IsCalculated, IsHighScaleNumber, IsHtmlFormatted, IsNameField, IsNillable, IsWorkflowFilterable, Precision, Scale, IsFieldHistoryTracked, IsListVisible,\
      FieldDefinition.Id, FieldDefinition.DurableId, FieldDefinition.QualifiedApiName, FieldDefinition.EntityDefinitionId, FieldDefinition.NamespacePrefix, FieldDefinition.DeveloperName, FieldDefinition.MasterLabel, FieldDefinition.Label, FieldDefinition.Length, FieldDefinition.ServiceDataTypeId, FieldDefinition.ExtraTypeInfo, FieldDefinition.IsCalculated, FieldDefinition.IsHighScaleNumber, FieldDefinition.IsHtmlFormatted, FieldDefinition.IsNameField, FieldDefinition.IsNillable, FieldDefinition.IsWorkflowFilterable, FieldDefinition.Precision, FieldDefinition.Scale, FieldDefinition.IsFieldHistoryTracked, FieldDefinition.IsListFilterable, FieldDefinition.IsListSortable, FieldDefinition.IsListVisible, FieldDefinition.ControllingFieldDefinitionId, FieldDefinition.LastModifiedDate, FieldDefinition.LastModifiedById, FieldDefinition.PublisherId, FieldDefinition.RunningUserFieldAccessId, FieldDefinition.RelationshipName, FieldDefinition.ReferenceTo, FieldDefinition.ReferenceTargetField,\
      ServiceDataType.Id, ServiceDataType.DurableId, ServiceDataType.Name, ServiceDataType.IsComplex, ServiceDataType.ServiceId, ServiceDataType.Namespace, ServiceDataType.NamespacePrefix,\
      FieldDefinition.Publisher.Id, FieldDefinition.Publisher.DurableId, FieldDefinition.Publisher.Name, FieldDefinition.Publisher.NamespacePrefix, FieldDefinition.Publisher.IsSalesforce\
      from EntityParticle where EntityDefinition.QualifiedApiName = '" + record.QualifiedApiName + "'")));
      });
    }));
    */

    // Fetch field ids to build links to field setup ui pages
    spinFor("getting setup links", loadFieldSetupData(sobjectInfo.sobjectName).then(function(res) {
      fieldIds(res);
    }));

  }));

}