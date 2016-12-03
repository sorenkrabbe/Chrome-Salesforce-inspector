/* eslint-disable no-unused-vars */
/* global React ReactDOM */
/* global session:true sfHost:true apiVersion askSalesforce askSalesforceSoap */
/* exported session sfHost */
/* global initButton */
/* eslint-enable no-unused-vars */
"use strict";

class Model {
  constructor() {
    this.callbacks = [];
    this.sfLink = "https =//" + sfHost;
    this.spinnerCount = 0;
    this.sobjectDescribePromise = null; // didUpdate not called when changing this
    this.objectData = null;
    this.recordData = null;
    this.layoutInfo = null;
    this.isDragging = false; // didUpdate not called when changing this
    this.sobjectName = undefined;
    this.errorMessages = [];
    this.rowsFilter = "";
    this.useAdvancedFilter = false;
    this.fieldRows = new FieldRowList(this);
    this.childRows = new ChildRowList(this);
    this.detailsFilter = "";
    this.detailsBox = null;
    this.isEditing = false;
    this.hasEntityParticles = false;
  }
  didUpdate(cb) {
    this.callbacks.forEach(f => f(cb));
  }
  recordHeading() {
    if (this.recordData) {
      return "(" + this.recordData.Name + " / " + this.recordData.Id + ")";
    }
    if (this.objectData) {
      return "(" + this.objectData.label + " / " + this.objectData.keyPrefix + ")";
    }
    return "Loading all data...";
  }
  objectName() {
    // Get with correct case if available, otherwise just return the input.
    return this.objectData ? this.objectData.name : this.sobjectName;
  }
  title() {
    return (this.objectData ? "ALL DATA: " + this.objectData.name + " " : "") + this.recordHeading();
  }
  toggleAdvancedFilter(e) {
    e.preventDefault();
    this.useAdvancedFilter = !this.useAdvancedFilter;
    this.didUpdate();
  }
  onRowsFilterInput(e) {
    this.rowsFilter = e.target.value;
    this.didUpdate();
  }
  onDetailsFilterInput(e) {
    this.detailsFilter = e.target.value;
    this.didUpdate();
  }
  clearAndFocusFilter(e, rowsFilter) {
    e.preventDefault();
    this.rowsFilter = "";
    rowsFilter.focus();
    this.didUpdate();
  }
  showDetailsBox(name, allFieldMetadata, detailsFilterList) {
    let self = this;
    let fieldDetails = [];
    for (let key in allFieldMetadata) {
      let value = allFieldMetadata[key];
      let row = key + "," + value;
      fieldDetails.push({
        key,
        value,
        visible() {
          let value = self.detailsFilter.trim().toLowerCase();
          return !value || row.toLowerCase().includes(value);
        }
      });
    }
    this.detailsBox = {rows: fieldDetails, name, detailsFilterList};
  }
  closeDetailsBox(e) {
    if (e) {
      e.preventDefault();
    }
    this.detailsBox = null;
    this.didUpdate();
  }
  showObjectMetadata(e, cb) {
    e.preventDefault();
    let objectDescribe = this.objectData;
    let props = {};
    addProperties(props, objectDescribe, "desc.", {fields: true, childRelationships: true});
    addProperties(props, this.layoutInfo, "layout.", {detailLayoutSections: true, editLayoutSections: true, relatedLists: true});
    this.showDetailsBox(objectDescribe.name, props, null);
    this.didUpdate(cb);
  }
  detailsFilterClick(e, row, detailsFilterList) {
    e.preventDefault();
    this.closeDetailsBox();
    detailsFilterList.showColumn(row.key, row.value);
    this.didUpdate();
  }
  tableMouseDown() {
    this.isDragging = false;
  }
  tableMouseMove(e) {
    if (e.nativeEvent.movementX || e.nativeEvent.movementY) {
      this.isDragging = true;
    }
  }
  tableClick(e) {
    if (!e.nativeEvent.target.closest("a") && !this.isDragging) {
      let td = e.nativeEvent.target.closest(".quick-select");
      if (td) {
        getSelection().selectAllChildren(td);
      }
    }
  }
  canEdit() {
    return this.objectData && this.objectData.updateable && this.recordData && this.recordData.Id;
  }
  doEdit() {
    for (let fieldRow of this.fieldRows.rows) {
      if (fieldRow.canEdit()) {
        fieldRow.dataEditValue = fieldRow.dataStringValue();
      }
    }
    this.isEditing = true;
    this.didUpdate();
  }
  doSave() {
    let i = this.errorMessages.findIndex(e => e.startsWith("Error saving record:"));
    this.errorMessages.splice(i, 1);
    let record = {};
    this.fieldRows.rows.forEach(fieldRow => fieldRow.saveDataValue(record));
    let recordUrl = this.objectData.urls.rowTemplate.replace("{ID}", this.recordData.Id);
    this.spinFor(
      "saving record",
      askSalesforce(recordUrl, null, {method: "PATCH", body: record}),
      () => {
        this.clearRecordData();
        this.setRecordData(askSalesforce(recordUrl));
        this.didUpdate();
      }
    );
    this.didUpdate();
  }
  cancelEdit() {
    let i = this.errorMessages.findIndex(e => e.startsWith("Error saving record:"));
    this.errorMessages.splice(i, 1);
    for (let fieldRow of this.fieldRows.rows) {
      fieldRow.dataEditValue = null;
    }
    this.isEditing = false;
    this.didUpdate();
  }
  canView() {
    return this.recordData && this.recordData.Id;
  }
  viewLink() {
    if (this.recordData && this.recordData.Id) {
      return "https://" + sfHost + "/" + this.recordData.Id;
    }
    if (this.objectData && this.objectData.keyPrefix) {
      return "https://" + sfHost + "/" + this.objectData.keyPrefix + "/o";
    }
    return undefined;
  }
  exportLink() {
    let objectName = this.sobjectName;
    if (this.objectData && this.objectData.name) {
      objectName = this.objectData.name;
    }
    if (!objectName) {
      return undefined;
    }
    let query = "select Id from " + objectName;
    if (this.recordData && this.recordData.Id) {
      query += " where Id = '" + this.recordData.Id + "'";
    }
    return dataExportUrl(query);
  }
  openSetup() {
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("object", this.objectName());
    return "open-object-setup.html?" + args;
  }
  setRecordData(recordDataPromise) {
    this.spinFor("retrieving record", recordDataPromise, res => {
      for (let name in res) {
        if (name != "attributes") {
          this.fieldRows.getRow(name).dataTypedValue = res[name];
        }
      }
      this.fieldRows.resortRows();
      this.recordData = res;
      this.fieldRows.selectedColumns.add("value");
      this.spinFor(
        "describing layout",
        this.sobjectDescribePromise.then(sobjectDescribe => {
          if (sobjectDescribe.urls.layouts) {
            return askSalesforce(sobjectDescribe.urls.layouts + "/" + (res.RecordTypeId || "012000000000000AAA"));
          }
          return undefined;
        }),
        layoutDescribe => {
          if (layoutDescribe) {
            for (let layoutType of [{sections: "detailLayoutSections", property: "detailLayoutInfo"}, {sections: "editLayoutSections", property: "editLayoutInfo"}]) {
              layoutDescribe[layoutType.sections].forEach((section, sectionIndex) => {
                section.layoutRows.forEach((row, rowIndex) => {
                  row.layoutItems.forEach((item, itemIndex) => {
                    item.layoutComponents.forEach((component, componentIndex) => {
                      if (component.type == "Field") {
                        this.fieldRows.getRow(component.value)[layoutType.property] = {
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
            this.fieldRows.resortRows();
            layoutDescribe.relatedLists.forEach((child, childIndex) => {
              this.childRows.getRow(child.name).relatedListInfo = {
                shownOnLayout: true,
                relatedListIndex: childIndex,
                relatedList: child
              };
            });
            this.childRows.resortRows();
            this.layoutInfo = layoutDescribe;
          }
          this.didUpdate();
        }
      );
      this.didUpdate();
    });
  }
  clearRecordData() {
    for (let fieldRow of this.fieldRows.rows) {
      fieldRow.dataTypedValue = undefined;
      fieldRow.dataEditValue = null;
      fieldRow.detailLayoutInfo = undefined;
      fieldRow.editLayoutInfo = undefined;
    }
    for (let childRow of this.childRows.rows) {
      childRow.relatedListInfo = undefined;
    }
    this.isEditing = false;
    this.recordData = null;
    this.layoutInfo = null;
  }
  /**
   * Show the spinner while waiting for a promise, and show an error if it fails.
   * this.didUpdate(); must be called after calling spinFor, and must be called in the callback.
   * @param actionName Name to show in the errors list if the operation fails.
   * @param promise The promise to wait for.
   * @param cb The callback to be called with the result if the promise is successful. The spinner is stopped just before calling the callback, to this change can reuse the same this.didUpdate(); call for better performance.
   */
  spinFor(actionName, promise, cb) {
    this.spinnerCount++;
    promise
      .then(res => {
        this.spinnerCount--;
        cb(res);
      })
      .catch(err => {
        console.error(err);
        this.errorMessages.push("Error " + actionName + ": " + ((err && err.askSalesforceError) || err));
        this.spinnerCount--;
        this.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  }
  startLoading(args) {
    let sobjectInfoPromise;
    let recordDataPromise;
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
              this.sobjectName = sobject.name;
              this.sobjectDescribePromise = askSalesforce(sobject.urls.describe);
              if (recordId.length < 15) {
                recordDataPromise = null; // Just a prefix, don't attempt to load the record
              } else if (sobject.name.toLowerCase() == recordId.toLowerCase()) {
                recordDataPromise = null; // Not a record ID, don't attempt to load the record
              } else if (!sobject.retrieveable) {
                recordDataPromise = null;
                this.errorMessages.push("This object does not support showing all data");
              } else {
                recordDataPromise = askSalesforce(sobject.urls.rowTemplate.replace("{ID}", recordId));
              }
              return;
            }
          }
          throw "Unknown salesforce object: " + recordId;
        });
    } else if (args.has("objectType")) {
      sobjectInfoPromise = Promise.resolve().then(() => {
        this.sobjectName = args.get("objectType");
        this.sobjectDescribePromise = askSalesforce("/services/data/v" + apiVersion + "/" + (args.has("useToolingApi") ? "tooling/" : "") + "sobjects/" + args.get("objectType") + "/describe/");
        if (!args.get("recordUrl")) {
          recordDataPromise = null; // No record url
        } else {
          recordDataPromise = askSalesforce(args.get("recordUrl"));
        }
      });
    } else {
      sobjectInfoPromise = Promise.reject("unknown input for showAllData");
    }
    this.spinFor("describing global", sobjectInfoPromise, () => {

      // Fetch object data using object describe call
      this.spinFor("describing object", this.sobjectDescribePromise, sobjectDescribe => {
        // Display the retrieved object data
        this.objectData = sobjectDescribe;
        for (let fieldDescribe of sobjectDescribe.fields) {
          this.fieldRows.getRow(fieldDescribe.name).fieldDescribe = fieldDescribe;
        }
        this.fieldRows.resortRows();
        for (let childDescribe of sobjectDescribe.childRelationships) {
          this.childRows.getRow(childDescribe.relationshipName).childDescribe = childDescribe;
        }
        this.childRows.resortRows();
        this.didUpdate();
      });

      // Fetch record data using record retrieve call
      if (recordDataPromise) {
        this.setRecordData(recordDataPromise);
      }

      // Fetch fields using a Tooling API call, which returns fields not readable by the current user, but fails if the user does not have access to the Tooling API.
      // The Tooling API is not very stable. It often gives "An unexpected error occurred. Please include this ErrorId if you contact support".
      // We would like to query all meta-fields, to show them when the user clicks a field for more details.
      // But, the more meta-fields we query, the more likely the query is to fail, and the meta-fields that cause failure vary depending on the entity we query, the org we are in, and the current Salesforce release.
      // Therefore qe query the minimum set of meta-fields needed by our main UI.
      this.spinFor(
        "querying tooling particles",
        askSalesforce("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("select QualifiedApiName, Label, DataType, FieldDefinition.ReferenceTo, Length, Precision, Scale, IsAutonumber, IsCaseSensitive, IsDependentPicklist, IsEncrypted, IsIdLookup, IsHtmlFormatted, IsNillable, IsUnique, IsCalculated, InlineHelpText, FieldDefinition.DurableId from EntityParticle where EntityDefinition.QualifiedApiName = '" + this.sobjectName + "'")),
        res => {
          for (let entityParticle of res.records) {
            this.fieldRows.getRow(entityParticle.QualifiedApiName).entityParticle = entityParticle;
          }
          this.hasEntityParticles = true;
          this.fieldRows.resortRows();
          this.didUpdate();
        }
      );

      this.didUpdate();

    });

    this.didUpdate();
  }
}

class RowList {
  constructor(rowConstructor, model) {
    this._rowConstructor = rowConstructor;
    this.model = model;
    this._map = new Map();
    this._sortCol = "name";
    this._sortDir = 1;
    this._nextReactKey = 0;
    this.rows = [];
    this.filteredColumns = new Map();
    this.availableColumns = null;
  }
  getRow(name) {
    if (!name) { // related lists may not have a name
      let row = new this._rowConstructor(name, this._nextReactKey++, this);
      this.rows.push(row);
      return row;
    }
    let row = this._map.get(name);
    if (!row) {
      row = new this._rowConstructor(name, this._nextReactKey++, this);
      this.rows.push(row);
      this._map.set(name, row);
    }
    return row;
  }
  sortRowsBy(col) {
    this._sortDir = col == this._sortCol ? -this._sortDir : 1;
    this._sortCol = col;
    this.resortRows();
    this.model.didUpdate();
  }
  resortRows() {
    let s = v =>
      v === undefined ? "\uFFFD"
      : v == null ? ""
      : String(v).trim();
    this.rows.sort((a, b) => this._sortDir * s(a.sortKey(this._sortCol)).localeCompare(s(b.sortKey(this._sortCol))));
  }
  onColumnFilterInput(e, col) {
    let val = e.target.value;
    if (val) {
      this.filteredColumns.set(col, val);
    } else {
      this.filteredColumns.delete(col);
    }
    this.model.didUpdate();
  }
  onShowColumnChange(e, col) {
    if (e.target.checked) {
      this.selectedColumns.add(col);
    } else {
      this.selectedColumns.delete(col);
      this.filteredColumns.delete(col);
    }
    this.model.didUpdate();
  }
  onAvailableColumnsClick(e) {
    e.preventDefault();
    if (this.availableColumns) {
      this.availableColumns = null;
      this.model.didUpdate();
      return;
    }
    let cols = new Set();
    for (let row of this.rows) {
      for (let prop in row.rowProperties()) {
        cols.add(prop);
      }
    }
    this.availableColumns = Array.from(cols);
    this.model.didUpdate();
  }
  showColumn(col, filterValue) {
    let value = filterValue == null ? "" : "" + filterValue;
    this.selectedColumns.add(col);
    if (value) {
      this.model.useAdvancedFilter = true;
      this.filteredColumns.set(col, value);
    }
  }
}

class FieldRowList extends RowList {
  constructor(model) {
    super(FieldRow, model);
    this.selectedColumns = new Set(["name", "label", "type"]);
    this.fetchFieldDescriptions = true;
  }
  onShowColumnChange(e, col) {
    if (col == "desc" && this.fetchFieldDescriptions) {
      this.fetchFieldDescriptions = false;
      this.rows.forEach(fieldRow => fieldRow.showFieldDescription());
    }
    super.onShowColumnChange(e, col);
  }
}

class ChildRowList extends RowList {
  constructor(model) {
    super(ChildRow, model);
    this.selectedColumns = new Set(["name", "object", "field", "label"]);
  }
}

class TableRow {
  visible() {
    let split = terms => terms.trim().toLowerCase().split(/[ \t]+/);
    let search = (term, col) => {
      let s = this.sortKey(col);
      return s != null && ("" + s).toLowerCase().includes(term);
    };
    if (this.rowList.model.useAdvancedFilter) {
      return Array.from(this.rowList.filteredColumns.entries()).every(([col, terms]) =>
        split(terms).every(term => search(term, col))
      );
    } else {
      return split(this.rowList.model.rowsFilter).every(term =>
        !term || Array.from(this.rowList.selectedColumns).some(col => search(term, col))
      );
    }
  }
}

class FieldRow extends TableRow {
  constructor(fieldName, reactKey, rowList) {
    super();
    this.rowList = rowList;
    this.fieldName = fieldName;
    this.reactKey = reactKey;
    this.fieldDescribe = undefined;
    this.dataTypedValue = undefined;
    this.dataEditValue = null;
    this.detailLayoutInfo = undefined;
    this.editLayoutInfo = undefined;
    this.entityParticle = undefined;
    this.fieldParticleMetadata = undefined;
  }
  rowProperties() {
    let props = {};
    if (typeof this.dataTypedValue != "undefined") {
      addProperties(props, {dataValue: this.dataTypedValue}, "", {});
    }
    if (this.fieldDescribe) {
      addProperties(props, this.fieldDescribe, "desc.", {});
    }
    if (this.entityParticle) {
      addProperties(props, this.entityParticle, "part.", {});
    }
    if (this.fieldParticleMetadata) {
      addProperties(props, this.fieldParticleMetadata, "meta.", {});
    }
    if (this.detailLayoutInfo) {
      addProperties(props, this.detailLayoutInfo.indexes, "layout.", {});
      addProperties(props, this.detailLayoutInfo.section, "layoutSection.", {layoutRows: true});
      addProperties(props, this.detailLayoutInfo.row, "layoutRow.", {layoutItems: true});
      addProperties(props, this.detailLayoutInfo.item, "layoutItem.", {layoutComponents: true});
      addProperties(props, this.detailLayoutInfo.component, "layoutComponent.", {details: true, components: true});
    } else if (this.rowList.model.layoutInfo) {
      addProperties(props, {shownOnLayout: false}, "layout.", {});
    }
    if (this.editLayoutInfo) {
      addProperties(props, this.editLayoutInfo.indexes, "editLayout.", {});
      addProperties(props, this.editLayoutInfo.section, "editLayoutSection.", {layoutRows: true});
      addProperties(props, this.editLayoutInfo.row, "editLayoutRow.", {layoutItems: true});
      addProperties(props, this.editLayoutInfo.item, "editLayoutItem.", {layoutComponents: true});
      addProperties(props, this.editLayoutInfo.component, "editLayoutComponent.", {details: true, components: true});
    } else if (this.rowList.model.layoutInfo) {
      addProperties(props, {shownOnLayout: false}, "editLayout.", {});
    }
    return props;
  }
  onDataEditValueInput(e) {
    this.dataEditValue = e.target.value;
    this.rowList.model.didUpdate();
  }
  dataStringValue() {
    return this.dataTypedValue == null ? "" : "" + this.dataTypedValue;
  }
  fieldLabel() {
    if (this.fieldDescribe) {
      return this.fieldDescribe.label;
    }
    if (this.entityParticle) {
      return this.entityParticle.Label;
    }
    return undefined;
  }
  fieldHelptext() {
    if (this.fieldDescribe) {
      return this.fieldDescribe.inlineHelpText;
    }
    if (this.entityParticle) {
      return this.entityParticle.InlineHelpText;
    }
    return undefined;
  }
  fieldDesc() {
    return this.fieldParticleMetadata && this.fieldParticleMetadata.Metadata.description;
  }
  fieldTypeDesc() {
    let fieldDescribe = this.fieldDescribe;
    if (fieldDescribe) {
      return fieldDescribe.type == "reference"
      ? "[" + fieldDescribe.referenceTo.join(", ") + "]"
      : (fieldDescribe.type || "")
        + (fieldDescribe.length ? " (" + fieldDescribe.length + ")" : "")
        + (fieldDescribe.precision || fieldDescribe.scale ? " (" + fieldDescribe.precision + ", " + fieldDescribe.scale + ")" : "")
        + (fieldDescribe.autoNumber ? ", auto number" : "")
        + (fieldDescribe.caseSensitive ? ", case sensitive" : "")
        + (fieldDescribe.dependentPicklist ? ", dependent" : "")
        + (fieldDescribe.encrypted ? ", encrypted" : "")
        + (fieldDescribe.externalId ? ", external id" : "")
        + (fieldDescribe.htmlFormatted ? ", html" : "")
        + (!fieldDescribe.nillable ? ", required" : "")
        + (fieldDescribe.restrictedPicklist ? ", restricted" : "")
        + (fieldDescribe.unique ? ", unique" : "")
        + (fieldDescribe.calculated ? "*" : "");
    }
    let particle = this.entityParticle;
    if (particle) {
      return particle.DataType == "reference" && particle.FieldDefinition.ReferenceTo.referenceTo
      ? "[" + particle.FieldDefinition.ReferenceTo.referenceTo.join(", ") + "]"
      : (particle.DataType || "")
        + (particle.Length ? " (" + particle.Length + ")" : "")
        + (particle.Precision || particle.Scale ? " (" + particle.Precision + ", " + particle.Scale + ")" : "")
        + (particle.IsAutonumber ? ", auto number" : "")
        + (particle.IsCaseSensitive ? ", case sensitive" : "")
        + (particle.IsDependentPicklist ? ", dependent" : "")
        + (particle.IsEncrypted ? ", encrypted" : "")
        + (particle.IsIdLookup ? ", external id" : "")
        + (particle.IsHtmlFormatted ? ", html" : "")
        + (!particle.IsNillable ? ", required" : "")
        + (particle.IsUnique ? ", unique" : "")
        + (particle.IsCalculated ? "*" : "");
    }
    return undefined;
  }
  referenceTypes() {
    let fieldDescribe = this.fieldDescribe;
    if (fieldDescribe) {
      return fieldDescribe.type == "reference" ? fieldDescribe.referenceTo : null;
    }
    let particle = this.entityParticle;
    if (particle) {
      return particle.DataType == "reference" ? particle.FieldDefinition.ReferenceTo.referenceTo : null;
    }
    return [];
  }
  fieldIsCalculated() {
    if (this.fieldDescribe) {
      return this.fieldDescribe.calculated;
    }
    if (this.entityParticle) {
      return this.entityParticle.IsCalculated;
    }
    return false;
  }
  fieldIsHidden() {
    return !this.fieldDescribe;
  }
  openSetup() {
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("object", this.rowList.model.objectName());
    args.set("field", this.fieldName);
    return "open-field-setup.html?" + args;
  }
  summary() {
    let fieldDescribe = this.fieldDescribe;
    if (fieldDescribe) {
      return this.fieldName + "\n"
        + (fieldDescribe.calculatedFormula ? "Formula: " + fieldDescribe.calculatedFormula + "\n" : "")
        + (fieldDescribe.inlineHelpText ? "Help text: " + fieldDescribe.inlineHelpText + "\n" : "")
        + (fieldDescribe.picklistValues && fieldDescribe.picklistValues.length > 0 ? "Picklist values: " + fieldDescribe.picklistValues.map(pickval => pickval.value).join(", ") + "\n" : "")
        ;
    }
    // Entity particle does not contain any of this information
    return this.fieldName + "\n(Details not available)";
  }
  isEditing() {
    return typeof this.dataEditValue == "string";
  }
  canEdit() {
    return this.fieldDescribe && this.fieldDescribe.updateable;
  }
  tryEdit(e) {
    if (!this.isEditing() && this.rowList.model.canEdit() && this.canEdit()) {
      this.dataEditValue = this.dataStringValue();
      this.rowList.model.isEditing = true;
      let td = e.nativeEvent.currentTarget;
      this.rowList.model.didUpdate(() => td.querySelector("textarea").focus());
    }
  }
  cancelEdit(e) {
    e.preventDefault();
    this.dataEditValue = null;
    this.rowList.model.didUpdate();
  }
  saveDataValue(recordData) {
    if (this.isEditing()) {
      recordData[this.fieldDescribe.name] = this.dataEditValue == "" ? null : this.dataEditValue;
    }
  }
  isId() {
    if (this.fieldDescribe) {
      return this.fieldDescribe.type == "reference" && !!this.dataTypedValue;
    }
    if (this.entityParticle) {
      return this.entityParticle.DataType == "reference" && !!this.dataTypedValue;
    }
    return false;
  }
  openDetails(e, cb) {
    e.preventDefault();
    this.rowList.model.showDetailsBox(this.fieldName, this.rowProperties(), this.rowList);
    this.rowList.model.didUpdate(cb);
  }
  showRecordIdUrl() {
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("q", this.dataTypedValue);
    return "inspect.html?" + args;
  }
  showReferenceUrl(type) {
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("q", type);
    return "inspect.html?" + args;
  }
  sortKey(col) {
    switch (col) {
      case "name": return this.fieldName;
      case "label": return this.fieldLabel();
      case "helptext": return this.fieldHelptext();
      case "desc": return this.fieldDesc();
      case "value": return this.dataTypedValue;
      case "type": return this.fieldTypeDesc();
      default: return this.rowProperties()[col];
    }
  }
  showFieldDescription() {
    if (!this.entityParticle) {
      return;
    }
    this.rowList.model.spinFor(
      "getting field definition metadata for " + this.fieldName,
      askSalesforce("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("select Metadata from FieldDefinition where DurableId = '" + this.entityParticle.FieldDefinition.DurableId + "'")),
      fieldDefs => {
        this.fieldParticleMetadata = fieldDefs.records[0];
        this.rowList.model.didUpdate();
      }
    );
    this.rowList.model.didUpdate();
  }
}

class ChildRow extends TableRow {
  constructor(childName, reactKey, rowList) {
    super();
    this.rowList = rowList;
    this.childName = childName;
    this.reactKey = reactKey;
    this.childDescribe = undefined;
    this.relatedListInfo = undefined;
  }
  rowProperties() {
    let props = {};
    if (this.childDescribe) {
      addProperties(props, this.childDescribe, "child.", {});
    }
    if (this.relatedListInfo) {
      addProperties(props, this.relatedListInfo, "layout.", {});
    } else if (this.rowList.model.layoutInfo) {
      addProperties(props, {shownOnLayout: false}, "layout.", {});
    }
    return props;
  }
  childObject() {
    if (this.childDescribe) {
      return this.childDescribe.childSObject;
    }
    if (this.relatedListInfo) {
      return this.relatedListInfo.relatedList.sobject;
    }
    return undefined;
  }
  childField() {
    if (this.childDescribe) {
      return this.childDescribe.field;
    }
    if (this.relatedListInfo) {
      return this.relatedListInfo.relatedList.field;
    }
    return undefined;
  }
  childLabel() {
    if (this.relatedListInfo) {
      return this.relatedListInfo.relatedList.label;
    }
    return undefined;
  }
  sortKey(col) {
    switch (col) {
      case "name": return this.childName;
      case "object": return this.childObject();
      case "field": return this.childField();
      case "label": return this.childLabel();
      default: return this.rowProperties()[col];
    }
  }
  openDetails(e, cb) {
    e.preventDefault();
    this.rowList.model.showDetailsBox(this.childName, this.rowProperties(), this.rowList);
    this.rowList.model.didUpdate(cb);
  }
  showChildObjectUrl() {
    let childDescribe = this.childDescribe;
    if (childDescribe) {
      let args = new URLSearchParams();
      args.set("host", sfHost);
      args.set("q", childDescribe.childSObject);
      return "inspect.html?" + args;
    }
    return "";
  }
  openSetup() {
    let childDescribe = this.childDescribe;
    if (childDescribe) {
      let args = new URLSearchParams();
      args.set("host", sfHost);
      args.set("object", childDescribe.childSObject);
      args.set("field", childDescribe.field);
      return "open-field-setup.html?" + args;
    }
    let relatedListInfo = this.relatedListInfo;
    if (relatedListInfo) {
      let args = new URLSearchParams();
      args.set("host", sfHost);
      args.set("object", relatedListInfo.relatedList.sobject);
      args.set("field", relatedListInfo.relatedList.field);
      return "open-field-setup.html?" + args;
    }
    return "open-field-setup.html";
  }
  queryListUrl() {
    let record = this.rowList.model.recordData;
    if (!record || !record.Id) {
      return "";
    }
    let relatedListInfo = this.relatedListInfo;
    if (relatedListInfo) {
      return dataExportUrl("select Id, " + relatedListInfo.relatedList.columns.map(c => c.name).join(", ") + " from " + relatedListInfo.relatedList.sobject + " where " + relatedListInfo.relatedList.field + " = '" + record.Id + "'");
    }
    let childDescribe = this.childDescribe;
    if (childDescribe) {
      return dataExportUrl("select Id from " + childDescribe.childSObject + " where " + childDescribe.field + " = '" + record.Id + "'");
    }
    return "";
  }
}

function dataExportUrl(query) {
  let args = new URLSearchParams();
  args.set("host", sfHost);
  args.set("query", query);
  return "data-export.html?" + args;
}

function addProperties(map, object, prefix, ignore) {
  for (let key in object) {
    let value = object[key];
    if (ignore[key]) {
      // empty
    } else if (value && typeof value == "object") {
      addProperties(map, value, prefix + key + ".", {});
    } else {
      map[prefix + key] = value;
    }
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.detailsFilterFocus = this.detailsFilterFocus.bind(this);
  }
  componentDidMount() {
    this.refs.rowsFilter.focus();
  }
  detailsFilterFocus() {
    this.refs.detailsFilter.focus();
  }
  render() {
    let vm = this.props.vm;
    document.title = vm.title();
    return (
      React.createElement("div", {onClick: e => vm.tableClick(e), onMouseMove: e => vm.tableMouseMove(e), onMouseDown: e => vm.tableMouseDown(e)},
        React.createElement("div", {className: "object-bar"},
          React.createElement("img", {id: "spinner", src: "data:image/gif;base64,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", hidden: vm.spinnerCount == 0}),
          React.createElement("a", {href: vm.sfLink, className: "sf-link"},
            React.createElement("svg", {viewBox: "0 0 24 24"},
              React.createElement("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
            ),
            " Salesforce Home"
          ),
          vm.useAdvancedFilter ? null : React.createElement("span", {className: "filter-box"},
            React.createElement("input", {className: "filter-input", placeholder: "Filter", value: vm.rowsFilter, onInput: e => vm.onRowsFilterInput(e), ref: "rowsFilter"}),
            React.createElement("a", {href: "about:blank", className: "char-btn", onClick: e => vm.clearAndFocusFilter(e, this.refs.rowsFilter)}, "X")
          ),
          React.createElement("a", {href: "about:blank", onClick: e => vm.toggleAdvancedFilter(e)}, vm.useAdvancedFilter ? "Simple filter" : "Advanced filter"),
          React.createElement("h1", {className: "object-name"},
            React.createElement("span", {className: "quick-select"}, vm.objectName()),
            " ",
            vm.recordHeading()
          ),
          React.createElement("span", {className: "object-actions"},
            !vm.isEditing ? React.createElement("button", {title: "Inline edit the values of this record", disabled: !vm.canEdit() || !vm.fieldRows.selectedColumns.has("value"), onClick: e => vm.doEdit(e)}, "Edit") : null,
            " ",
            vm.isEditing ? React.createElement("button", {title: "Inline edit the values of this record", onClick: e => vm.doSave(e)}, "Save") : null,
            " ",
            vm.isEditing ? React.createElement("button", {title: "Inline edit the values of this record", onClick: e => vm.cancelEdit(e)}, "Cancel") : null,
            " ",
            vm.exportLink() ? React.createElement("a", {href: vm.exportLink(), title: "Export data from this object"}, "Export") : null,
            " ",
            vm.viewLink() ? React.createElement("a", {href: vm.viewLink(), title: "View this record in Salesforce"}, "View") : null,
            " ",
            vm.objectName() ? React.createElement("a", {href: "about:blank", onClick: e => vm.showObjectMetadata(e, this.detailsFilterFocus)}, "More") : null,
            " ",
            vm.objectName() ? React.createElement("a", {href: vm.openSetup()}, "Setup") : null,
            " ",
            React.createElement("span", {className: "column-button-outer"},
              React.createElement("a", {href: "about:blank", onClick: e => vm.fieldRows.onAvailableColumnsClick(e)},
                "Field columns"
              ),
              vm.fieldRows.availableColumns ? React.createElement("div", {className: "column-popup"},
                React.createElement("label", {},
                  React.createElement("input", {type: "checkbox", checked: true, disabled: true}),
                  " Field API Name"
                ),
                React.createElement("label", {},
                  React.createElement("input", {type: "checkbox", checked: vm.fieldRows.selectedColumns.has("label"), onChange: e => vm.fieldRows.onShowColumnChange(e, "label")}),
                  " Label"
                ),
                React.createElement("label", {},
                  React.createElement("input", {type: "checkbox", checked: vm.fieldRows.selectedColumns.has("type"), onChange: e => vm.fieldRows.onShowColumnChange(e, "type")}),
                  " Type"
                ),
                React.createElement("label", {},
                  React.createElement("input", {type: "checkbox", checked: vm.fieldRows.selectedColumns.has("value"), onChange: e => vm.fieldRows.onShowColumnChange(e, "value"), disabled: !vm.canView()}),
                  " Value"
                ),
                React.createElement("label", {},
                  React.createElement("input", {type: "checkbox", checked: vm.fieldRows.selectedColumns.has("helptext"), onChange: e => vm.fieldRows.onShowColumnChange(e, "helptext")}),
                  " Help text"
                ),
                React.createElement("label", {},
                  React.createElement("input", {type: "checkbox", checked: vm.fieldRows.selectedColumns.has("desc"), onChange: e => vm.fieldRows.onShowColumnChange(e, "desc"), disabled: !vm.hasEntityParticles}),
                  " Description"
                ),
                React.createElement("hr", {}),
                vm.fieldRows.availableColumns.map(col => React.createElement("label", {key: col},
                  React.createElement("input", {type: "checkbox", checked: vm.fieldRows.selectedColumns.has(col), onChange: e => vm.fieldRows.onShowColumnChange(e, col)}),
                  col
                ))
              ) : null
            ),
            " ",
            React.createElement("span", {className: "column-button-outer"},
              React.createElement("a", {href: "about:blank", onClick: e => vm.childRows.onAvailableColumnsClick(e)},
                "Relationship columns"
              ),
              vm.childRows.availableColumns ? React.createElement("div", {className: "column-popup"},
                ["name", "object", "field", "label"].map(col => React.createElement("label", {key: col},
                  React.createElement("input", {type: "checkbox", checked: vm.childRows.selectedColumns.has(col), onChange: e => vm.childRows.onShowColumnChange(e, col)}),
                  col == "name" ? "Relationship Name"
                    : col == "object" ? "Child Object"
                    : col == "field" ? "Field"
                    : col == "label" ? "Label"
                    : col
                )),
                React.createElement("hr", {}),
                vm.childRows.availableColumns.map(col => React.createElement("label", {key: col},
                  React.createElement("input", {type: "checkbox", checked: vm.childRows.selectedColumns.has(col), onChange: e => vm.childRows.onShowColumnChange(e, col)}),
                  col
                ))
              ) : null
            )
          )
        ),
        React.createElement("div", {className: "body " + (vm.fieldRows.selectedColumns.size < 2 && vm.childRows.selectedColumns.size < 2 ? "empty " : "")},
          React.createElement("div", {hidden: vm.errorMessages.length == 0, className: "error-message"}, vm.errorMessages.map((data, index) => React.createElement("div", {key: index}, data))),
          React.createElement("table", {},
            React.createElement("thead", {},
              React.createElement("tr", {},
                Array.from(vm.fieldRows.selectedColumns).map(col =>
                  React.createElement("th",
                    {
                      className:
                        col == "name" ? "field-name"
                        : col == "label" ? "field-label"
                        : "field-column",
                      key: col,
                      tabIndex: 0,
                      onClick: () => vm.fieldRows.sortRowsBy(col)
                    },
                    col == "name" ? "Field API Name"
                    : col == "label" ? "Label"
                    : col == "helptext" ? "Help text"
                    : col == "desc" ? "Description"
                    : col == "value" ? "Value"
                    : col == "type" ? "Type"
                    : col
                  )
                ),
                React.createElement("th", {className: "field-actions"}, "Actions")
              ),
              vm.useAdvancedFilter ? React.createElement("tr", {},
                Array.from(vm.fieldRows.selectedColumns).map(col =>
                  React.createElement("th",
                    {
                      className:
                        col == "name" ? "field-name"
                        : col == "label" ? "field-label"
                        : "field-column",
                      key: col
                    },
                    React.createElement("input", {placeholder: "Filter", className: "column-filter-box", value: vm.fieldRows.filteredColumns.get(col) || "", onInput: e => vm.fieldRows.onColumnFilterInput(e, col)})
                  )
                ),
                React.createElement("th", {className: "field-actions"})
              ) : null
            ),
            React.createElement("tbody", {}, vm.fieldRows.rows.map(row =>
              React.createElement("tr", {className: (row.fieldIsCalculated() ? "fieldCalculated " : "") + (row.fieldIsHidden() ? "fieldHidden " : ""), hidden: !row.visible(), title: row.summary(), key: row.reactKey},
                Array.from(vm.fieldRows.selectedColumns).map(col =>
                  React.createElement("td",
                    {
                      className:
                        col == "name" ? "field-name"
                        : col == "label" ? "field-label"
                        : "field-column",
                      key: col,
                      onDoubleClick: col == "value" ? e => row.tryEdit(e) : null
                    },
                    col == "value" && row.isId() && !row.isEditing() ? React.createElement("div", {className: "value-text quick-select"}, React.createElement("a", {href: row.showRecordIdUrl()}, row.dataStringValue())) : null,
                    col == "value" && row.isEditing() ? React.createElement("textarea", {value: row.dataEditValue, onChange: e => row.onDataEditValueInput(e)}) : null,
                    col == "value" && row.isEditing() ? React.createElement("a", {href: "about:blank", onClick: e => row.cancelEdit(e), className: "undo-button"}, "\u21B6") : null,
                    col == "type" && row.referenceTypes() ? row.referenceTypes().map(data =>
                      React.createElement("span", {key: data}, React.createElement("a", {href: row.showReferenceUrl(data)}, data), " ")
                    ) : null,
                    !(col == "value" && row.isId()) && !(col == "value" && row.isEditing()) && !(col == "type" && row.referenceTypes()) ? React.createElement(TypedValue, {value: row.sortKey(col)}) : null
                  )
                ),
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
                Array.from(vm.childRows.selectedColumns).map(col =>
                  React.createElement("th", {className: "child-column", tabIndex: 0, onClick: () => vm.childRows.sortRowsBy(col), key: col},
                    col == "name" ? "Relationship Name"
                    : col == "object" ? "Child Object"
                    : col == "field" ? "Field"
                    : col == "label" ? "Label"
                    : col
                  )
                ),
                React.createElement("th", {className: "child-actions"}, "Actions")
              ),
              vm.useAdvancedFilter ? React.createElement("tr", {},
                Array.from(vm.childRows.selectedColumns).map(col =>
                  React.createElement("th", {className: "child-column", key: col},
                    React.createElement("input", {placeholder: "Filter", className: "column-filter-box", value: vm.childRows.filteredColumns.get(col) || "", onInput: e => vm.childRows.onColumnFilterInput(e, col)})
                  )
                ),
                React.createElement("th", {className: "child-actions"})
              ) : null
            ),
            React.createElement("tbody", {}, vm.childRows.rows.map(row =>
              React.createElement("tr", {hidden: !row.visible(), key: row.reactKey},
                Array.from(vm.childRows.selectedColumns).map(col =>
                  React.createElement("td", {className: "child-column quick-select", key: col},
                    col == "object"
                      ? React.createElement("a", {href: row.showChildObjectUrl()}, row.childObject())
                      : React.createElement(TypedValue, {value: row.sortKey(col)})
                  )
                ),
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
              React.createElement("a", {href: "about:blank", className: "closeLnk", onClick: e => vm.closeDetailsBox(e)}, "X"),
              React.createElement("div", {className: "mainContent"},
                React.createElement("h3", {}, "All available metadata for \"" + vm.detailsBox.name + "\""),
                React.createElement("input", {placeholder: "Filter", value: vm.detailsFilter, onInput: e => vm.onDetailsFilterInput(e), ref: "detailsFilter"}),
                React.createElement("table", {},
                  React.createElement("thead", {}, React.createElement("tr", {}, React.createElement("th", {}, "Key"), React.createElement("th", {}, "Value"))),
                  React.createElement("tbody", {}, vm.detailsBox.rows.map(row =>
                    React.createElement("tr", {hidden: !row.visible(), key: row.key},
                      React.createElement("td", {},
                        React.createElement("a", {href: "about:blank", onClick: e => vm.detailsFilterClick(e, row, vm.detailsBox.detailsFilterList), hidden: !vm.detailsBox.detailsFilterList, title: "Show fields with this property"}, "🔍"),
                        " ",
                        React.createElement("span", {className: "quick-select"}, row.key)
                      ),
                      React.createElement("td", {}, React.createElement(TypedValue, {value: row.value}))
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
}

let TypedValue = props =>
  React.createElement("div", {
    className:
      "value-text "
      + (typeof props.value == "string" ? "value-is-string " : "")
      + (typeof props.value == "number" ? "value-is-number " : "")
      + (typeof props.value == "boolean" ? "value-is-boolean " : "")
      + (typeof props.value == "object" ? "value-is-object " : "")
      + (props.value === undefined ? "value-is-unknown " : "")
      + (props.value === null ? "value-is-blank " : "")
      + (props.value === true ? "value-is-boolean-true " : "")
      + (props.value === undefined || props.value === null ? "" : "quick-select ")
  },
    props.value === undefined ? "(Unknown)"
      : props.value === null ? "(Blank)"
      : "" + props.value
  );

if (!this.isUnitTest) {

  let args = new URLSearchParams(location.search.slice(1));
  sfHost = args.get("host");
  initButton(true);
  chrome.runtime.sendMessage({message: "getSession", sfHost}, message => {
    session = message;

    let root = document.getElementById("root");
    let vm = new Model();
    vm.startLoading(args);
    vm.callbacks.push(cb => {
      ReactDOM.render(React.createElement(App, {vm}), root, cb);
    });
    ReactDOM.render(React.createElement(App, {vm}), root);

  });

}
