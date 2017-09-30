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
    this.fieldDefinitions = new FieldDefinitions();

    // Processed data and UI state
    this.selectedSObjects = ["Account", "Case", "Opportunity"];
    this.selectedDescribeFields = ["QualifiedApiName", "Label", "Length", "NamespacePrefix", "DataType", "Precision", "Scale", "InlineHelpText", "IsNillable", "IsUnique", "IsAutonumber", "IsCalculated", "DefaultValueFormula", "ValueTypeId", "FieldDefinition.QualifiedApiName", "IsFieldHistoryTracked", "IsEncrypted", "ExtraTypeInfo", "FieldDefinition.IsIndexed"];
  }
  //TODO: Support description of fields.
  //TODO: Display errors

  startLoading() {

    let allSObjectsPromise = sfConn.rest(`/services/data/v${apiVersion}/sobjects`);
    this.spinFor("Listing sobjects", allSObjectsPromise, res => {
      this.allSObjects = res.sobjects;
      //console.log(this.allSObjects)
      //this.loadSelectedSObjects();
    });
  }

  loadSelectedSObjects() {
    //TODO: Query more...
    this.fieldDefinitions.clear();
    const soqlPartFields = [...new Set(this.selectedDescribeFields).add("EntityDefinition.FullName").add("QualifiedApiName").add("DurableId")].join(","); //Add required fields to query and remove dupes (by converting to Set)

    for (let sobjectName of this.selectedSObjects) {
      let apiCallPromise = sfConn.rest("/services/data/v" + apiVersion + "/" + "tooling/query?q=" + encodeURI(`select ${soqlPartFields} from EntityParticle where EntityDefinition.QualifiedApiName = '${sobjectName}'`));
      this.spinFor("Query tooling API to get fields", apiCallPromise, queryRes => {
        this.fieldDefinitions.addDescribes(queryRes.records);
        //console.log(queryRes);
      });
    }
  }

}

class App extends React.Component {
  render() {
    let { model } = this.props;

    return React.createElement(
      "div",
      null,
      React.createElement(SITopBar, { model: model }),
      React.createElement(
        "div",
        { className: "body" },
        React.createElement(DocArtefactList, { model: model })
      )
    );
  }
}

class FieldDefinitions {
  constructor() {
    this.describes = [];
  }

  clear() {
    this.describes = [];
  }

  addDescribes(definitions) {
    for (let definition of definitions) {
      this.describes.push(new FieldDefinition(definition));
    }
  }

  map(props) {
    return this.describes.map(props);
  }
}

class FieldDefinition {
  constructor(describe) {
    this.describe = describe;
  }

  get(fieldName) {
    let value = fieldName.split(".").reduce((prev, curr) => prev ? prev[curr] : null, this.describe);
    return typeof value == "boolean" ? JSON.stringify(value) : value;
  }

}

class DocArtefactList extends React.Component {
  render() {
    let { model } = this.props;

    return React.createElement(
      "div",
      { className: "doc-artefacts" },
      React.createElement(DocArtefactFieldDefinitions, { model: model }),
      React.createElement("hr", null)
    );
  }
}

class DocArtefactFieldDefinitions extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.onExportExcelClick = this.onExportExcelClick.bind(this);
    this.onChangeSobjects = this.onChangeSobjects.bind(this);
    this.onChangeMetadataFields = this.onChangeMetadataFields.bind(this);
  }

  onExportExcelClick(e) {
    //console.log("onExportExcelClick was clicked.", this.model.selectedSObjects);
    this.model.loadSelectedSObjects();
  }

  onChangeSobjects(e) {
    this.model.selectedSObjects = e.target.value.split(",").map(elm => elm.trim());
  }

  onChangeMetadataFields(e) {
    this.model.selectedDescribeFields = e.target.value.split(",").map(elm => elm.trim());
  }

  render() {
    return React.createElement(DocArtefactListing, { name: "Field definition table",
      description: React.createElement(
        "div",
        null,
        "Will extract the listed tooling API metadata fields for the listed sobjects. Suitable for establishing external system field overview.",
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            null,
            "SObjects (comma separated):"
          ),
          React.createElement("textarea", { className: "code", defaultValue: this.model.selectedSObjects.join(", "), onChange: this.onChangeSobjects })
        ),
        React.createElement(
          "div",
          null,
          React.createElement(
            "label",
            null,
            "Metadata fields (comma separated):"
          ),
          React.createElement("textarea", { className: "code", defaultValue: this.model.selectedDescribeFields.join(", "), onChange: this.onChangeMetadataFields })
        )
      ),
      actions: React.createElement(
        "div",
        null,
        React.createElement(
          "a",
          { href: "#", className: "button", onClick: this.onExportExcelClick },
          "Export (excel-format) into clipboard"
        ),
        React.createElement(FieldOverviewTable, { model: this.model })
      ) });
  }
}

