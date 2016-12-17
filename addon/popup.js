/* eslint-disable no-unused-vars */
/* global React ReactDOM */
/* global session:true sfHost:true apiVersion askSalesforce askSalesforceSoap */
/* exported session sfHost */
/* global initButton */
/* eslint-enable no-unused-vars */
"use strict";
if (!this.isUnitTest) {
  parent.postMessage({insextInitRequest: true}, "*");
  addEventListener("message", function initResponseHandler(e) {
    if (e.source == parent && e.data.insextInitResponse) {
      removeEventListener("message", initResponseHandler);
      sfHost = e.data.sfHost;
      init(e.data);
    }
  });
}

function closePopup() {
  parent.postMessage({insextClosePopup: true}, "*");
}

function init(params) {

  let hostArg = new URLSearchParams();
  hostArg.set("host", sfHost);
  let addonVersion = chrome.runtime.getManifest().version;

  chrome.runtime.sendMessage({message: "getSession", sfHost}, message => {
    session = message;

    ReactDOM.render(React.createElement(App, {
      isDevConsole: params.isDevConsole,
      inAura: params.inAura,
      inInspector: params.inInspector,
      hostArg,
      addonVersion,
    }), document.getElementById("root"));

  });
}

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      sobjectsList: null,
      sobjectsLoading: true,
      contextRecordId: null,
      showAdvanced: false,
    };
    this.onUpdateRecordId = this.onUpdateRecordId.bind(this);
    this.onShortcutKey = this.onShortcutKey.bind(this);
    this.onShowAdvancedClick = this.onShowAdvancedClick.bind(this);
  }
  onUpdateRecordId(e) {
    if (e.source == parent && e.data.insextUpdateRecordId) {
      let recordId = getRecordId(e.data.locationHref);
      this.setState({contextRecordId: recordId});
      this.refs.showAllDataBox.updateSelection(recordId);
    }
  }
  loadSobjects() {
    let entityMap = new Map();

    function addEntity({name, label, keyPrefix}) {
      label = label || ""; // Avoid null exceptions if the object does not have a label (some don't). All objects have a name. Not needed for keyPrefix since we only do equality comparisons on those.
      let entity = entityMap.get(name);
      if (entity) {
        if (!entity.label) { // Doesn't seem to be needed, but if we have to do it for keyPrefix, we can just as well do it for label.
          entity.label = label;
        }
        if (!entity.keyPrefix) { // For some objects the keyPrefix is only available in some of the APIs.
          entity.keyPrefix = keyPrefix;
        }
      } else {
        entity = {
          availableApis: [],
          name,
          label,
          keyPrefix
        };
        entityMap.set(name, entity);
      }
      return entity;
    }

    function getObjects(url, api) {
      return askSalesforce(url).then(describe => {
        for (let sobject of describe.sobjects) {
          addEntity(sobject).availableApis.push(api);
        }
      }).catch(err => {
        console.error("list " + api + " sobjects", err);
      });
    }

    function getEntityDefinitions(bucket) {
      let query = "select QualifiedApiName, Label, KeyPrefix from EntityDefinition" + bucket;
      return askSalesforce("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent(query)).then(res => {
        for (let record of res.records) {
          addEntity({
            name: record.QualifiedApiName,
            label: record.Label,
            keyPrefix: record.KeyPrefix
          });
        }
      }).catch(err => {
        console.error("list entity definitions: " + bucket, err);
      });
    }

    Promise.all([
      // Get objects the user can access from the regular API
      getObjects("/services/data/v" + apiVersion + "/sobjects/", "regularApi"),
      // Get objects the user can access from the tooling API
      getObjects("/services/data/v" + apiVersion + "/tooling/sobjects/", "toolingApi"),
      // Get all objects, even the ones the user cannot access from any API
      // These records are less interesting than the ones the user has access to, but still interesting since we can get information about them using the tooling API
      // If there are too many records, we get "EXCEEDED_ID_LIMIT: EntityDefinition does not support queryMore(), use LIMIT to restrict the results to a single batch"
      // We cannot use limit and offset to work around it, since EntityDefinition does not support those according to the documentation, and they seem to work in a querky way in practice.
      // Tried to use http://salesforce.stackexchange.com/a/22643, but "order by x" uses AaBbCc as sort order, while "where x > ..." uses sort order ABCabc, so it does not work on text fields, and there is no unique numerical field we can sort by.
      // Here we split the query into a somewhat arbitrary set of fixed buckets, and hope none of the buckets exceed 2000 records.
      getEntityDefinitions(" where QualifiedApiName < 'M' limit 2000"),
      getEntityDefinitions(" where QualifiedApiName >= 'M' limit 2000"),
    ])
      .then(() => {
        // TODO progressively display data as each of the three responses becomes available
        this.setState({
          sobjectsLoading: false,
          sobjectsList: Array.from(entityMap.values())
        });
        this.refs.showAllDataBox.updateSelection(this.state.contextRecordId);
      })
      .catch(e => {
        console.error(e);
        this.setState({sobjectsLoading: false});
      });
  }
  onShortcutKey(e) {
    if (e.key == "m") {
      e.preventDefault();
      this.refs.showDetailsBtn.onDetailsClick();
    }
    if (e.key == "a") {
      e.preventDefault();
      this.refs.showAllDataBox.clickAllDataBtn();
    }
    if (e.key == "e") {
      e.preventDefault();
      this.refs.dataExportBtn.click();
    }
    if (e.key == "i") {
      e.preventDefault();
      this.refs.dataImportBtn.click();
    }
    if (e.key == "x") {
      e.preventDefault();
      this.refs.apiExploreBtn.click();
    }
    if (e.key == "o") {
      e.preventDefault();
      this.setState({showAdvanced: true});
    }
    if (e.key == "l") {
      e.preventDefault();
      this.refs.limitsBtn.click();
    }
  }
  onShowAdvancedClick(e) {
    e.preventDefault();
    this.setState({showAdvanced: true});
  }
  componentDidMount() {
    addEventListener("message", this.onUpdateRecordId);
    addEventListener("keydown", this.onShortcutKey);
    parent.postMessage({insextLoaded: true}, "*");
    this.loadSobjects();
  }
  componentWillUnmount() {
    removeEventListener("message", this.onUpdateRecordId);
    removeEventListener("keydown", this.onShortcutKey);
  }
  render() {
    let linkTarget = this.props.isDevConsole ? "_blank" : "_top";
    return (
      React.createElement("div", {},
        React.createElement("div", {className: "header"},
          React.createElement("div", {className: "header-icon"},
            React.createElement("svg", {viewBox: "0 0 24 24"},
              React.createElement("path", {d: `
                M11 9c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1z
                m1 5.8c0 .2-.1.3-.3.3h-1.4c-.2 0-.3-.1-.3-.3v-4.6c0-.2.1-.3.3-.3h1.4c.2.0.3.1.3.3z
                M11 3.8c-4 0-7.2 3.2-7.2 7.2s3.2 7.2 7.2 7.2s7.2-3.2 7.2-7.2s-3.2-7.2-7.2-7.2z
                m0 12.5c-2.9 0-5.3-2.4-5.3-5.3s2.4-5.3 5.3-5.3s5.3 2.4 5.3 5.3-2.4 5.3-5.3 5.3z
                M 17.6 15.9c-.2-.2-.3-.2-.5 0l-1.4 1.4c-.2.2-.2.3 0 .5l4 4c.2.2.3.2.5 0l1.4-1.4c.2-.2.2-.3 0-.5z
                `})
            )
          ),
          "Salesforce inspector"
        ),
        React.createElement("div", {className: "main"},
          React.createElement(ShowDetailsButton, {ref: "showDetailsBtn", contextRecordId: this.state.contextRecordId, sobjectsList: this.state.sobjectsList, inAura: this.props.inAura, isDevConsole: this.props.isDevConsole, inInspector: this.props.inInspector}),
          React.createElement(AllDataBox, {ref: "showAllDataBox", linkTarget, sobjectsLoading: this.state.sobjectsLoading, sobjectsList: this.state.sobjectsList, contextRecordId: this.state.contextRecordId}),
          React.createElement("a", {ref: "dataExportBtn", href: "data-export.html?" + this.props.hostArg, target: linkTarget, className: "button"}, "Data ", React.createElement("u", {}, "E"), "xport"),
          React.createElement("a", {ref: "dataImportBtn", href: "data-import.html?" + this.props.hostArg, target: linkTarget, className: "button"}, "Data ", React.createElement("u", {}, "I"), "mport"),
          React.createElement("a", {ref: "limitsBtn", href: "limits.html?" + this.props.hostArg, target: linkTarget, className: "button"}, "Org ", React.createElement("u", {}, "L"), "imits"),
          React.createElement("a", {href: "#", onClick: this.onShowAdvancedClick, className: "base-button", style: {display: this.state.showAdvanced ? "none" : ""}}, "M", React.createElement("u", {}, "o"), "re"),
          React.createElement("a", {ref: "apiExploreBtn", href: "explore-api.html?" + this.props.hostArg, target: linkTarget, className: "button", style: {display: !this.state.showAdvanced ? "none" : ""}}, "E", React.createElement("u", {}, "x"), "plore API")
        ),
        React.createElement("div", {className: "footer"},
          React.createElement("div", {className: "meta"},
            React.createElement("div", {className: "version"}, "(v" + this.props.addonVersion + ")"),
            React.createElement("a", {href: "https://github.com/sorenkrabbe/Chrome-Salesforce-inspector", target: linkTarget}, "About")
          )
        )
      )
    );
  }
}

class ShowDetailsButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      detailsLoading: false,
      detailsShown: false,
    };
    this.onDetailsClick = this.onDetailsClick.bind(this);
  }
  onDetailsClick() {
    let self = this;
    if (this.props.inAura || this.state.detailsShown || !this.props.contextRecordId || !this.props.sobjectsList) {
      return;
    }
    let keyPrefix = this.props.contextRecordId.substring(0, 3);
    let sobject = this.props.sobjectsList.find(sobject => sobject.keyPrefix == keyPrefix);
    if (!sobject || sobject.availableApis.length == 0) {
      alert("Unknown salesforce object. Unable to identify current page's object type based on key prefix: " + keyPrefix);
      return;
    }
    let tooling = !sobject.availableApis.includes("regularApi");
    this.setState({detailsShown: true, detailsLoading: true});
    askSalesforce("/services/data/v" + apiVersion + "/" + (tooling ? "tooling/" : "") + "sobjects/" + sobject.name + "/describe/").then(res => {
      self.setState({detailsShown: true, detailsLoading: false});
      parent.postMessage({insextShowStdPageDetails: true, insextData: res}, "*");
      closePopup();
    }).catch(error => {
      self.setState({detailsShown: false, detailsLoading: false});
      console.error(error);
      alert(error);
    });
  }
  render() {
    return (
      React.createElement("button",
        {
          id: "showStdPageDetailsBtn",
          className: "button" + (this.state.detailsLoading ? " loading" : ""),
          disabled: this.props.inAura || this.state.detailsShown || !this.props.contextRecordId || !this.props.sobjectsList,
          onClick: this.onDetailsClick,
          style: {display: this.props.isDevConsole || this.props.inInspector ? "none" : ""}
        },
        "Show field ", React.createElement("u", {}, "m"), "etadata"
      )
    );
  }
}

