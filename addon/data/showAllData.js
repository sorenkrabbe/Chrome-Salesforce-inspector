if (!this.isUnitTest) {

var args = JSON.parse(atob(decodeURIComponent(location.search.substring(1))));
var recordDesc = args.recordDesc;
orgId = args.orgId;
chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
  session = message;
  var popupWin = window;

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

});

}