class DocArtefactListing extends React.Component {
  render() {
    let { name, description, actions } = this.props;
    return React.createElement(
      "div",
      null,
      React.createElement(
        "h2",
        null,
        name
      ),
      React.createElement(
        "div",
        null,
        description
      ),
      React.createElement(
        "div",
        null,
        actions
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
    let { model } = this.props;

    return React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        { className: "object-bar" },
        React.createElement("img", { id: "spinner", hidden: model.spinnerCount == 0, src: "data:image/gif;base64,R0lGODlhIAAgAPUmANnZ2fX19efn5+/v7/Ly8vPz8/j4+Orq6vz8/Pr6+uzs7OPj4/f39/+0r/8gENvb2/9NQM/Pz/+ln/Hx8fDw8P/Dv/n5+f/Sz//w7+Dg4N/f39bW1v+If/9rYP96cP8+MP/h3+Li4v8RAOXl5f39/czMzNHR0fVhVt+GgN7e3u3t7fzAvPLU0ufY1wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQFCAAmACwAAAAAIAAgAAAG/0CTcEhMEBSjpGgJ4VyI0OgwcEhaR8us6CORShHIq1WrhYC8Q4ZAfCVrHQ10gC12k7tRBr1u18aJCGt7Y31ZDmdDYYNKhVkQU4sCFAwGFQ0eDo14VXsDJFEYHYUfJgmDAWgmEoUXBJ2pQqJ2HIpXAp+wGJluEHsUsEMefXsMwEINw3QGxiYVfQDQ0dCoxgQl19jX0tIFzAPZ2dvRB8wh4NgL4gAPuKkIEeclAArqAALAGvElIwb1ABOpFOgrgSqDv1tREOTTt0FIAX/rDhQIQGBACHgDFQxJBxHawHBFHnQE8PFaBAtQHnYsWWKAlAkrP2r0UkBkvYERXKZKwFGcPhcAKI1NMLjt3IaZzIQYUNATG4AR1LwEAQAh+QQFCAAtACwAAAAAIAAgAAAG3MCWcEgstkZIBSFhbDqLyOjoEHhaodKoAnG9ZqUCxpPwLZtHq2YBkDq7R6dm4gFgv8vx5qJeb9+jeUYTfHwpTQYMFAKATxmEhU8kA3BPBo+EBFZpTwqXdQJdVnuXD6FWngAHpk+oBatOqFWvs10VIre4t7RFDbm5u0QevrjAQhgOwyIQxS0dySIcVipWLM8iF08mJRpcTijJH0ITRtolJREhA5lG374STuXm8iXeuctN8fPmT+0OIPj69Fn51qCJioACqT0ZEAHhvmIWADhkJkTBhoAUhwQYIfGhqSAAIfkEBQgAJgAsAAAAACAAIAAABshAk3BINCgWgCRxyWwKC5mkFOCsLhPIqdTKLTy0U251AtZyA9XydMRuu9mMtBrwro8ECHnZXldYpw8HBWhMdoROSQJWfAdcE1YBfCMJYlYDfASVVSQCdn6aThR8oE4Mo6RMBnwlrK2smahLrq4DsbKzrCG2RAC4JRF5uyYjviUawiYBxSWfThJcG8VVGB0iIlYKvk0VDR4O1tZ/s07g5eFOFhGtVebmVQOsVu3uTs3k8+DPtvgiDg3C+CCAQNbugz6C1iBwuGAlCAAh+QQFCAAtACwAAAAAIAAgAAAG28CWcEgstgDIhcJgbBYnTaQUkIE6r8bpdJHAeo9a6aNwVYXPaAChOSiZ0nBAqmmJlNzx8zx6v7/zUntGCn19Jk0BBQcPgVcbhYZYAnJXAZCFKlhrVyOXdxpfWACeEQihV54lIaeongOsTqmbsLReBiO4ubi1RQy6urxEFL+5wUIkAsQjCsYtA8ojs00sWCvQI11OKCIdGFcnygdX2yIiDh4NFU3gvwHa5fDx8uXsuMxN5PP68OwCpkb59gkEx2CawIPwVlxp4EBgMxAQ9jUTIuHDvIlDLnCIWA5WEAAh+QQFCAAmACwAAAAAIAAgAAAGyUCTcEgMjAClJHHJbAoVm6S05KwuLcip1ModRLRTblUB1nIn1fIUwG672YW0uvSuAx4JedleX1inESEDBE12cXIaCFV8GVwKVhN8AAZiVgJ8j5VVD3Z+mk4HfJ9OBaKjTAF8IqusqxWnTK2tDbBLsqwetUQQtyIOGLpCHL0iHcEmF8QiElYBXB/EVSQDIyNWEr1NBgwUAtXVVrytTt/l4E4gDqxV5uZVDatW7e5OzPLz3861+CMCDMH4FCgCaO6AvmMtqikgkKdKEAAh+QQFCAAtACwAAAAAIAAgAAAG28CWcEgstkpIwChgbDqLyGhpo3haodIowHK9ZqWRwZP1LZtLqmZDhDq7S6YmyCFiv8vxJqReb9+jeUYSfHwoTQQDIRGARhNCH4SFTwgacE8XkYQsVmlPHJl1HV1We5kOGKNPoCIeqaqgDa5OqxWytqMBALq7urdFBby8vkQHwbvDQw/GAAvILQLLAFVPK1YE0QAGTycjAyRPKcsZ2yPlAhQM2kbhwY5N3OXx5U7sus3v8vngug8J+PnyrIQr0GQFQH3WnjAQcHAeMgQKGjoTEuAAwIlDEhCIGM9VEAAh+QQFCAAmACwAAAAAIAAgAAAGx0CTcEi8cCCiJHHJbAoln6RU5KwuQcip1MptOLRTblUC1nIV1fK0xG672YO0WvSulyIWedleB1inDh4NFU12aHIdGFV8G1wSVgp8JQFiVhp8I5VVCBF2fppOIXygTgOjpEwEmCOsrSMGqEyurgyxS7OtFLZECrgjAiS7QgS+I3HCCcUjlFUTXAfFVgIAn04Bvk0BBQcP1NSQs07e499OCAKtVeTkVQysVuvs1lzx48629QAPBcL1CwnCTKzLwC+gQGoLFMCqEgQAIfkEBQgALQAsAAAAACAAIAAABtvAlnBILLZESAjnYmw6i8io6CN5WqHSKAR0vWaljsZz9S2bRawmY3Q6u0WoJkIwYr/L8aaiXm/fo3lGAXx8J00VDR4OgE8HhIVPGB1wTwmPhCtWaU8El3UDXVZ7lwIkoU+eIxSnqJ4MrE6pBrC0oQQluLm4tUUDurq8RCG/ucFCCBHEJQDGLRrKJSNWBFYq0CUBTykAAlYmyhvaAOMPBwXZRt+/Ck7b4+/jTuq4zE3u8O9P6hEW9vj43kqAMkLgH8BqTwo8MBjPWIIFDJsJmZDhX5MJtQwogNjwVBAAOw==" }),
        React.createElement(
          "a",
          { href: model.sfLink, className: "sf-link" },
          React.createElement(
            "svg",
            { viewBox: "0 0 24 24" },
            React.createElement("path", { d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z" })
          ),
          "Salesforce Home"
        )
      )
    );
  }
}

class SObjectSelector extends React.Component {
  render() {
    let { model } = this.props;

    return model.allSObjects ? React.createElement(
      SITopBarTabBox,
      { label: "sObjects to include" },
      model.allSObjects.map(sobject => React.createElement(SITopBarTabBoxItemInput, { key: "sobjectselector-" + sobject.name, name: sobject.name, checked: "true" }))
    ) : null;
  }
}

class SITopBarTabBox extends React.Component {
  render() {
    let { children, label } = this.props;
    return React.createElement(
      "div",
      { className: "column-popup" },
      React.createElement(
        "div",
        { className: "column-popup-inner" },
        React.createElement(
          "span",
          { className: "menu-item" },
          label
        ),
        children
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
    let { rowList, name } = this.props;
    rowList.showHideColumn(e.target.checked, name);
    rowList.model.didUpdate();
  }
  render() {
    let { checked, name } = this.props;
    return React.createElement(
      "label",
      { className: "menu-item" },
      React.createElement("input", { type: "checkbox", value: "false", checked: checked }),
      name
    );
  }
}

class FieldOverviewTable extends React.Component {

  render() {
    let { model } = this.props;

    return React.createElement(
      "table",
      null,
      React.createElement(
        "thead",
        null,
        React.createElement(
          "tr",
          null,
          React.createElement(
            "th",
            null,
            "qualifiedName"
          ),
          React.createElement(
            "th",
            null,
            "sobject"
          ),
          model.selectedDescribeFields.map(fieldName => React.createElement(
            "th",
            { key: "td" + fieldName },
            fieldName
          ))
        )
      ),
      React.createElement(
        "tbody",
        null,
        model.fieldDefinitions.map(fieldDefinition => React.createElement(
          "tr",
          { key: "tr" + fieldDefinition.get("DurableId") },
          React.createElement(
            "td",
            { key: "td-qualifiedName-" + fieldDefinition.get("DurableId") },
            fieldDefinition.get("EntityDefinition.FullName")
          ),
          React.createElement(
            "td",
            { key: "td-sobject-" + fieldDefinition.get("DurableId") },
            fieldDefinition.get("EntityDefinition.FullName")
          ),
          model.selectedDescribeFields.map(fieldName => React.createElement(
            "td",
            { key: "td" + fieldDefinition.get("DurableId") + fieldName },
            fieldDefinition.get(fieldName)
          ))
        ))
      )
    );
  }
}

SILib.startPage(sfConn, initButton, ReactDOM, Model, App, React.createElement);