class AllDataBox extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectedValue: null
    };
    this.onDataSelect = this.onDataSelect.bind(this);
    this.getMatches = this.getMatches.bind(this);
  }
  updateSelection(query) {
    query = query || "";
    let match = this.getBestMatch(query);
    this.setState({selectedValue: match});
  }
  getBestMatch(query) {
    let queryKeyPrefix = query.substring(0, 3);
    let recordId = null;
    let sobject = null;
    if (this.props.sobjectsList) {
      sobject = this.props.sobjectsList.find(sobject => sobject.keyPrefix == queryKeyPrefix || sobject.name.toLowerCase() == query.toLowerCase());
    }
    if (!sobject) {
      return null;
    }
    if (sobject.keyPrefix == queryKeyPrefix && query.length >= 15) {
      recordId = query;
    }
    return {recordId, sobject};
  }
  getMatches(query) {
    if (!this.props.sobjectsList) {
      return [];
    }
    let queryKeyPrefix = query.substring(0, 3);
    let res = this.props.sobjectsList
      .filter(sobject => sobject.name.toLowerCase().includes(query.toLowerCase()) || sobject.label.toLowerCase().includes(query.toLowerCase()) || sobject.keyPrefix == queryKeyPrefix)
      .map(sobject => ({
        recordId: null,
        sobject,
        // TO-DO: merge with the sortRank function in data-export
        relevance: (sobject.keyPrefix == queryKeyPrefix ? 2
          : sobject.name.toLowerCase() == query.toLowerCase() ? 3
          : sobject.label.toLowerCase() == query.toLowerCase() ? 4
          : sobject.name.toLowerCase().startsWith(query.toLowerCase()) ? 5
          : sobject.label.toLowerCase().startsWith(query.toLowerCase()) ? 6
          : sobject.name.toLowerCase().includes("__" + query.toLowerCase()) ? 7
          : sobject.name.toLowerCase().includes("_" + query.toLowerCase()) ? 8
          : sobject.label.toLowerCase().includes(" " + query.toLowerCase()) ? 9
          : 10) + (sobject.availableApis.length == 0 ? 20 : 0)
      }));
    query = query || this.props.contextRecordId || "";
    queryKeyPrefix = query.substring(0, 3);
    if (query.length >= 15) {
      let objectsForId = this.props.sobjectsList.filter(sobject => sobject.keyPrefix == queryKeyPrefix);
      for (let sobject of objectsForId) {
        res.unshift({recordId: query, sobject, relevance: 1});
      }
    }
    res.sort((a, b) => a.relevance - b.relevance || a.sobject.name.localeCompare(b.sobject.name));
    return res;
  }
  onDataSelect(value) {
    this.setState({selectedValue: value});
  }
  clickAllDataBtn() {
    this.refs.allDataSelection.clickAllDataBtn();
  }
  render() {
    return (
      React.createElement("div", {className: "all-data-box " + (this.props.sobjectsLoading ? "loading " : "")},
        React.createElement(AllDataSearch, {onDataSelect: this.onDataSelect, sobjectsList: this.props.sobjectsList, getMatches: this.getMatches}),
        this.state.selectedValue ? React.createElement(AllDataSelection, {ref: "allDataSelection", selectedValue: this.state.selectedValue, linkTarget: this.props.linkTarget}) : null
      )
    );
  }
}

