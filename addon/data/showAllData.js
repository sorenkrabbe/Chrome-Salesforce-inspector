if (!this.isUnitTest) {

var args = JSON.parse(atob(decodeURIComponent(location.search.substring(1))));
var recordDesc = args.recordDesc;
orgId = args.orgId;
chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
  session = message;
  var popupWin = window;

  var objectData = ko.observable(null);
  var recordData = ko.observable(null);
  var setupLinkData = ko.observable(null);

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
    sortByName: function() {
      sortFieldRows("name");
    },
    sortByLabel: function() {
      sortFieldRows("label");
    },
    sortByHelptext: function() {
      sortFieldRows("helptext");
    },
    sortByDesc: function() {
      sortFieldRows("desc");
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
    hasEntityParticles: ko.observable(false),
    showFieldLabelColumn: ko.observable(true),
    showFieldHelptextColumn: ko.observable(false),
    showFieldDescriptionColumn: ko.observable(false),
    showFieldValueColumn: ko.observable(false),
    showFieldTypeColumn: ko.observable(true),
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
        askSalesforce("/services/data/v35.0/sobjects/" + objectData().name + "/" + recordData().Id, null, {method: "PATCH", body: record})
          .then(function() {
            vm.errorMessages.push("Record saved successfully");
          })
      );
    },
    canView: function() {
      return recordData() && recordData().Id;
    },
    viewLink: function() {
      return recordData() && recordData().Id && "https://" + session.hostname + "/" + recordData().Id;
    },
    setupLink: function() {
      return vm.objectName() && getObjectSetupLink(setupLinkData(), vm.objectName());
    },
  };

  var fetchFieldDescriptions = vm.showFieldDescriptionColumn.subscribe(function() {
    fetchFieldDescriptions.dispose();
    vm.fieldRows().forEach(function(fieldRow) { fieldRow.showFieldDescription(); });
  });

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
      if (fieldVm.fieldParticleMetadata()) {
        addProperties(props, fieldVm.fieldParticleMetadata(), "meta.", {});
      }
      return props;
    }

    var fieldVm = {
      fieldDescribe: ko.observable(),
      dataTypedValue: ko.observable(),
      dataStringValue: ko.observable(""),
      entityParticle: ko.observable(),
      fieldParticleMetadata: ko.observable(),

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
      hasFieldHelptext: function() {
        return typeof fieldVm.fieldHelptext() != "undefined";
      },
      fieldHelptext: function() {
        return fieldVm.fieldDescribe() && fieldVm.fieldDescribe().inlineHelpText;
      },
      hasFieldDesc: function() {
        return typeof fieldVm.fieldDesc() != "undefined";
      },
      fieldDesc: function() {
        return fieldVm.fieldParticleMetadata() && fieldVm.fieldParticleMetadata().Metadata.description;
      },
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
        return getFieldSetupLink(setupLinkData(), vm.objectName(), fieldName);
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
        name: function() { return fieldVm.fieldName.trim(); },
        label: function() { return fieldVm.fieldLabel().trim(); },
        helptext: function() { return (fieldVm.fieldHelptext() || "").trim(); },
        desc: function() { return (fieldVm.fieldDesc() || "").trim(); },
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
            var row = fieldVm.fieldName
              + "," + (vm.showFieldLabelColumn() ? fieldVm.fieldLabel() : "")
              + "," + (vm.showFieldHelptextColumn() ? fieldVm.fieldHelptext() || "" : "")
              + "," + (vm.showFieldDescriptionColumn() ? fieldVm.fieldDesc() || "" : "")
              + "," + (vm.showFieldValueColumn() ? fieldVm.dataStringValue() : "")
              + "," + (vm.showFieldTypeColumn() ? fieldVm.fieldTypeDesc() : "");
            return row.toLowerCase().indexOf(value.toLowerCase()) != -1;
          }
        });
      },
      showFieldDescription: function() {
        if (!fieldVm.entityParticle()) {
          return;
        }
        spinFor("getting field definition metadata for " + fieldName, askSalesforce("/services/data/v35.0/tooling/query/?q=" + encodeURIComponent("select Metadata from FieldDefinition where DurableId = '" + fieldVm.entityParticle().FieldDefinition.DurableId + "'"))
          .then(function(fieldDefs) {
            fieldVm.fieldParticleMetadata(fieldDefs.records[0]);
          }));
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
        return getFieldSetupLink(setupLinkData(), childDescribe.childSObject, childDescribe.field);
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
        askSalesforce('/services/data/v35.0/sobjects/'),
        askSalesforce('/services/data/v35.0/tooling/sobjects/')
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
              } else if (sobject.name.toLowerCase() == recordDesc.recordId.toLowerCase()) {
                sobjectInfo.recordDataPromise = null; // Not a record ID, don't attempt to load the record
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
    sobjectInfo.sobjectDescribePromise = askSalesforce("/services/data/v35.0/" + (recordDesc.useToolingApi ? "tooling/" : "") + "sobjects/" + recordDesc.recordAttributes.type + "/describe/");
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
        vm.showFieldValueColumn(true);
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

    // Fetch fields using a Tooling API call, which returns fields not readable by the current user, but fails if the user does not have access to the Tooling API.
    // The Tooling API is not very stable. It often gives "An unexpected error occurred. Please include this ErrorId if you contact support".
    // We would like to query all meta-fields, to show them when the user clicks a field for more details.
    // But, the more meta-fields we query, the more likely the query is to fail, and the meta-fields that cause failure vary depending on the entity we query, the org we are in, and the current Salesforce release.
    // Therefore qe query the minimum set of meta-fields needed by our main UI.
    spinFor("querying tooling particles", askSalesforce("/services/data/v35.0/tooling/query/?q=" + encodeURIComponent("select QualifiedApiName, Label, DataType, FieldDefinition.ReferenceTo, Length, Precision, Scale, IsCalculated, FieldDefinition.DurableId from EntityParticle where EntityDefinition.QualifiedApiName = '" + sobjectInfo.sobjectName + "'"))
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
        vm.hasEntityParticles(true);
        resortFieldRows();
      }));

    // Fetch field ids to build links to field setup ui pages
    spinFor("getting setup links", loadSetupLinkData(sobjectInfo.sobjectName).then(function(res) {
      setupLinkData(res);
    }));

  }));

});

}
