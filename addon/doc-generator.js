/* eslint-disable no-unused-vars */
/* global React ReactDOM */
/* global sfConn apiVersion */
/* global SILib */
/* global initButton */
/* eslint-enable no-unused-vars */
"use strict";

class Model extends SILib.SIPageModel {
  constructor(sfHost) {
    super(sfHost);

    // Raw fetched data
    this.allSObjects = null;
    this.sobjectDescribes = []; //Array element per sobject described. Each element has keys "sobject", "describe"

    // Processed data and UI state
    this.selectedSObjects = ["Account", "Contact", "Case"]; //API names of sobjects to include in output
    this.selectedDescribeFields = ["name", "label", "type", "helpText", "description", "type", "length", "precision", "scale", "calculated", "nillable", "unique", "caseSensitive", "compoundFieldName", "autoNumber"]; //calculatedFormula//field names (from sobject/describe call) to include in output
  }
  //TODO: Support description and help text fields

  startLoading() {


    let allSObjectsPromise = sfConn.rest("/services/data/v" + apiVersion + "/" + "sobjects");
    this.spinFor("Listing sobjects", allSObjectsPromise, (res) => {
      this.allSobjects = res;
      this.loadSelectedSObjects();
    });
  }

  isReadyForSObjectList() {
    return this.allSobjects != null;
  }

  loadSelectedSObjects() {
    for (let sobjectName of this.selectedSObjects) {
      let apiCallPromise = sfConn.rest("/services/data/v" + apiVersion + "/" + "sobjects" + "/" + sobjectName + "/describe");
      this.spinFor("Describing " + sobjectName, apiCallPromise, (sobjectDescribeRes) => {
        this.sobjectDescribes.push({
          "sobject": sobjectName,
          "describe": sobjectDescribeRes
        });
        //console.log(sobjectDescribeRes);
      });
    }
  }
}

let h = React.createElement;

class App extends React.Component {
  render() {
    let {
      model
    } = this.props;

    return (
      h("div", {},
        h(SITopBar, {model}),
        h("div", {className: "body"},
          h(FieldOverviewTable, {model})
        )
      )
    );
  }
}

/**
* TODO: Generalize into si-lib
* TODO: Refactor into smaller components
*/
class SITopBar extends React.Component {

  render() {
    let {model} = this.props;

    return (
    h("div", {},
      h("div", {className: "object-bar"},
        h("img", {id: "spinner", src: "data:image/gif;base64,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", hidden: model.spinnerCount == 0}),
        h("a", {href: model.sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
          ),
          "Salesforce Home"
          ),
        h("span", {className: "object-tab" + (model.useTab == "childs" ? " active-tab" : "")},
          h("a", {href: "about:blank", className: "tab-with-icon", onClick: this.onUseChildsTab}, "sOjects"),
          h("span", {className: "column-button-outer"},
            h("a", {href: "about:blank", onClick: this.onAvailableColumnsClick, className: "button-icon-link"},
              h("svg", {className: "button-icon"},
                h("use", {xlinkHref: "symbols.svg#chevrondown"})
              )
            ),
            h(SITopBarTabBox, {
              "label": "sObjects to include",
              "content": () => [
                h(SITopBarTabBoxItemInput, {name: "List all sobjects"})
              ]
            })
          )
          )
        )
    ));
  }
}

class SITopBarTabBox extends React.Component {
  render() {
    let {content, label} = this.props;

    return (
      h("div", {className: "column-popup"},
        h("div", {className: "column-popup-inner"},
          h("span", {className: "menu-item"}, label),
          content()
        )
      )
    );
  }
}

class SITopBarTabBoxItemInput extends React.Component {
  constructor(props) {
    super(props);
    this.onShowColumnChange = this.onShowColumnChange.bind(this);
  }
  onShowColumnChange(e) {
    let {rowList, name} = this.props;
    rowList.showHideColumn(e.target.checked, name);
    rowList.model.didUpdate();
  }
  render() {
    let {rowList, name, disabled} = this.props;
    return (
    h("label", {className: "menu-item"},
      h("input", {
        type: "checkbox",
        checked: false, //rowList.selectedColumnMap.has(name),
        onChange: undefined, //this.onShowColumnChange,
        disabled
      }),
      name //rowList.createColumn(name).label
    ));
  }
}

class FieldOverviewTable extends React.Component {

  render() {
    let {model} = this.props;

    return (
      h("table", {},
        h("thead", {},
          h("tr", {},
            h("th", {}, "qualifiedName"),
            h("th", {}, "sobject"),
            model.selectedDescribeFields.map(fieldName =>
              h("th", {key: "th" + fieldName}, fieldName)
            )
          )
        ),
        h("tbody", {},
          model.sobjectDescribes.map(sobjectDescribe =>
            sobjectDescribe.describe.fields.map(fieldDescribe =>
              h("tr", {key: "tr" + sobjectDescribe.sobject + fieldDescribe.name},
                h("td", {key: "td" + "qualifiedName"}, sobjectDescribe.sobject + "." + fieldDescribe.name),
                h("td", {key: "td" + "sobject"}, sobjectDescribe.sobject),
                model.selectedDescribeFields.map(fieldName =>
                  h("td", {key: "td" + sobjectDescribe.sobject + fieldName}, (typeof fieldDescribe[fieldName] == "boolean") ? JSON.stringify(fieldDescribe[fieldName]) : fieldDescribe[fieldName])
                )
              )
            )
          )
        )
      )
    );
  }
}

class SObjectSelector extends React.Component {

  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }

  onChange() {
    alert("Updates not yet supported...");
  }

  render() {
    let {
      model
    } = this.props;

    return (model.isReadyForSObjectList()) ? (
      h("select", {
        "multiple": "multiple",
        "value": model.selectedSObjects,
        "onChange": this.onChange
      }, model.allSobjects.sobjects.map(sobject =>
        h("option", {
          "key": sobject.name
        }, sobject.name)
      ))
    ) : null;
  }
}

SILib.startPage(sfConn, initButton, ReactDOM, Model, App, h);