class AllDataSelection extends React.PureComponent {
  clickAllDataBtn() {
    this.refs.showAllDataBtn.click();
  }
  getAllDataUrl(toolingApi) {
    if (this.props.selectedValue) {
      let args = new URLSearchParams();
      args.set("host", sfHost);
      args.set("objectType", this.props.selectedValue.sobject.name);
      if (toolingApi) {
        args.set("useToolingApi", "1");
      }
      if (this.props.selectedValue.recordId) {
        args.set("recordId", this.props.selectedValue.recordId);
      }
      return "inspect.html?" + args;
    } else {
      return undefined;
    }
  }
  getDeployStatusUrl() {
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("checkDeployStatus", this.props.selectedValue.recordId);
    return "explore-api.html?" + args;
  }
  render() {
    // Show buttons for the available APIs.
    let buttons = Array.from(this.props.selectedValue.sobject.availableApis);
    if (buttons.length == 0) {
      // If none of the APIs are available, show a button for the regular API, which will partly fail, but still show some useful metadata from the tooling API.
      buttons.push("noApi");
    }
    return (
      React.createElement("div", {className: "all-data-box-inner"},
        React.createElement("div", {title: "Record ID", className: "data-element"}, this.props.selectedValue.recordId),
        React.createElement("div", {title: "API name", className: "data-element"}, this.props.selectedValue.sobject.name),
        React.createElement("div", {title: "Label", className: "data-element"}, this.props.selectedValue.sobject.label),
        React.createElement("div", {title: "ID key prefix", className: "data-element"}, this.props.selectedValue.sobject.keyPrefix),
        this.props.selectedValue.recordId && this.props.selectedValue.recordId.startsWith("0Af")
          ? React.createElement("a", {href: this.getDeployStatusUrl(), target: this.props.linkTarget, className: "base-button"}, "Check Deploy Status") : null,
        buttons.map((button, index) => React.createElement("a",
          {
            key: button,
            // If buttons for both APIs are shown, the keyboard shortcut should open the first button.
            ref: index == 0 ? "showAllDataBtn" : null,
            href: this.getAllDataUrl(button == "toolingApi"),
            target: this.props.linkTarget,
            className: "base-button"
          },
          index == 0 ? React.createElement("span", {}, "Show ", React.createElement("u", {}, "a"), "ll data") : "Show all data",
          button == "regularApi" ? ""
            : button == "toolingApi" ? " (Tooling API)"
            : " (Not readable)"
        ))
      )
    );
  }
}

