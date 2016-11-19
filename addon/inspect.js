"use strict";
if (!this.isUnitTest) {

let args = new URLSearchParams(location.search.slice(1));
sfHost = args.get("host");
initButton(true);
chrome.runtime.sendMessage({message: "getSession", sfHost}, message => {
  session = message;

  let vm = {
    callbacks: [],
    didUpdate(cb) {
      vm.callbacks.forEach(f => f(cb));
    },
    sfLink: "https://" + sfHost,
    spinnerCount: 0,
    objectData: null,
    recordData: null,
    layoutInfo: null,
    isDragging: false,
    recordHeading() {
      if (vm.recordData) {
        return "(" + vm.recordData.Name + " / " + vm.recordData.Id + ")";
      }
      if (vm.objectData) {
        return"(" + vm.objectData.label + " / " + vm.objectData.keyPrefix + ")";
      }
      return "Loading all data...";
    },
    sobjectName: undefined,
    objectName() {
      // Get with correct case if available, otherwise just return the input.
      return vm.objectData ? vm.objectData.name : vm.sobjectName;
    },
    title() {
      return (vm.objectData ? "ALL DATA: " + vm.objectData.name + " " : "") + vm.recordHeading();
    },
    errorMessages: [],
    rowsFilter: "",
    fieldRows: [],
    childRows: [],
    onRowsFilterInput(e) {
      vm.rowsFilter = e.target.value;
      vm.didUpdate();
    },
    onDetailsFilterInput(e) {
      vm.detailsFilter = e.target.value;
      vm.didUpdate();
    },
    onShowFieldLabelColumnChange(e) {
      vm.showFieldLabelColumn = e.target.checked;
      vm.didUpdate();
    },
    onShowFieldHelptextColumnChange(e) {
      vm.showFieldHelptextColumn = e.target.checked;
      vm.didUpdate();
    },
    fetchFieldDescriptions: true,
    onShowFieldDescriptionColumnChange(e) {
      if (vm.fetchFieldDescriptions) {
        vm.fetchFieldDescriptions = false;
        vm.fieldRows.forEach(fieldRow => fieldRow.showFieldDescription());
      }
      vm.showFieldDescriptionColumn = e.target.checked;
      vm.didUpdate();
    },
    onShowFieldValueColumnChange(e) {
      vm.showFieldValueColumn = e.target.checked;
      vm.didUpdate();
    },
    onShowFieldTypeColumnChange(e) {
      vm.showFieldTypeColumn = e.target.checked;
      vm.didUpdate();
    },
    clearAndFocusFilter(e, rowsFilter) {
      e.preventDefault();
      vm.rowsFilter = "";
      rowsFilter.focus();
      vm.didUpdate();
    },
    sortFieldsByName() {
      fieldRowList.sortRows("name");
      vm.didUpdate();
    },
    sortFieldsByLabel() {
      fieldRowList.sortRows("label");
      vm.didUpdate();
    },
    sortFieldsByHelptext() {
      fieldRowList.sortRows("helptext");
      vm.didUpdate();
    },
    sortFieldsByDesc() {
      fieldRowList.sortRows("desc");
      vm.didUpdate();
    },
    sortFieldsByValue() {
      fieldRowList.sortRows("dataValue");
      vm.didUpdate();
    },
    sortFieldsByType() {
      fieldRowList.sortRows("type");
      vm.didUpdate();
    },
    sortChildsByName() {
      childRowList.sortRows("name");
      vm.didUpdate();
    },
    sortChildsByObject() {
      childRowList.sortRows("object");
      vm.didUpdate();
    },
    sortChildsByField() {
      childRowList.sortRows("field");
      vm.didUpdate();
    },
    sortChildsByLabel() {
      childRowList.sortRows("label");
      vm.didUpdate();
    },
    detailsFilter: "",
    detailsBox: null,
    isEditing: false,
    hasEntityParticles: false,
    showFieldLabelColumn: true,
    showFieldHelptextColumn: false,
    showFieldDescriptionColumn: false,
    showFieldValueColumn: false,
    showFieldTypeColumn: true,
    closeDetailsBox(e) {
      if (e) {
        e.preventDefault();
      }
      vm.detailsBox = null;
      vm.didUpdate();
    },
    showObjectMetadata(e, cb) {
      e.preventDefault();
      let objectDescribe = vm.objectData;
      let props = {};
      addProperties(props, objectDescribe, "desc.", {fields: true, childRelationships: true});
      addProperties(props, vm.layoutInfo, "layout.", {detailLayoutSections: true, editLayoutSections: true, relatedLists: true});
      showAllFieldMetadata(objectDescribe.name, props, false);
      vm.didUpdate(cb);
    },
    detailsFilterClick(e, field) {
      e.preventDefault();
      vm.closeDetailsBox();
      vm.rowsFilter = field.key + "=" + JSON.stringify(field.value);
      vm.didUpdate();
    },
    tableMouseDown() {
      vm.isDragging = false;
    },
    tableMouseMove(e) {
      if (e.nativeEvent.movementX || e.nativeEvent.movementY) {
        vm.isDragging = true;
      }
    },
    tableClick(e) {
      if (!e.nativeEvent.target.closest("a, textarea") && !vm.isDragging) {
        let td = e.nativeEvent.target.closest(".quick-select");
        if (td) {
          getSelection().selectAllChildren(td.firstElementChild || td);
        }
      }
    },
    canEdit() {
      return vm.objectData && vm.objectData.updateable && vm.recordData && vm.recordData.Id;
    },
    doEdit() {
      for (let fieldRow of vm.fieldRows) {
        if (fieldRow.canEdit()) {
          fieldRow.dataEditValue = fieldRow.dataStringValue();
        }
      }
      vm.isEditing = true;
      vm.didUpdate();
    },
    doSave() {
      let i = vm.errorMessages.findIndex(e => e.startsWith("Error saving record:"));
      vm.errorMessages.splice(i, 1);
      let record = {};
      vm.fieldRows.forEach(fieldRow => fieldRow.saveDataValue(record));
      let recordUrl = vm.objectData.urls.rowTemplate.replace("{ID}", vm.recordData.Id);
      spinFor(
        "saving record",
        askSalesforce(recordUrl, null, {method: "PATCH", body: record}),
        () => {
          clearRecordData();
          setRecordData(askSalesforce(recordUrl));
          vm.didUpdate();
        }
      );
      vm.didUpdate();
    },
    cancelEdit() {
      let i = vm.errorMessages.findIndex(e => e.startsWith("Error saving record:"));
      vm.errorMessages.splice(i, 1);
      for (let fieldRow of vm.fieldRows) {
        fieldRow.dataEditValue = null;
      }
      vm.isEditing = false;
      vm.didUpdate();
    },
    canView() {
      return vm.recordData && vm.recordData.Id;
    },
    viewLink() {
      return vm.recordData && vm.recordData.Id && "https://" + sfHost + "/" + vm.recordData.Id;
    },
    openSetup() {
      let args = new URLSearchParams();
      args.set("host", sfHost);
      args.set("object", vm.objectName());
      return "open-object-setup.html?" + args;
    },
  };

  function RowList(rows, constructor) {
    let map = new Map();
    let sortCol = "name";
    let sortDir = 1;
    let reactKey = 0;
    let list = {
      getRow(name) {
        if (!name) { // related lists may not have a name
          let row = new constructor(name, reactKey++);
          rows.push(row);
          return row;
        }
        let row = map.get(name);
        if (!row) {
          row = new constructor(name, reactKey++);
          rows.push(row);
          map.set(name, row);
        }
        return row;
      },
      sortRows(col) {
        sortDir = col == sortCol ? -sortDir : 1;
        sortCol = col;
        list.resortRows();
      },
      resortRows() {
        rows.sort((a, b) => sortDir * a.sortKeys[sortCol]().localeCompare(b.sortKeys[sortCol]()));
      }
    };
    return list;
  }

  var fieldRowList = new RowList(vm.fieldRows, FieldRow);

  function FieldRow(fieldName, reactKey) {
    function fieldProperties() {
      let props = {};
      if (typeof fieldVm.dataTypedValue != "undefined") {
        addProperties(props, {dataValue: fieldVm.dataTypedValue}, "", {});
      }
      if (fieldVm.fieldDescribe) {
      addProperties(props, fieldVm.fieldDescribe, "desc.", {});
      }
      if (fieldVm.entityParticle) {
        addProperties(props, fieldVm.entityParticle, "part.", {});
      }
      if (fieldVm.fieldParticleMetadata) {
        addProperties(props, fieldVm.fieldParticleMetadata, "meta.", {});
      }
      if (fieldVm.detailLayoutInfo) {
        addProperties(props, fieldVm.detailLayoutInfo.indexes, "layout.", {});
        addProperties(props, fieldVm.detailLayoutInfo.section, "layoutSection.", {layoutRows: true});
        addProperties(props, fieldVm.detailLayoutInfo.row, "layoutRow.", {layoutItems: true});
        addProperties(props, fieldVm.detailLayoutInfo.item, "layoutItem.", {layoutComponents: true});
        addProperties(props, fieldVm.detailLayoutInfo.component, "layoutComponent.", {details: true});
      } else if (vm.layoutInfo) {
        addProperties(props, {shownOnLayout: false}, "layout.", {});
      }
      if (fieldVm.editLayoutInfo) {
        addProperties(props, fieldVm.editLayoutInfo.indexes, "editLayout.", {});
        addProperties(props, fieldVm.editLayoutInfo.section, "editLayoutSection.", {layoutRows: true});
        addProperties(props, fieldVm.editLayoutInfo.row, "editLayoutRow.", {layoutItems: true});
        addProperties(props, fieldVm.editLayoutInfo.item, "editLayoutItem.", {layoutComponents: true});
        addProperties(props, fieldVm.editLayoutInfo.component, "editLayoutComponent.", {details: true});
      } else if (vm.layoutInfo) {
        addProperties(props, {shownOnLayout: false}, "editLayout.", {});
      }
      return props;
    }

    let fieldVm = {
      reactKey,
      fieldDescribe: undefined,
      dataTypedValue: undefined,
      dataEditValue: null,
      detailLayoutInfo: undefined,
      editLayoutInfo: undefined,
      entityParticle: undefined,
      fieldParticleMetadata: undefined,

      onDataEditValueInput(e) {
        fieldVm.dataEditValue = e.target.value;
        vm.didUpdate();
      },
      dataStringValue() {
        return fieldVm.dataTypedValue == null ? "" : "" + fieldVm.dataTypedValue;
      },
      fieldLabel() {
        if (fieldVm.fieldDescribe) {
          return fieldVm.fieldDescribe.label;
        }
        if (fieldVm.entityParticle) {
          return fieldVm.entityParticle.Label;
        }
        return "Unknown Label";
      },
      fieldName: fieldName,
      hasFieldHelptext() {
        return typeof fieldVm.fieldHelptext() != "undefined";
      },
      fieldHelptext() {
        return fieldVm.fieldDescribe && fieldVm.fieldDescribe.inlineHelpText;
      },
      hasFieldDesc() {
        return typeof fieldVm.fieldDesc() != "undefined";
      },
      fieldDesc() {
        return fieldVm.fieldParticleMetadata && fieldVm.fieldParticleMetadata.Metadata.description;
      },
      fieldTypeDesc() {
        let fieldDescribe = fieldVm.fieldDescribe;
        if (fieldDescribe) {
          return fieldDescribe.type == "reference"
          ? "[" + fieldDescribe.referenceTo.join(", ") + "]"
          : (fieldDescribe.type || "")
            + (fieldDescribe.length ? " (" + fieldDescribe.length + ")" : "")
            + (fieldDescribe.precision || fieldDescribe.scale ? " (" + fieldDescribe.precision + ", " + fieldDescribe.scale + ")" : "")
            + (fieldDescribe.calculated ? "*" : "");
        }
        let particle = fieldVm.entityParticle;
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
      referenceTypes() {
        let fieldDescribe = fieldVm.fieldDescribe;
        if (fieldDescribe) {
          return fieldDescribe.type == "reference" ? fieldDescribe.referenceTo : null;
        }
        let particle = fieldVm.entityParticle;
        if (particle) {
          return particle.DataType == "reference" ? particle.FieldDefinition.ReferenceTo.referenceTo : null;
        }
        return [];
      },
      fieldIsCalculated() {
        if (fieldVm.fieldDescribe) {
          return fieldVm.fieldDescribe.calculated;
        }
        if (fieldVm.entityParticle) {
          return fieldVm.entityParticle.IsCalculated;
        }
        return false;
      },
      fieldIsHidden() {
        return !fieldVm.fieldDescribe;
      },
      hasDataValue() {
        return typeof fieldVm.dataTypedValue != "undefined";
      },
      hasBlankValue() {
        return fieldVm.dataTypedValue === null;
      },
      openSetup() {
        let args = new URLSearchParams();
        args.set("host", sfHost);
        args.set("object", vm.objectName());
        args.set("field", fieldName);
        return "open-field-setup.html?" + args;
      },
      summary() {
        let fieldDescribe = fieldVm.fieldDescribe;
        if (fieldDescribe) {
          return fieldName + "\n"
            + (fieldDescribe.calculatedFormula ? "Formula: " + fieldDescribe.calculatedFormula + "\n" : "")
            + (fieldDescribe.inlineHelpText ? "Help text: " + fieldDescribe.inlineHelpText + "\n" : "")
            + (fieldDescribe.picklistValues && fieldDescribe.picklistValues.length > 0 ? "Picklist values: " + fieldDescribe.picklistValues.map(pickval => pickval.value).join(", ") + "\n" : "")
            ;
        }
        // Entity particle does not contain any of this information
        return fieldName + "\n(Details not available)";
      },
      isEditing() {
        return typeof fieldVm.dataEditValue == "string";
      },
      canEdit() {
        return fieldVm.fieldDescribe && fieldVm.fieldDescribe.updateable;
      },
      tryEdit(e) {
        if (!fieldVm.isEditing() && vm.canEdit() && fieldVm.canEdit()) {
          fieldVm.dataEditValue = fieldVm.dataStringValue();
          vm.isEditing = true;
          let td = e.nativeEvent.currentTarget;
          vm.didUpdate(() => td.querySelector("textarea").focus());
        }
      },
      cancelEdit(e) {
        e.preventDefault();
        fieldVm.dataEditValue = null;
        vm.didUpdate();
      },
      saveDataValue(recordData) {
        if (fieldVm.isEditing()) {
          recordData[fieldVm.fieldDescribe.name] = fieldVm.dataEditValue == "" ? null : fieldVm.dataEditValue;
        }
      },
      isId() {
        if (fieldVm.fieldDescribe) {
          return fieldVm.fieldDescribe.type == "reference" && !!fieldVm.dataTypedValue;
        }
        if (fieldVm.entityParticle) {
          return fieldVm.entityParticle.DataType == "reference" && !!fieldVm.dataTypedValue;
        }
        return false;
      },
      openDetails(e, cb) {
        e.preventDefault();
        showAllFieldMetadata(fieldName, fieldProperties(), true);
        vm.didUpdate(cb);
      },
      showRecordIdUrl() {
        let args = new URLSearchParams();
        args.set("host", sfHost);
        args.set("q", fieldVm.dataTypedValue);
        return "inspect.html?" + args;
      },
      showReferenceUrl(type) {
        let args = new URLSearchParams();
        args.set("host", sfHost);
        args.set("q", type);
        return "inspect.html?" + args;
      },
      sortKeys: {
        name: () => fieldVm.fieldName.trim(),
        label: () => fieldVm.fieldLabel().trim(),
        helptext: () => (fieldVm.fieldHelptext() || "").trim(),
        desc: () => (fieldVm.fieldDesc() || "").trim(),
        dataValue: () => fieldVm.hasDataValue() ? fieldVm.dataStringValue().trim() : "\uFFFD",
        type: () => fieldVm.fieldTypeDesc().trim()
      },
      visible() {
        let values = vm.rowsFilter.trim().split(/[ \t]+/);
        return values.every(value => {
          let pair = value.split("=");
          if (pair.length == 2) {
            try {
              return fieldProperties()[pair[0]] === JSON.parse(pair[1]);
            } catch(e) {
              return false;
            }
          } else {
            let row = fieldVm.fieldName
              + "," + (vm.showFieldLabelColumn ? fieldVm.fieldLabel() : "")
              + "," + (vm.showFieldHelptextColumn ? fieldVm.fieldHelptext() || "" : "")
              + "," + (vm.showFieldDescriptionColumn ? fieldVm.fieldDesc() || "" : "")
              + "," + (vm.showFieldValueColumn ? fieldVm.dataStringValue() : "")
              + "," + (vm.showFieldTypeColumn ? fieldVm.fieldTypeDesc() : "");
            return row.toLowerCase().indexOf(value.toLowerCase()) != -1;
          }
        });
      },
      showFieldDescription() {
        if (!fieldVm.entityParticle) {
          return;
        }
        spinFor(
          "getting field definition metadata for " + fieldName,
          askSalesforce("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("select Metadata from FieldDefinition where DurableId = '" + fieldVm.entityParticle.FieldDefinition.DurableId + "'")),
          fieldDefs => {
            fieldVm.fieldParticleMetadata = fieldDefs.records[0];
            vm.didUpdate();
          }
        );
        vm.didUpdate();
      }
    };
    return fieldVm;
  }

  var childRowList = new RowList(vm.childRows, ChildRow);
  
  function ChildRow(childName, reactKey) {
    function childProperties() {
      let props = {};
      if (childVm.childDescribe) {
        addProperties(props, childVm.childDescribe, "child.", {});
      }
      if (childVm.relatedListInfo) {
        addProperties(props, childVm.relatedListInfo, "layout.", {});
      } else if (vm.layoutInfo) {
        addProperties(props, {shownOnLayout: false}, "layout.", {});
      }
      return props;
    }

    let childVm = {
      reactKey,
      childDescribe: undefined,
      relatedListInfo: undefined,
      childName: childName,
      childObject() {
        if (childVm.childDescribe) {
          return childVm.childDescribe.childSObject;
        }
        if (childVm.relatedListInfo) {
          return childVm.relatedListInfo.relatedList.sobject;
        }
        return "(Unknown)";
      },
      childField() {
        if (childVm.childDescribe) {
          return childVm.childDescribe.field;
        }
        if (childVm.relatedListInfo) {
          return childVm.relatedListInfo.relatedList.field;
        }
        return "(Unknown)";
      },
      childLabel() {
        if (childVm.relatedListInfo) {
          return childVm.relatedListInfo.relatedList.label;
        }
        return "";
      },
      sortKeys: {
        name: () => (childVm.childName || "").trim(),
        object: () => (childVm.childObject() || "").trim(),
        field: () => (childVm.childField() || "").trim(),
        label: () => (childVm.childLabel() || "").trim()
      },
      visible() {
        let values = vm.rowsFilter.trim().split(/[ \t]+/);
        return values.every(value => {
          let pair = value.split("=");
          if (pair.length == 2) {
            try {
              return childProperties()[pair[0]] === JSON.parse(pair[1]);
            } catch(e) {
              return false;
            }
          } else {
            let row = childVm.childName + "," + childVm.childObject() + "," + childVm.childField() + "," + childVm.childLabel();
            return row.toLowerCase().indexOf(value.toLowerCase()) != -1;
          }
        });
      },
      openDetails(e, cb) {
        e.preventDefault();
        showAllFieldMetadata(childName, childProperties(), true);
        vm.didUpdate(cb);
      },
      showChildObjectUrl() {
        let childDescribe = childVm.childDescribe;
        if (childDescribe) {
          let args = new URLSearchParams();
          args.set("host", sfHost);
          args.set("q", childDescribe.childSObject);
          return "inspect.html?" + args;
        }
        return "";
      },
      openSetup() {
        let childDescribe = childVm.childDescribe;
        if (childDescribe) {
          let args = new URLSearchParams();
          args.set("host", sfHost);
          args.set("object", childDescribe.childSObject);
          args.set("field", childDescribe.field);
          return "open-field-setup.html?" + args;
        }
        let relatedListInfo = childVm.relatedListInfo;
        if (relatedListInfo) {
          let args = new URLSearchParams();
          args.set("host", sfHost);
          args.set("object", relatedListInfo.relatedList.sobject);
          args.set("field", relatedListInfo.relatedList.field);
          return "open-field-setup.html?" + args;
        }
        return "open-field-setup.html";
      },
      queryListUrl() {
        if (!vm.recordData || !vm.recordData.Id) {
          return "";
        }
        function dataExportUrl(query) {
          let args = new URLSearchParams();
          args.set("host", sfHost);
          args.set("query", query);
          return "data-export.html?" + args;
        }
        let relatedListInfo = childVm.relatedListInfo;
        if (relatedListInfo) {
          return dataExportUrl("select Id, " + relatedListInfo.relatedList.columns.map(c => c.name).join(", ") + " from " + relatedListInfo.relatedList.sobject + " where " + relatedListInfo.relatedList.field + " = '" + vm.recordData.Id + "'");
        }
        let childDescribe = childVm.childDescribe;
        if (childDescribe) {
          return dataExportUrl("select Id from " + childDescribe.childSObject + " where " + childDescribe.field + " = '" + vm.recordData.Id + "'");
        }
        return "";
      }
    };
    return childVm;
  }

  function addProperties(map, object, prefix, ignore) {
    for (let key in object) {
      let value = object[key];
      if (ignore[key]) {
      } else if (value && typeof value == "object") {
        addProperties(map, value, prefix + key + ".", {});
      } else {
        map[prefix + key] = value;
      }
    }
  }
  function showAllFieldMetadata(name, allFieldMetadata, showFilterButton) {
    let fieldDetailVms = [];
    for (let key in allFieldMetadata) {
      let value = allFieldMetadata[key];
      let row = key + "," + value;
      fieldDetailVms.push({
        key,
        value,
        isString: typeof value == "string",
        isNumber: typeof value == "number",
        isBoolean: typeof value == "boolean",
        visible() {
          let value = vm.detailsFilter.trim().toLowerCase();
          return !value || row.toLowerCase().indexOf(value) != -1;
        }
      });
    }
    vm.detailsBox = {rows: fieldDetailVms, name: name, showFilterButton: showFilterButton};
  }

  let App = React.createClass({
    getInitialState() {
      return {vm};
    },
    componentDidMount() {
      vm.callbacks.push(this.cb);
      this.refs.rowsFilter.focus();
    },
    componentWillUnmount() {
      let i = vm.callbacks.indexOf(this.cb);
      vm.callbacks.splice(i, 1);
    },
    cb(cb) {
      this.setState({vm}, cb);
    },
    detailsFilterFocus() {
      this.refs.detailsFilter.focus();
    },
    render() {
      document.title = vm.title();
      return (
React.createElement("div", {},
  React.createElement("div", {className: "object-bar"},
    React.createElement("img", {id: "spinner", src: "data:image/gif;base64,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", hidden: vm.spinnerCount == 0}),
    React.createElement("a", {href: vm.sfLink, className: "sf-link"},
      React.createElement("svg", {viewBox: "0 0 24 24"},
        React.createElement("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
      ),
      " Back to Salesforce"
    ),
    React.createElement("span", {className: "filter-box"},
      React.createElement("input", {className: "filter-input", placeholder: "Filter", value: vm.rowsFilter, onInput: vm.onRowsFilterInput, ref: "rowsFilter"}),
      React.createElement("a", {href: "about:blank", className: "char-btn", onClick: e => vm.clearAndFocusFilter(e, this.refs.rowsFilter)}, "X")
    ),
    React.createElement("span", {className: "column-toggles"},
      React.createElement("label", {},
        React.createElement("input", {type: "checkbox", checked: vm.showFieldLabelColumn, onChange: vm.onShowFieldLabelColumnChange}),
        " Label"
      ),
      React.createElement("label", {},
        React.createElement("input", {type: "checkbox", checked: vm.showFieldHelptextColumn, onChange: vm.onShowFieldHelptextColumnChange}),
        " Help text"
      ),
      React.createElement("label", {},
        React.createElement("input", {type: "checkbox", checked: vm.showFieldDescriptionColumn, onChange: vm.onShowFieldDescriptionColumnChange, disabled: !vm.hasEntityParticles}),
        " Description"
      ),
      React.createElement("label", {},
        React.createElement("input", {type: "checkbox", checked: vm.showFieldValueColumn, onChange: vm.onShowFieldValueColumnChange, disabled: !vm.canView()}),
        " Value"
      ),
      React.createElement("label", {},
        React.createElement("input", {type: "checkbox", checked: vm.showFieldTypeColumn, onChange: vm.onShowFieldTypeColumnChange}),
        " Type"
      )
    ),
    React.createElement("span", {className: "object-actions"},
      vm.canView() ? React.createElement("a", {href: vm.viewLink(), title: "View this record in Salesforce"}, "View") : null,
      " ",
      vm.objectName() ? React.createElement("a", {href: "about:blank", onClick: e => vm.showObjectMetadata(e, this.detailsFilterFocus)}, "More") : null,
      " ",
      vm.objectName() ? React.createElement("a", {href: vm.openSetup()}, "Setup") : null
    )
  ),
  React.createElement("div", {className: "body " + (!vm.showFieldLabelColumn && !vm.showFieldHelptextColumn && !vm.showFieldDescriptionColumn && !vm.showFieldValueColumn && !vm.showFieldTypeColumn ? "empty " : "")},
    React.createElement("h1", {},
      vm.objectName(),
      " ",
      vm.recordHeading(),
      " ",
      !vm.isEditing ? React.createElement("button", {title: "Inline edit the values of this record", disabled: !vm.canEdit() || !vm.showFieldValueColumn, onClick: vm.doEdit}, "Edit") : null,
      " ",
      vm.isEditing ? React.createElement("button", {title: "Inline edit the values of this record", onClick: vm.doSave}, "Save") : null,
      " ",
      vm.isEditing ? React.createElement("button", {title: "Inline edit the values of this record", onClick: vm.cancelEdit}, "Cancel") : null
    ),
    React.createElement("div", {hidden: vm.errorMessages.length == 0, className: "error-message"}, vm.errorMessages.map((data, index) => React.createElement("div", {key: index}, data))),
    React.createElement("table", {},
      React.createElement("thead", {},
        React.createElement("tr", {},
          React.createElement("th", {className: "field-name", tabIndex: 0, onClick: vm.sortFieldsByName}, "Field API Name"),
          vm.showFieldLabelColumn ? React.createElement("th", {className: "field-label", tabIndex: 0, onClick: vm.sortFieldsByLabel}, "Label") : null,
          vm.showFieldHelptextColumn ? React.createElement("th", {className: "field-helptext", tabIndex: 0, onClick: vm.sortFieldsByHelptext}, "Help text") : null,
          vm.showFieldDescriptionColumn ? React.createElement("th", {className: "field-desc", tabIndex: 0, onClick: vm.sortFieldsByDesc}, "Description") : null,
          vm.showFieldValueColumn ? React.createElement("th", {className: "field-value", tabIndex: 0, onClick: vm.sortFieldsByValue}, "Value") : null,
          vm.showFieldTypeColumn ? React.createElement("th", {className: "field-type", tabIndex: 0, onClick: vm.sortFieldsByType}, "Type") : null,
          React.createElement("th", {className: "field-actions"}, "Actions")
        )
      ),
      React.createElement("tbody", {id: "dataTableBody", onClick: vm.tableClick, onMouseMove: vm.tableMouseMove, onMouseDown: vm.tableMouseDown}, vm.fieldRows.map(row =>
        React.createElement("tr", {className: (row.fieldIsCalculated() ? "fieldCalculated " : "") + (row.fieldIsHidden() ? "fieldHidden " : ""), hidden: !row.visible(), title: row.summary(), key: row.reactKey},
          React.createElement("td", {className: "field-name quick-select"}, row.fieldName),
          vm.showFieldLabelColumn ? React.createElement("td", {className: "field-label quick-select"}, row.fieldLabel()) : null,
          vm.showFieldHelptextColumn ? React.createElement("td", {className: "field-helptext " + (row.hasFieldHelptext() ? "quick-select " : "value-unknown ")},
            row.hasFieldHelptext() ? row.fieldHelptext() : "(Unknown)"
          ) : null,
          vm.showFieldDescriptionColumn ? React.createElement("td", {className: "field-desc " + (row.hasFieldDesc() ? "quick-select " : "value-unknown")},
            row.hasFieldDesc() ? row.fieldDesc() : "(Unknown)"
          ) : null,
          vm.showFieldValueColumn ? React.createElement("td", {className: "field-value quick-select", onDoubleClick: row.tryEdit},
            row.isId() && !row.isEditing() ? React.createElement("a", {href: row.showRecordIdUrl(), className: "value-text"}, row.dataStringValue()) : null,
            !row.isId() && !row.isEditing() ? React.createElement("span", {className: "value-text"}, row.dataStringValue()) : null,
            !row.hasDataValue() && !row.isEditing() ? React.createElement("span", {className: "value-unknown"}, "(Unknown)") : null,
            row.hasBlankValue() && !row.isEditing() ? React.createElement("span", {className: "value-blank"}, "(Blank)") : null,
            row.isEditing() ? React.createElement("textarea", {value: row.dataEditValue, onChange: row.onDataEditValueInput}) : null,
            row.isEditing() ? React.createElement("a", {href: "about:blank", onClick: row.cancelEdit, className: "undo-button"}, "\u21B6") : null
          ) : null,
          vm.showFieldTypeColumn ? React.createElement("td", {className: "field-type quick-select"},
            row.referenceTypes()
              ? row.referenceTypes().map(data =>
                React.createElement("span", {key: data}, React.createElement("a", {href: row.showReferenceUrl(data)}, data), " ")
              )
              : row.fieldTypeDesc()
          ) : null,
          React.createElement("td", {className: "field-actions"},
            React.createElement("a", {href: "about:blank", onClick: e => row.openDetails(e, this.detailsFilterFocus)}, "More"),
            " ",
            React.createElement("a", {href: row.openSetup()}, "Setup")
          )
        )
      ))
    ),
    React.createElement("hr", {}),
    React.createElement("table", {},
      React.createElement("thead", {},
        React.createElement("tr", {},
          React.createElement("th", {className: "child-name", tabIndex: 0, onClick: vm.sortChildsByName}, "Relationship Name"),
          React.createElement("th", {className: "child-object", tabIndex: 0, onClick: vm.sortChildsByObject}, "Child Object"),
          React.createElement("th", {className: "child-field", tabIndex: 0, onClick: vm.sortChildsByField}, "Field"),
          React.createElement("th", {className: "child-label", tabIndex: 0, onClick: vm.sortChildsByLabel}, "Label"),
          React.createElement("th", {className: "child-actions"}, "Actions")
        )
      ),
      React.createElement("tbody", {id: "dataTableBody", onClick: vm.tableClick, onMouseMove: vm.tableMouseMove, onMouseDown: vm.tableMouseDown}, vm.childRows.map(row =>
        React.createElement("tr", {hidden: !row.visible(), key: row.reactKey},
          React.createElement("td", {className: "child-name quick-select"}, row.childName),
          React.createElement("td", {className: "child-object quick-select"}, React.createElement("a", {href: row.showChildObjectUrl()}, row.childObject())),
          React.createElement("td", {className: "child-field quick-select"}, row.childField()),
          React.createElement("td", {className: "child-label quick-select"}, row.childLabel()),
          React.createElement("td", {className: "child-actions"},
            React.createElement("a", {href: "about:blank", onClick: e => row.openDetails(e, this.detailsFilterFocus)}, "More"),
            " ",
            row.queryListUrl() ? React.createElement("a", {href: row.queryListUrl(), title: "Export records in this related list"}, "List") : null,
            " ",
            React.createElement("a", {href: row.openSetup()}, "Setup")
          )
        )
      ))
    )
  ),
  vm.detailsBox ? React.createElement("div", {},
    React.createElement("div", {id: "fieldDetailsView"},
      React.createElement("div", {className: "container"},
        React.createElement("a", {href: "about:blank", className: "closeLnk", onClick: vm.closeDetailsBox}, "X"),
        React.createElement("div", {className: "mainContent"},
          React.createElement("h3", {}, "All available metadata for \"" + vm.detailsBox.name + "\""),
          React.createElement("input", {placeholder: "Filter", value: vm.detailsFilter, onInput: vm.onDetailsFilterInput, ref: "detailsFilter"}),
          React.createElement("table", {},
            React.createElement("thead", {}, React.createElement("tr", {}, React.createElement("th", {}, "Key"), React.createElement("th", {}, "Value"))),
            React.createElement("tbody", {}, vm.detailsBox.rows.map(row =>
              React.createElement("tr", {hidden: !row.visible(), key: row.key},
                React.createElement("td", {}, React.createElement("a", {href: "about:blank", onClick: e => vm.detailsFilterClick(e, row), hidden: !vm.detailsBox.showFilterButton, title: "Show fields with this property"}, "🔍"), " " + row.key),
                React.createElement("td", {className: (row.isString ? "isString " : "") + (row.isNumber ? "isNumber " : "") + (row.isBoolean ? "isBoolean " : "")}, row.value)
              )
            ))
          )
        )
      )
    )
  ) : null
)
      );
    }
  });
  ReactDOM.render(React.createElement(App, {}), document.getElementById("root"));

  function setRecordData(recordDataPromise) {
    spinFor("retrieving record", recordDataPromise, res => {
      for (let name in res) {
        if (name != "attributes") {
          fieldRowList.getRow(name).dataTypedValue = res[name];
        }
      }
      fieldRowList.resortRows();
      vm.recordData = res;
      vm.showFieldValueColumn = true;
      spinFor(
        "describing layout",
        sobjectDescribePromise,
        sobjectDescribe => {
          if (sobjectDescribe.urls.layouts) {
            return askSalesforce(sobjectDescribe.urls.layouts + "/" + (res.RecordTypeId || "012000000000000AAA")).then(layoutDescribe => {
              for (let layoutType of [{sections: "detailLayoutSections", property: "detailLayoutInfo"}, {sections: "editLayoutSections", property: "editLayoutInfo"}]) {
                layoutDescribe[layoutType.sections].forEach((section, sectionIndex) => {
                  section.layoutRows.forEach((row, rowIndex) => {
                    row.layoutItems.forEach((item, itemIndex) => {
                      item.layoutComponents.forEach((component, componentIndex) => {
                        if (component.type == "Field") {
                          fieldRowList.getRow(component.value)[layoutType.property] = {
                            indexes: {
                              shownOnLayout: true,
                              sectionIndex,
                              rowIndex,
                              itemIndex,
                              componentIndex
                            },
                            section,
                            row,
                            item,
                            component
                          };
                        }
                      });
                    });
                  });
                });
              }
              fieldRowList.resortRows();
              layoutDescribe.relatedLists.forEach((child, childIndex) => {
                childRowList.getRow(child.name).relatedListInfo = {
                  shownOnLayout: true,
                  relatedListIndex: childIndex,
                  relatedList: child
                };
              });
              childRowList.resortRows();
              vm.layoutInfo = layoutDescribe;
              vm.didUpdate();
            });
          }
        }
      );
      vm.didUpdate();
    });
  }
  function clearRecordData() {
    for (let fieldRow of vm.fieldRows) {
      fieldRow.dataTypedValue = undefined;
      fieldRow.dataEditValue = null;
      fieldRow.detailLayoutInfo = undefined;
      fieldRow.editLayoutInfo = undefined;
    }
    for (let childRow of vm.childRows) {
      childRow.relatedListInfo = undefined;
    }
    vm.isEditing = false;
    vm.recordData = null;
    vm.layoutInfo = null;
  }

  /**
   * Show the spinner while waiting for a promise, and show an error if it fails.
   * vm.didUpdate(); must be called after calling spinFor, and must be called in the callback.
   * @param actionName Name to show in the errors list if the operation fails.
   * @param promise The promise to wait for.
   * @param cb The callback to be called with the result if the promise is successful. The spinner is stopped just before calling the callback, to this change can reuse the same vm.didUpdate(); call for better performance.
   */
  function spinFor(actionName, promise, cb) {
    vm.spinnerCount++;
    promise
      .then(res => {
        vm.spinnerCount--;
        cb(res);
      })
      .catch(err => {
        console.error(err);
        vm.errorMessages.push("Error " + actionName + ": " + ((err && err.askSalesforceError) || err));
        vm.spinnerCount--;
        vm.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  }

  let sobjectInfoPromise;
  var sobjectDescribePromise;
  var recordDataPromise;
  if (args.has("q")) {
    let recordId = args.get("q");
    sobjectInfoPromise = Promise
      .all([
        askSalesforce("/services/data/v" + apiVersion + "/sobjects/"),
        askSalesforce("/services/data/v" + apiVersion + "/tooling/sobjects/")
      ])
      .then(responses => {
        let currentObjKeyPrefix = recordId.substring(0, 3);
        for (let generalMetadataResponse of responses) {
          let sobject = generalMetadataResponse.sobjects.find(sobject => sobject.keyPrefix == currentObjKeyPrefix || sobject.name.toLowerCase() == recordId.toLowerCase());
          if (sobject) {
            vm.sobjectName = sobject.name;
            sobjectDescribePromise = askSalesforce(sobject.urls.describe);
            if (recordId.length < 15) {
              recordDataPromise = null; // Just a prefix, don't attempt to load the record
            } else if (sobject.name.toLowerCase() == recordId.toLowerCase()) {
              recordDataPromise = null; // Not a record ID, don't attempt to load the record
            } else if (!sobject.retrieveable) {
              recordDataPromise = null;
              vm.errorMessages.push("This object does not support showing all data");
            } else {
              recordDataPromise = askSalesforce(sobject.urls.rowTemplate.replace("{ID}", recordId));
            }
            return;
          }
        }
        throw 'Unknown salesforce object: ' + recordId;
      });
  } else if (args.has("objectType")) {
    sobjectInfoPromise = Promise.resolve().then(() => {
      vm.sobjectName = args.get("objectType");
      sobjectDescribePromise = askSalesforce("/services/data/v" + apiVersion + "/" + (args.has("useToolingApi") ? "tooling/" : "") + "sobjects/" + args.get("objectType") + "/describe/");
      if (!args.get("recordUrl")) {
        recordDataPromise = null; // No record url
      } else {
        recordDataPromise = askSalesforce(args.get("recordUrl"));
      }
    });
  } else {
    sobjectInfoPromise = Promise.reject("unknown input for showAllData");
  }
  spinFor("describing global", sobjectInfoPromise, () => {

    // Fetch object data using object describe call
    spinFor("describing object", sobjectDescribePromise, sobjectDescribe => {
      // Display the retrieved object data
      vm.objectData = sobjectDescribe;
      for (let fieldDescribe of sobjectDescribe.fields) {
        fieldRowList.getRow(fieldDescribe.name).fieldDescribe = fieldDescribe;
      }
      fieldRowList.resortRows();
      for (let childDescribe of sobjectDescribe.childRelationships) {
        childRowList.getRow(childDescribe.relationshipName).childDescribe = childDescribe;
      }
      childRowList.resortRows();
      vm.didUpdate();
    });

    // Fetch record data using record retrieve call
    if (recordDataPromise) {
      setRecordData(recordDataPromise);
    }

    // Fetch fields using a Tooling API call, which returns fields not readable by the current user, but fails if the user does not have access to the Tooling API.
    // The Tooling API is not very stable. It often gives "An unexpected error occurred. Please include this ErrorId if you contact support".
    // We would like to query all meta-fields, to show them when the user clicks a field for more details.
    // But, the more meta-fields we query, the more likely the query is to fail, and the meta-fields that cause failure vary depending on the entity we query, the org we are in, and the current Salesforce release.
    // Therefore qe query the minimum set of meta-fields needed by our main UI.
    spinFor(
      "querying tooling particles",
      askSalesforce("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("select QualifiedApiName, Label, DataType, FieldDefinition.ReferenceTo, Length, Precision, Scale, IsCalculated, FieldDefinition.DurableId from EntityParticle where EntityDefinition.QualifiedApiName = '" + vm.sobjectName + "'")),
      res => {
        for (let entityParticle of res.records) {
          fieldRowList.getRow(entityParticle.QualifiedApiName).entityParticle = entityParticle;
        }
        vm.hasEntityParticles = true;
        fieldRowList.resortRows();
        vm.didUpdate();
      }
    );

    vm.didUpdate();

  });

  vm.didUpdate();

});

}
