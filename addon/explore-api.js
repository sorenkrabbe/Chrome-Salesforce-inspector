/* eslint-disable no-unused-vars */
/* global ko */
/* global session:true sfHost:true apiVersion askSalesforce askSalesforceSoap */
/* exported session sfHost */
/* global initButton */
/* eslint-enable no-unused-vars */
"use strict";
{

  let args = new URLSearchParams(location.search.slice(1));
  sfHost = args.get("host");
  initButton(true);
  chrome.runtime.sendMessage({message: "getSession", sfHost}, message => {
    session = message;

    let vm = new ApiExploreVm(args);
    ko.applyBindings(vm, document.documentElement);
  });

}

class ApiExploreVm {
  constructor(args) {
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = ko.observable(0);
    this.title = ko.observable("API Request");
    this.userInfo = ko.observable("...");

    this.apiResponse = ko.observable(null);
    this.selectedTextView = ko.observable(null);

    this.editMode = ko.observable(false);
    this.editType = ko.observable("REST");
    this.editSoap = ko.observable("--Select--");
    this.editUrl = ko.observable();
    this.editMethod = ko.observable("GET");
    this.editNamespace = ko.observable("");
    this.editBody = ko.observable("");

    if (args.has("apiUrls")) {
      let apiUrls = args.getAll("apiUrls");
      this.title(apiUrls.length + " API requests, e.g. " + apiUrls[0]);
      let apiPromise = Promise.all(apiUrls.map(url => askSalesforce(url)));
      this.performRequest(apiPromise);
    } else if (args.has("checkDeployStatus")) {
      this.editMode(true);
      this.editType("SOAP");
      this.setSoapType("Metadata");
      this.editBody("<checkDeployStatus>\n  <id>" + args.get("checkDeployStatus") + "</id>\n  <includeDetails>true</includeDetails>\n</checkDeployStatus>");
    } else {
      let apiUrl = args.get("apiUrl") || "/services/data/";
      if (args.has("edit")) {
        this.editMode(true);
        this.editUrl(apiUrl);
      } else {
        this.title(apiUrl);
        let apiPromise = askSalesforce(apiUrl);
        this.performRequest(apiPromise);
      }
    }

    this.spinFor(askSalesforceSoap("/services/Soap/u/" + apiVersion, "urn:partner.soap.sforce.com", "<getUserInfo/>").then(res => {
      this.userInfo(res.querySelector("Body userFullName").textContent + " / " + res.querySelector("Body userName").textContent + " / " + res.querySelector("Body organizationName").textContent);
    }));
  }
  openSubUrl(subUrl) {
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("apiUrl", subUrl.apiUrl);
    return "explore-api.html?" + args;
  }
  editSubUrl(subUrl) {
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("apiUrl", subUrl.apiUrl);
    args.set("edit", "1");
    return "explore-api.html?" + args;
  }
  openGroupUrl(groupUrl) {
    let args = new URLSearchParams();
    args.set("host", sfHost);
    for (let url of groupUrl.apiUrls) {
      args.append("apiUrls", url);
    }
    return "explore-api.html?" + args;
  }
  sendClick() {
    if (this.editType() == "REST") {
      let apiUrl = this.editUrl();
      this.title(apiUrl);
      let apiPromise = askSalesforce(apiUrl, null, {method: this.editMethod(), bodyText: this.editBody()});
      this.performRequest(apiPromise);
    } else if (this.editType() == "SOAP") {
      let apiUrl = this.editUrl();
      this.title("SOAP " + apiUrl);
      let apiPromise = askSalesforceSoap(apiUrl, this.editNamespace(), this.editBody());
      this.performSoapRequest(apiPromise);
    } else {
      console.error("Unknown type");
    }
  }
  onEditSoapChange() {
    this.setSoapType(this.editSoap());
    this.editSoap("--Select--");
  }
  setSoapType(soapType) {
    let soapBody = "<methodName></methodName>";
    switch (soapType) {
      case "Enterprise":
        this.editUrl("/services/Soap/c/" + apiVersion);
        this.editNamespace("urn:enterprise.soap.sforce.com");
        this.editBody(soapBody);
        return;
      case "Partner":
        this.editUrl("/services/Soap/u/" + apiVersion);
        this.editNamespace("urn:partner.soap.sforce.com");
        this.editBody(soapBody);
        return;
      case "Apex":
        this.editUrl("/services/Soap/s/" + apiVersion);
        this.editNamespace("http://soap.sforce.com/2006/08/apex");
        this.editBody(soapBody);
        return;
      case "Metadata":
        this.editUrl("/services/Soap/m/" + apiVersion);
        this.editNamespace("http://soap.sforce.com/2006/04/metadata");
        this.editBody(soapBody);
        return;
      case "Tooling":
        this.editUrl("/services/Soap/T/" + apiVersion);
        this.editNamespace("urn:tooling.soap.sforce.com");
        this.editBody(soapBody);
        return;
    }
  }
  spinFor(promise) {
    let stopSpinner = () => {
      this.spinnerCount(this.spinnerCount() - 1);
    };
    this.spinnerCount(this.spinnerCount() + 1);
    promise.catch(e => { console.error("spinFor", e); }).then(stopSpinner, stopSpinner);
  }
  performRequest(apiPromise) {
    this.spinFor(apiPromise.then(result => {
      this.parseResponse(result);
    }).catch(err => {
      console.error(err);
      this.apiResponse({textViews: [{name: "Error", value: (err && err.askSalesforceError) || err}]});
    }));
  }
  parseResponse(result) {

    /*
    Transform an arbitrary JSON structure (the `result` vaiable) into a list of two-dimensional TSV tables (the `textViews` variable), that can easily be copied into for example Excel.
    Each two-dimensional table corresponds to an array or set of related arrays in the JSON data.

    For example in a Sobject Describe, the list of fields is one table. Each row is a field, and each column is a property of that field.
    The list of picklist values is another table. Each column is a property of the picklist value, or a property of the field to which the picklist value belongs (i.e. a column inherited from the parent table).

    Map<String,TableView> tViews; // Map of all tables, keyed by the name of each table
    interface TableView {
      String name; // Name of the table, a JSON path that matches each row of the table
      TableView? parent; // For nested tables, contains a link to the parent table. A child table inherits all columns from its parent. Inherited columns are added to the end of a table.
      TableRow[] rows;
      Map<String,void> columnMap; // The set of all columns in this table, excluding columns inherited from the parent table
      String[]? columnList; // The list of all columns in this table, including columns inherited from the parent table
    }
    interface TableRow {
      JsonValue value; // The value of the row, as a JSON structure not yet flattened into row format.
      TableRow parent; // For nested tables, contains a link to the corresponding row in the parent table. A child row inherits all columns from its parent. Inherited columns are added to the end of a row.
      any[]? cells; // The list of all cells in this row, matching the columns in the table, including data inherited from the parent row
    }
    TextView[] textViews;
    interface TextView {
      String name; // Name of the table
      String value; // The table serialized in TSV format
      any[][]? table; // The table
    }

    In addition to building the table views of the JSON structure, we also scan it for values that look like API resource URLs, so we can display links to these.
    ApiSubUrl[] apiSubUrls;
    interface ApiSubUrl {
      String jsonPath; // The JSON path where the resource URL was found
      String apiUrl; // The URL
      String label; // A label describing the URL
    }

    We also group these URLs the same way we build tables, allowing the user to request all related resources in one go. For example, given a global describe result, the user can fetch object describes for all objects in one click.
    ApiGroupUrl[] apiGroupUrls;
    interface ApiGroupUrl {
      String jsonPath; // The JSON path where the resource URLs were found
      String[] apiUrls; // The related URLs
      String label; // A label describing the URLs
    }
    */

    // Recursively explore the JSON structure, discovering tables and their rows and columns.
    let apiSubUrls = [];
    let groupUrls = {};
    let textViews = [
      {name: "Raw JSON", value: JSON.stringify(result, null, "    ")}
    ];
    let tRow = {value: result, cells: null, parent: null}; // The root row
    let tViews = {
      "@": {name: "@", parent: null, rows: [tRow], columnMap: {}, columnList: null} // Dummy root table, always contains one row
    };
    exploreObject2(result, tRow, "", tViews["@"], "@");
    function exploreObject2(object /*JsonValue*/, tRow /*TableRow*/, columnName /*String, JSON path relative to tView.name*/, tView /*TableView*/, fullName /*String, JSON path including array indexes*/) {
      // Create the new column, if we have not created it already
      tView.columnMap[columnName] = true;

      if (object instanceof Array) {
        // Create a new table, if we have not created it already
        let childViewName = tView.name + columnName + ".*";
        let childView;
        tViews[childViewName] = childView = tViews[childViewName] || {name: childViewName, parent: tView, rows: [], columnMap: {}, columnList: null};

        for (let i = 0; i < object.length; i++) {
          if (object[i] && typeof object[i] == "object") {
            object[i]["#"] = i;
          }

          // Create the new row
          let childRow = {value: object[i], cells: null, parent: tRow};
          childView.rows.push(childRow);

          exploreObject2(object[i], childRow, "", childView, fullName + "." + i);
        }
      } else if (object && typeof object == "object") {
        for (let key in object) {
          exploreObject2(object[key], tRow, columnName + "." + key, tView, fullName + "." + key);
        }
      }

      if (typeof object == "string" && object.startsWith("/services/data/")) {
        apiSubUrls.push({jsonPath: fullName, apiUrl: object, label: object});
        if (tView.name != "@") {
          if (!groupUrls[tView.name + columnName]) {
            groupUrls[tView.name + columnName] = [];
          }
          groupUrls[tView.name + columnName].push(object);
        }
      }
    }

    // Build each of the discovered tables. Turn columns into a list, turn each row into a list matching the columns, and serialize as TSV.
    // Note that the tables are built in the order they are discovered. This means that a child table is always built after its parent table.
    // We can therefore re-use the build of the parent table when building the child table.
    for (let tView of Object.values(tViews)) {
      // Add own columns
      tView.columnList = Object.keys(tView.columnMap).map(column => tView.name + column);
      // Copy columns from parent table
      if (tView.parent) {
        tView.columnList = [...tView.columnList, ...tView.parent.columnList];
      }
      let table = [tView.columnList];
      // Add rows
      for (let row of tView.rows) {
        // Add cells to the row, matching the found columns
        row.cells = Object.keys(tView.columnMap).map(column => {
          // Find the value of the cell
          let fields = column.split(".");
          fields.splice(0, 1);
          let value = row.value;
          for (let field of fields) {
            if (typeof value != "object") {
              value = null;
            }
            if (value != null) {
              value = value[field];
            }
          }
          if (value instanceof Array) {
            value = "[Array " + value.length + "]";
          }
          return value;
        });
        // Add columns from parent row
        if (row.parent) {
          row.cells = [...row.cells, ...row.parent.cells];
        }
        table.push(row.cells);
      }
      let csvSignature = csvSerialize([
        ["Salesforce Inspector - REST API Explorer"],
        ["URL", this.title()],
        ["Rows", tView.name],
        ["Extract time", new Date().toISOString()]
      ], "\t") + "\r\n\r\n";
      textViews.push({name: "Rows: " + tView.name + " (for copying to Excel)", value: csvSignature + csvSerialize(table, "\t")});
      textViews.push({name: "Rows: " + tView.name + " (for viewing)", table});
    }
    this.apiResponse({
      textViews,
      // URLs to further explore the REST API, not grouped
      apiSubUrls,
      // URLs to further explore the REST API, grouped by table columns
      apiGroupUrls: Object.entries(groupUrls).map(([groupKey, apiUrls]) => ({jsonPath: groupKey, apiUrls, label: apiUrls.length + " API requests, e.g. " + apiUrls[0]})),
    });
    // Don't update selectedTextView. No radio button will be selected, leaving the text area blank.
    // The results can be quite large and take a long time to render, so we only want to render a result once the user has explicitly selected it.
  }
  performSoapRequest(apiPromise) {
    this.spinFor(apiPromise.then(result => {
      let textViews = [
        {name: "Raw XML", value: new XMLSerializer().serializeToString(result)}
      ];
      this.apiResponse({
        textViews,
        apiSubUrls: null,
        apiGroupUrls: null,
      });
    }).catch(err => {
      console.error(err);
      this.apiResponse({textViews: [{name: "Error", value: (err && err.responseXML && new XMLSerializer().serializeToString(err.responseXML)) || err}]});
    }));
  }
}

function csvSerialize(table, separator) {
  return table.map(row => row.map(text => "\"" + ("" + (text == null ? "" : text)).split("\"").join("\"\"") + "\"").join(separator)).join("\r\n");
}