class AllDataSearch extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      inspectQuery: ""
    };
    this.onAllDataInput = this.onAllDataInput.bind(this);
    this.onAllDataFocus = this.onAllDataFocus.bind(this);
    this.onAllDataBlur = this.onAllDataBlur.bind(this);
    this.onAllDataKeyDown = this.onAllDataKeyDown.bind(this);
    this.updateAllDataInput = this.updateAllDataInput.bind(this);
    this.onAllDataArrowClick = this.onAllDataArrowClick.bind(this);
  }
  onAllDataInput(e) {
    let val = e.target.value;
    this.refs.autoComplete.handleInput();
    this.setState({inspectQuery: val});
  }
  onAllDataFocus() {
    this.refs.autoComplete.handleFocus();
  }
  onAllDataBlur() {
    this.refs.autoComplete.handleBlur();
  }
  onAllDataKeyDown(e) {
    this.refs.autoComplete.handleKeyDown(e);
    e.stopPropagation(); // Stop our keyboard shortcut handler
  }
  updateAllDataInput(value) {
    this.props.onDataSelect(value);
    this.setState({inspectQuery: ""});
  }
  onAllDataArrowClick() {
    this.refs.showAllDataInp.focus();
  }
  render() {
    return (
      React.createElement("div", {className: "input-with-dropdown"},
        React.createElement("div", {},
          React.createElement("input", {
            className: "all-data-input",
            ref: "showAllDataInp",
            placeholder: "Record id, id prefix or sObject name",
            onInput: this.onAllDataInput,
            onFocus: this.onAllDataFocus,
            onBlur: this.onAllDataBlur,
            onKeyDown: this.onAllDataKeyDown,
            value: this.state.inspectQuery
          }),
          React.createElement(Autocomplete, {
            ref: "autoComplete",
            updateInput: this.updateAllDataInput,
            matchingResults: this.props.getMatches(this.state.inspectQuery)
              .map(value => ({
                key: value.recordId + "#" + value.sobject.name,
                value,
                element: [
                  React.createElement("div", {className: "autocomplete-item-main", key: "main"},
                    value.recordId || React.createElement(MarkSubstring, {
                      text: value.sobject.name,
                      start: value.sobject.name.toLowerCase().indexOf(this.state.inspectQuery.toLowerCase()),
                      length: this.state.inspectQuery.length
                    }),
                    value.sobject.availableApis.length == 0 ? " (Not readable)" : ""
                  ),
                  React.createElement("div", {className: "autocomplete-item-sub", key: "sub"},
                    React.createElement(MarkSubstring, {
                      text: value.sobject.keyPrefix || "---",
                      start: value.sobject.keyPrefix == this.state.inspectQuery.substring(0, 3) ? 0 : -1,
                      length: 3
                    }),
                    " • ",
                    React.createElement(MarkSubstring, {
                      text: value.sobject.label,
                      start: value.sobject.label.toLowerCase().indexOf(this.state.inspectQuery.toLowerCase()),
                      length: this.state.inspectQuery.length
                    })
                  )
                ]
              }))
          })
        ),
        React.createElement("svg", {viewBox: "0 0 24 24", onClick: this.onAllDataArrowClick},
          React.createElement("path", {d: "M3.8 6.5h16.4c.4 0 .8.6.4 1l-8 9.8c-.3.3-.9.3-1.2 0l-8-9.8c-.4-.4-.1-1 .4-1z"})
        )
      )
    );
  }
}

