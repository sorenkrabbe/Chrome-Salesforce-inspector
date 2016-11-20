"use strict";
parent.postMessage({insextInitRequest: true}, "*");
addEventListener("message", function initResponseHandler(e) {
  if (e.source == parent && e.data.insextInitResponse) {
    removeEventListener("message", initResponseHandler);
    sfHost = e.data.sfHost;
    init(e.data);
  }
});

function closePopup() {
  parent.postMessage({insextClosePopup: true}, "*");
}

function init(params) {

  let hostArg = new URLSearchParams();
  hostArg.set("host", sfHost);
  let addonVersion = chrome.runtime.getManifest().version;

  class app extends React.PureComponent {
    constructor(props) {
      super(props);
      this.state = {
        sobjectsLists: null,
        sobjectsLoading: true,
        detailsShown: false,
        detailsLoading: false,
        contextRecordId: null
      };
      this.onUpdateRecordId = this.onUpdateRecordId.bind(this);
      this.onShortcutKey = this.onShortcutKey.bind(this);
      this.onDetailsClick = this.onDetailsClick.bind(this);
    }
    onUpdateRecordId(e) {
      if (e.source == parent && e.data.insextUpdateRecordId) {
        this.setState({contextRecordId: e.data.recordId});
        this.refs.showAllDataBox.updateSelection(e.data.recordId);
      }
    }
    loadSobjects() {
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({message: "getSession", sfHost}, message => {
          session = message;
          resolve();
        });
      })
      .then(() => {
        return Promise.all([
          askSalesforce("/services/data/v" + apiVersion + "/sobjects/").then(res => ({toolingApi: false, sobjects: res.sobjects})),
          askSalesforce("/services/data/v" + apiVersion + "/tooling/sobjects/").then(res => ({toolingApi: true, sobjects: res.sobjects}))
        ]);
      })
      .then(res => {
        this.setState({sobjectsLoading: false, sobjectsLists: res});
        this.refs.showAllDataBox.updateSelection(this.state.contextRecordId);
      })
      .catch(() => {
        this.setState({sobjectsLoading: false});
      });
    }
    onShortcutKey(e) {
      if (e.key == "m") {
        e.preventDefault();
        this.onDetailsClick();
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
    }
    onDetailsClick() {
      let self = this;
      if (this.state.detailsShown || !this.state.contextRecordId) {
        return;
      }
      this.setState({detailsShown: true, detailsLoading: true});
      parent.postMessage({insextShowStdPageDetails: true}, "*");
      addEventListener("message", function messageHandler(e) {
        if (e.source == parent && e.data.insextShowStdPageDetails) {
          removeEventListener("message", messageHandler);
          self.setState({detailsShown: e.data.success, detailsLoading: false});
          if (e.data.success) {
            closePopup();
          }
        }
      });
    }
    componentDidMount() {
      addEventListener("message", this.onUpdateRecordId);
      addEventListener("keydown", this.onShortcutKey);
      this.loadSobjects();
    }
    componentWillUnmount() {
      removeEventListener("message", this.onUpdateRecordId);
      removeEventListener("keydown", this.onShortcutKey);
    }
    render() {
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
            React.createElement("button",
              {
                id: "showStdPageDetailsBtn",
                className: "button" + (this.state.detailsLoading ? " loading" : ""),
                disabled: this.props.inAura || this.state.detailsShown || !this.state.contextRecordId,
                onClick: this.onDetailsClick,
                style: {display: this.props.isDevConsole || this.props.inInspector ? "none" : ""}
              },
              "Show field ", React.createElement("u", {}, "m"), "etadata"
            ),
            React.createElement(AllDataBox, {ref: "showAllDataBox", isDevConsole: this.props.isDevConsole, sobjectsLoading: this.state.sobjectsLoading, sobjectsLists: this.state.sobjectsLists, contextRecordId: this.state.contextRecordId}),
            React.createElement("a", {ref: "dataExportBtn", href: "data-export.html?" + hostArg, target: this.props.isDevConsole ? "_blank" : "_top", className: "button"}, "Data ", React.createElement("u", {}, "E"), "xport"),
            React.createElement("a", {ref: "dataImportBtn", href: "data-import.html?" + hostArg, target: this.props.isDevConsole ? "_blank" : "_top", className: "button"}, "Data ", React.createElement("u", {}, "I"), "mport"),
            React.createElement("a", {ref: "apiExploreBtn", href: "explore-api.html?" + hostArg, target: this.props.isDevConsole ? "_blank" : "_top", className: "button", style: {display: !this.props.isDevConsole ? "none" : ""}}, "E", React.createElement("u", {}, "x"), "plore API")
          ),
          React.createElement("div", {className: "footer"},
            React.createElement("div", {className: "meta"},
              React.createElement("div", {className: "version"}, "(v" + addonVersion + ")"),
              React.createElement("a", {href: "https://github.com/sorenkrabbe/Chrome-Salesforce-inspector", target: this.props.isDevConsole ? "_blank" : "_top"}, "About")
            )
          )
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
      let toolingApi = null;
      if (this.props.sobjectsLists) {
        for (let api of this.props.sobjectsLists) {
          sobject = api.sobjects.find(sobject => sobject.keyPrefix == queryKeyPrefix || sobject.name.toLowerCase() == query.toLowerCase());
          if (sobject) {
            toolingApi = api.toolingApi;
            break;
          }
        }
      }
      if (!sobject) {
        return null;
      }
      if (sobject.keyPrefix == queryKeyPrefix && query.length >= 15) {
        recordId = query;
      }
      return {recordId, sobject, toolingApi};
    }
    getMatches(query) {
      if (!this.props.sobjectsLists) {
        return [];
      }
      let queryKeyPrefix = query.substring(0, 3);
      let res = [];
      for (let api of this.props.sobjectsLists) {
        res = res.concat(
          api.sobjects
            .filter(sobject => sobject.name.toLowerCase().includes(query.toLowerCase()) || sobject.label.toLowerCase().includes(query.toLowerCase()) || sobject.keyPrefix == queryKeyPrefix)
            .map(sobject => ({
              recordId: null,
              sobject,
              toolingApi: api.toolingApi,
              // TO-DO: merge with the sortRank function in data-export
              relevance: sobject.keyPrefix == queryKeyPrefix ? 2
                : sobject.name.toLowerCase() == query.toLowerCase() ? 3
                : sobject.label.toLowerCase() == query.toLowerCase() ? 4
                : sobject.name.toLowerCase().startsWith(query.toLowerCase()) ? 5
                : sobject.label.toLowerCase().startsWith(query.toLowerCase()) ? 6
                : sobject.name.toLowerCase().includes("__" + query.toLowerCase()) ? 7
                : sobject.name.toLowerCase().includes("_" + query.toLowerCase()) ? 8
                : sobject.label.toLowerCase().includes(" " + query.toLowerCase()) ? 9
                : 10
            }))
        );
      }
      query = query || this.props.contextRecordId || "";
      queryKeyPrefix = query.substring(0, 3);
      for (let api of this.props.sobjectsLists) {
        let objectForId = api.sobjects.find(sobject => sobject.keyPrefix == queryKeyPrefix);
        if (objectForId && query.length >= 15) {
          res.unshift({recordId: query, sobject: objectForId, toolingApi: api.toolingApi, relevance: 1});
        }
      }
      res.sort((a, b)  => a.relevance - b.relevance || a.sobject.name.localeCompare(b.sobject.name));
      return res;
    }
    onDataSelect(value) {
      this.setState({selectedValue: value});
    }
    clickAllDataBtn() {
      this.refs.showAllDataBtn.click();
    }
    getAllDataUrl() {
      if (this.state.selectedValue) {
        let args = new URLSearchParams();
        args.set("host", sfHost);
        // We could instead pass the record ID or sobject name in the "q" parameter,
        // and let inspect.html find the relevant objectType+useToolingApi+recordUrl.
        // We don't do that to save time making global describe calls, since we already know the global describe results here.
        args.set("objectType", this.state.selectedValue.sobject.name);
        if (this.state.selectedValue.toolingApi) {
          args.set("useToolingApi", "1");
        }
        if (this.state.selectedValue.recordId) {
          args.set("recordUrl", this.state.selectedValue.sobject.urls.rowTemplate.replace("{ID}", this.state.selectedValue.recordId));
        } else {
          args.set("recordUrl", "");
        }
        return "inspect.html?" + args;
      } else {
        return undefined;
      }
    }
    render() {
      return (
        React.createElement("div", {className: "all-data-box " + (this.props.sobjectsLoading ? "loading " : "")},
          React.createElement(AllDataSearch, {onDataSelect: this.onDataSelect, sobjectsLists: this.props.sobjectsLists, getMatches: this.getMatches}),
          this.state.selectedValue ? React.createElement("div", {className: "all-data-box-inner"},
            React.createElement("div", {title: "Record ID", className: "data-element"}, this.state.selectedValue.recordId),
            this.state.selectedValue.toolingApi ? React.createElement("div", {title: "API", className: "data-element"}, "Tooling API") : null,
            React.createElement("div", {title: "API name", className: "data-element"}, this.state.selectedValue.sobject.name),
            React.createElement("div", {title: "Label", className: "data-element"}, this.state.selectedValue.sobject.label),
            React.createElement("div", {title: "ID key prefix", className: "data-element"}, this.state.selectedValue.sobject.keyPrefix),
            React.createElement("a", {ref: "showAllDataBtn", href: this.getAllDataUrl(), target: this.props.isDevConsole ? "_blank" : "_top", className: "base-button"}, "Show ", React.createElement("u", {}, "a"), "ll data")
          ) : null
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
                  key: value.recordId + "#" + value.sobject.name + "#" + value.toolingApi,
                  value,
                  element: [
                    React.createElement("div", {className: "autocomplete-item-main", key: "main"},
                      value.recordId || React.createElement(MarkSubstring, {
                        text: value.sobject.name,
                        start: value.sobject.name.toLowerCase().indexOf(this.state.inspectQuery.toLowerCase()),
                        length: this.state.inspectQuery.length
                      }),
                      value.toolingApi ? " (Tooling API)" : null
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
        selectedIndex: 0,
        resultsMouseIsDown: false
      };
      this.onResultsMouseDown = this.onResultsMouseDown.bind(this);
      this.onResultsMouseUp = this.onResultsMouseUp.bind(this);
      this.onResultClick = this.onResultClick.bind(this);
      this.onResultMouseEnter = this.onResultMouseEnter.bind(this);
    }
    handleInput() {
      this.setState({showResults: true, selectedIndex: 0});
    }
    handleFocus() {
      this.setState({showResults: true, selectedIndex: 0});
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
          this.setState({showResults: true, selectedIndex: 0});
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
        this.setState({selectedIndex: index});
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
      this.setState({selectedIndex: index});
    }
   componentDidUpdate(prevProps, prevState) {
      let sel = this.refs.selectedItem;
      if (this.state.selectedIndex != prevState.selectedIndex && sel && sel.offsetParent) {
        if (sel.offsetTop < sel.offsetParent.scrollTop) {
          sel.scrollIntoView(true);
        } else if (sel.offsetTop + sel.offsetHeight > sel.offsetParent.scrollTop + sel.offsetParent.offsetHeight) {
          sel.scrollIntoView(false);
        }
      }
    }
    render() {
      return (
        React.createElement("div", {className: "autocomplete-container", style: {display: (this.state.showResults && this.props.matchingResults.length > 0) || this.state.resultsMouseIsDown ? "" : "none"}, onMouseDown: this.onResultsMouseDown, onMouseUp: this.onResultsMouseUp},
          React.createElement("div", {className: "autocomplete"}, this.props.matchingResults.map(({key, value, element}, index) => 
            React.createElement("a", {
              key,
              ref: this.state.selectedIndex == index ? "selectedItem" : null,
              className: "autocomplete-item " + (this.state.selectedIndex == index ? "selected" : ""),
              onClick: e => this.onResultClick(value),
              onMouseEnter: e => this.onResultMouseEnter(index)
            }, element)
          ))
        )
      );
    }
  }
  ReactDOM.render(React.createElement(app, {
    isDevConsole: params.isDevConsole,
    inAura: params.inAura,
    inInspector: params.inInspector,
  }), document.getElementById("root"));
}
