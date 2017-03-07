/* eslint-disable no-unused-vars */
/* global React ReactDOM */
/* global sfConn apiVersion */
/* global initButton */
/* eslint-enable no-unused-vars */
"use strict";

class Model {
  constructor(sfHost, args) {
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.title = "API Request";
    this.userInfo = "...";

    this.apiResponse = null;
    this.selectedTextView = null;

    this.editMode = false;
    this.editType = "REST";
    this.editUrl = "";
    this.editMethod = "GET";
    this.editNamespace = "";
    this.editBody = "";

    if (args.has("apiUrls")) {
      let apiUrls = args.getAll("apiUrls");
      this.title = apiUrls.length + " API requests, e.g. " + apiUrls[0];
      let apiPromise = Promise.all(apiUrls.map(url => sfConn.rest(url)));
      this.performRequest(apiPromise);
    } else if (args.has("checkDeployStatus")) {
      this.editMode = true;
      this.editType = "SOAP";
      this.setSoapType("Metadata");
      this.editBody = "<checkDeployStatus>\n  <id>" + args.get("checkDeployStatus") + "</id>\n  <includeDetails>true</includeDetails>\n</checkDeployStatus>";
    } else {
      let apiUrl = args.get("apiUrl") || "/services/data/";
      if (args.has("edit")) {
        this.editMode = true;
        this.editUrl = apiUrl;
      } else {
        this.title = apiUrl;
        let apiPromise = sfConn.rest(apiUrl);
        this.performRequest(apiPromise);
      }
    }

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
  openSubUrl(subUrl) {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("apiUrl", subUrl.apiUrl);
    return "explore-api.html?" + args;
  }
  editSubUrl(subUrl) {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("apiUrl", subUrl.apiUrl);
    args.set("edit", "1");
    return "explore-api.html?" + args;
  }
  openGroupUrl(groupUrl) {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    for (let url of groupUrl.apiUrls) {
      args.append("apiUrls", url);
    }
    return "explore-api.html?" + args;
  }
  sendClick() {
    if (this.editType == "REST") {
      let apiUrl = this.editUrl;
      this.title = apiUrl;
      let apiPromise = sfConn.rest(apiUrl, {method: this.editMethod, bodyText: this.editBody});
      this.performRequest(apiPromise);
    } else if (this.editType == "SOAP") {
      let apiUrl = this.editUrl;
      this.title = "SOAP " + apiUrl;
      let apiPromise = sfConn.rawSoap({servicePortAddress: apiUrl, targetNamespace: this.editNamespace}, this.editBody);
      this.performSoapRequest(apiPromise);
    } else {
      console.error("Unknown type");
    }
  }
  setSoapType(soapType) {
    let soapBody = "<methodName></methodName>";
    let wsdl = sfConn.wsdl(apiVersion, soapType);
    this.editUrl = wsdl.servicePortAddress;
    this.editNamespace = wsdl.targetNamespace;
    this.editBody = soapBody;
  }
  performRequest(apiPromise) {
    this.spinFor(apiPromise.then(result => {
      this.parseResponse(result);
    }).catch(err => {
      console.error(err);
      this.apiResponse = {textViews: [{name: "Error", value: (err && err.sfConnError) || err}]};
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
        ["URL", this.title],
        ["Rows", tView.name],
        ["Extract time", new Date().toISOString()]
      ], "\t") + "\r\n\r\n";
      textViews.push({name: "Rows: " + tView.name + " (for copying to Excel)", value: csvSignature + csvSerialize(table, "\t")});
      textViews.push({name: "Rows: " + tView.name + " (for viewing)", table});
    }
    this.apiResponse = {
      textViews,
      // URLs to further explore the REST API, not grouped
      apiSubUrls,
      // URLs to further explore the REST API, grouped by table columns
      apiGroupUrls: Object.entries(groupUrls).map(([groupKey, apiUrls]) => ({jsonPath: groupKey, apiUrls, label: apiUrls.length + " API requests, e.g. " + apiUrls[0]})),
    };
    // Don't update selectedTextView. No radio button will be selected, leaving the text area blank.
    // The results can be quite large and take a long time to render, so we only want to render a result once the user has explicitly selected it.
  }
  performSoapRequest(apiPromise) {
    this.spinFor(apiPromise.then(result => {
      let textViews = [
        {name: "Raw XML", value: new XMLSerializer().serializeToString(result)}
      ];
      this.apiResponse = {
        textViews,
        apiSubUrls: null,
        apiGroupUrls: null,
      };
    }).catch(err => {
      console.error(err);
      let textViews = [];
      if (err && err.sfConnError) {
        textViews.push({name: "Error", value: err.sfConnError});
      }
      if (err && err.rawSoapError) {
        textViews.push({name: "Error (Raw XML)", value: new XMLSerializer().serializeToString(err.rawSoapError)});
      }
      if (textViews.length == 0) {
        textViews.push({name: "Error", value: err});
      }
      this.apiResponse = {textViews};
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
    this.onEditTypeChange = this.onEditTypeChange.bind(this);
    this.onEditSoapChange = this.onEditSoapChange.bind(this);
    this.onEditUrlChange = this.onEditUrlChange.bind(this);
    this.onEditMethodChange = this.onEditMethodChange.bind(this);
    this.onEditNamespaceChange = this.onEditNamespaceChange.bind(this);
    this.onEditBodyChange = this.onEditBodyChange.bind(this);
    this.onSendClick = this.onSendClick.bind(this);
  }

  onEditTypeChange(e) {
    let {model} = this.props;
    model.editType = e.target.value;
    model.didUpdate();
  }

  onEditSoapChange(e) {
    let {model} = this.props;
    model.setSoapType(e.target.value);
    model.didUpdate();
  }

  onEditUrlChange(e) {
    let {model} = this.props;
    model.editUrl = e.target.value;
    model.didUpdate();
  }

  onEditMethodChange(e) {
    let {model} = this.props;
    model.editMethod = e.target.value;
    model.didUpdate();
  }

  onEditNamespaceChange(e) {
    let {model} = this.props;
    model.editNamespace = e.target.value;
    model.didUpdate();
  }

  onEditBodyChange(e) {
    let {model} = this.props;
    model.editBody = e.target.value;
    model.didUpdate();
  }

  onSendClick() {
    let {model} = this.props;
    model.sendClick();
    model.didUpdate();
  }

  render() {
    let {model} = this.props;
    document.title = model.title;
    return h("div", {},
      h("img", {id: "spinner", src: "data:image/gif;base64,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", hidden: model.spinnerCount == 0}),
      h("a", {href: model.sfLink}, "Salesforce Home"),
      " \xa0 ",
      h("span", {}, model.userInfo),
      model.editMode && h("div", {className: "edit-form"},
        h("label", {},
          h("span", {}, "Type"),
          h("select", {value: model.editType, onChange: this.onEditTypeChange},
            h("option", {}, "REST"),
            h("option", {}, "SOAP")
          )
        ),
        model.editType == "SOAP" && h("label", {},
          h("span", {}, "API"),
          h("select", {value: "--Select--", onChange: this.onEditSoapChange},
            h("option", {}, "--Select--"),
            h("option", {}, "Enterprise"),
            h("option", {}, "Partner"),
            h("option", {}, "Apex"),
            h("option", {}, "Metadata"),
            h("option", {}, "Tooling")
          )
        ),
        h("label", {},
          h("span", {}, "URL"),
          h("input", {value: model.editUrl, onChange: this.onEditUrlChange})
        ),
        model.editType == "REST" && h("label", {},
          h("span", {}, "Method"),
          h("select", {value: model.editMethod, onChange: this.onEditMethodChange},
            h("option", {}, "GET"),
            h("option", {}, "POST"),
            h("option", {}, "PUT"),
            h("option", {}, "PATCH"),
            h("option", {}, "DELETE")
          )
        ),
        model.editType == "SOAP" && h("label", {},
          h("span", {}, "Namespace"),
          h("input", {value: model.editNamespace, onChange: this.onEditNamespaceChange})
        ),
        h("label", {},
          h("span", {}, "Body"),
          h("textarea", {value: model.editBody, onChange: this.onEditBodyChange})
        ),
        h("button", {onClick: this.onSendClick, disabled: model.spinnerCount != 0}, "Send")
      ),
      model.apiResponse && h("div", {},
        h("ul", {},
          model.apiResponse.textViews.map(textView =>
            h("li", {key: textView.name},
              h("label", {},
                h("input", {type: "radio", name: "textView", checked: model.selectedTextView == textView, onChange: () => { model.selectedTextView = textView; model.didUpdate(); }}),
                " " + textView.name
              )
            )
          )
        ),
        model.selectedTextView && !model.selectedTextView.table && h("div", {},
          h("textarea", {readOnly: true, value: model.selectedTextView.value})
        ),
        model.selectedTextView && model.selectedTextView.table && h("div", {},
          h("table", {},
            h("tbody", {},
              model.selectedTextView.table.map((row, key) =>
                h("tr", {key},
                  row.map((cell, key) =>
                    h("td", {key}, "" + cell)
                  )
                )
              )
            )
          )
        ),
        model.apiResponse.apiGroupUrls && h("ul", {},
          model.apiResponse.apiGroupUrls.map((apiGroupUrl, key) =>
            h("li", {key},
              h("a", {href: model.openGroupUrl(apiGroupUrl)}, apiGroupUrl.jsonPath),
              " - " + apiGroupUrl.label
            )
          )
        ),
        model.apiResponse.apiSubUrls && h("ul", {},
          model.apiResponse.apiSubUrls.map((apiSubUrl, key) =>
            h("li", {key},
              h("a", {href: model.openSubUrl(apiSubUrl)}, apiSubUrl.jsonPath),
              " - " + apiSubUrl.label + " ",
              h("a", {href: model.editSubUrl(apiSubUrl)}, "Edit")
            )
          )
        )
      ),
      h("a", {href: "https://www.salesforce.com/us/developer/docs/api_rest/", target: "_blank"}, "REST API documentation")
    );
  }

}

{

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model(sfHost, args);
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

  });

}