function MarkSubstring({text, start, length}) {
  if (start == -1) {
    return React.createElement("span", {}, text);
  }
  return React.createElement("span", {},
    text.substr(0, start),
    React.createElement("mark", {}, text.substr(start, length)),
    text.substr(start + length)
  );
}

class Autocomplete extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showResults: false,
      selectedIndex: 0, // Index of the selected autocomplete item.
      scrollToSelectedIndex: 0, // Changed whenever selectedIndex is updated (even if updated to a value it already had). Used to scroll to the selected item.
      scrollTopIndex: 0, // Index of the first autocomplete item that is visible according to the current scroll position.
      itemHeight: 1, // The height of each autocomplete item. All items should have the same height. Measured on first render. 1 means not measured.
      resultsMouseIsDown: false // Hide the autocomplete popup when the input field looses focus, except when clicking one of the autocomplete items.
    };
    this.onResultsMouseDown = this.onResultsMouseDown.bind(this);
    this.onResultsMouseUp = this.onResultsMouseUp.bind(this);
    this.onResultClick = this.onResultClick.bind(this);
    this.onResultMouseEnter = this.onResultMouseEnter.bind(this);
    this.onScroll = this.onScroll.bind(this);
  }
  handleInput() {
    this.setState({showResults: true, selectedIndex: 0, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1});
  }
  handleFocus() {
    this.setState({showResults: true, selectedIndex: 0, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1});
  }
  handleBlur() {
    this.setState({showResults: false});
  }
  handleKeyDown(e) {
    if (e.key == "Enter") {
      if (this.state.selectedIndex < this.props.matchingResults.length) {
        e.preventDefault();
        let {value} = this.props.matchingResults[this.state.selectedIndex];
        this.props.updateInput(value);
        this.setState({showResults: false, selectedIndex: 0});
      }
      return;
    }
    if (e.key == "Escape") {
      e.preventDefault();
      this.setState({showResults: false, selectedIndex: 0});
      return;
    }
    let selectionMove = 0;
    if (e.key == "ArrowDown") {
      selectionMove = 1;
    }
    if (e.key == "ArrowUp") {
      selectionMove = -1;
    }
    if (selectionMove != 0) {
      e.preventDefault();
      if (!this.state.showResults) {
        this.setState({showResults: true, selectedIndex: 0, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1});
        return;
      }
      let index = this.state.selectedIndex + selectionMove;
      let length = this.props.matchingResults.length;
      if (index < 0) {
        index = length - 1;
      }
      if (index > length - 1) {
        index = 0;
      }
      this.setState({selectedIndex: index, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1});
    }
  }
  onResultsMouseDown() {
    this.setState({resultsMouseIsDown: true});
  }
  onResultsMouseUp() {
    this.setState({resultsMouseIsDown: false});
  }
  onResultClick(value) {
    this.props.updateInput(value);
    this.setState({showResults: false, selectedIndex: 0});
  }
  onResultMouseEnter(index) {
    this.setState({selectedIndex: index, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1});
  }
  onScroll() {
    let scrollTopIndex = Math.floor(this.refs.scrollBox.scrollTop / this.state.itemHeight);
    if (scrollTopIndex != this.state.scrollTopIndex) {
      this.setState({scrollTopIndex});
    }
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.itemHeight == 1) {
      let anItem = this.refs.scrollBox.querySelector(".autocomplete-item");
      if (anItem) {
        let itemHeight = anItem.offsetHeight;
        if (itemHeight > 0) {
          this.setState({itemHeight});
        }
      }
      return;
    }
    let sel = this.refs.selectedItem;
    if (this.state.scrollToSelectedIndex != prevState.scrollToSelectedIndex && sel && sel.offsetParent) {
      if (sel.offsetTop < sel.offsetParent.scrollTop) {
        sel.scrollIntoView(true);
      } else if (sel.offsetTop + sel.offsetHeight > sel.offsetParent.scrollTop + sel.offsetParent.offsetHeight) {
        sel.scrollIntoView(false);
      }
    }
  }
  render() {
    // For better performance only render the visible autocomplete items + at least one invisible item above and below (if they exist)
    const RENDERED_ITEMS_COUNT = 11;
    let firstIndex = 0;
    let lastIndex = this.props.matchingResults.length - 1;
    let firstRenderedIndex = Math.max(0, this.state.scrollTopIndex - 2);
    let lastRenderedIndex = Math.min(lastIndex, firstRenderedIndex + RENDERED_ITEMS_COUNT);
    let topSpace = (firstRenderedIndex - firstIndex) * this.state.itemHeight;
    let bottomSpace = (lastIndex - lastRenderedIndex) * this.state.itemHeight;
    let topSelected = (this.state.selectedIndex - firstIndex) * this.state.itemHeight;
    return (
      React.createElement("div", {className: "autocomplete-container", style: {display: (this.state.showResults && this.props.matchingResults.length > 0) || this.state.resultsMouseIsDown ? "" : "none"}, onMouseDown: this.onResultsMouseDown, onMouseUp: this.onResultsMouseUp},
        React.createElement("div", {className: "autocomplete", onScroll: this.onScroll, ref: "scrollBox"},
          React.createElement("div", {ref: "selectedItem", style: {position: "absolute", top: topSelected + "px", height: this.state.itemHeight + "px"}}),
          React.createElement("div", {style: {height: topSpace + "px"}}),
          this.props.matchingResults.slice(firstRenderedIndex, lastRenderedIndex + 1)
            .map(({key, value, element}, index) =>
              React.createElement("a", {
                key,
                className: "autocomplete-item " + (this.state.selectedIndex == index + firstRenderedIndex ? "selected" : ""),
                onClick: () => this.onResultClick(value),
                onMouseEnter: () => this.onResultMouseEnter(index + firstRenderedIndex)
              }, element)
            ),
          React.createElement("div", {style: {height: bottomSpace + "px"}})
        )
      )
    );
  }
}

function getRecordId(href) {
  let url = new URL(href);
  // Find record ID from URL
  let searchParams = new URLSearchParams(url.search.substring(1));
  // Salesforce Classic and Console
  if (url.hostname.endsWith(".salesforce.com")) {
    let match = url.pathname.match(/\/([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/);
    if (match) {
      let res = match[1];
      if (res.includes("0000") || res.length == 3) {
        return match[1];
      }
    }
  }
  // Lightning Experience and Salesforce1
  if (url.hostname.endsWith(".lightning.force.com")) {
    let match = url.hash.match(/\/sObject\/([a-zA-Z0-9]+)(?:\/|$)/);
    if (match) {
      return match[1];
    }
  }
  // Visualforce
  {
    let idParam = searchParams.get("id");
    if (idParam) {
      return idParam;
    }
  }
  // Visualforce page that does not follow standard Visualforce naming
  for (let [, p] of searchParams) {
    if (p.match(/^([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/) && p.includes("0000")) {
      return p;
    }
  }
  return null;
}
