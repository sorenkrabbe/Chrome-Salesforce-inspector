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

  function makeAllDataUrl(recordId) {
    if (recordId) {
      let args = new URLSearchParams();
      args.set("host", sfHost);
      args.set("q", recordId);
      return "inspect.html?" + args;
    } else {
      return undefined;
    }
  }
  let hostArg = new URLSearchParams();
  hostArg.set("host", sfHost);
  let addonVersion = chrome.runtime.getManifest().version;

  let app = React.createClass({
    getInitialState() {
      return {
        detailsShown: false,
        detailsLoading: false,
        recordId: null
      };
    },
    onUpdateRecordId(e) {
      if (e.source == parent && e.data.insextUpdateRecordId) {
        this.setState({recordId: e.data.recordId});
      }
    },
    onShortcutKey(e) {
      if (e.key == "m") {
        e.preventDefault();
        this.onDetailsClick();
      }
      if (e.key == "a") {
        e.preventDefault();
        this.refs.showAllDataBtn.click();
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
    },
    onDetailsClick() {
      let self = this;
      if (this.state.detailsShown || !this.state.recordId) {
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
    },
    componentDidMount() {
      addEventListener("message", this.onUpdateRecordId);
      addEventListener("keydown", this.onShortcutKey);
    },
    componentWillUnmount() {
      removeEventListener("message", this.onUpdateRecordId);
      removeEventListener("keydown", this.onShortcutKey);
    },
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
            React.createElement("div", {id: "thispage", style: {display: this.props.isDevConsole || this.props.inInspector ? "none" : ""}},
              React.createElement("button", {id: "showStdPageDetailsBtn", className: "button" + (this.state.detailsLoading ? " loading" : ""), disabled: this.props.inAura || this.state.detailsShown || !this.state.recordId, onClick: this.onDetailsClick}, "Show field ", React.createElement("u", {}, "m"), "etadata"),
              React.createElement("a", {ref: "showAllDataBtn", target: this.props.isDevConsole ? "_blank" : "_top", className: "button", href: makeAllDataUrl(this.state.recordId)}, "Show ", React.createElement("u", {}, "a"), "ll data")
            ),
            React.createElement(AllDataSearch, {isDevConsole: this.props.isDevConsole}),
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
  });
  let AllDataSearch = React.createClass({
    getInitialState() {
      return {
        sobjects: null,
        sobjectsLoading: false,
        inspectQuery: ""
      };
    },
    onAllDataInput(e) {
      let val = e.target.value;
      this.refs.autoComplete.handleInput();
      this.setState({inspectQuery: val});
    },
    onAllDataFocus() {
      this.refs.autoComplete.handleFocus();
      if (this.state.sobjects == null && !this.state.sobjectsLoading) {
        this.loadSobjects();
      }
    },
    onAllDataBlur() {
      this.refs.autoComplete.handleBlur();
    },
    onAllDataKeyDown(e) {
      this.refs.autoComplete.handleKeyDown(e);
      if(e.key == "Enter" && !e.defaultPrevented) {
        e.preventDefault();
        this.refs.allDataForBtn.click();
      }
      e.stopPropagation(); // Stop our keyboard shortcut handler
    },
    updateAllDataInput(value) {
      this.setState({inspectQuery: value});
      this.refs.showAllDataInp.focus();
    },
    onAllDataArrowClick() {
      this.refs.showAllDataInp.focus();
    },
    loadSobjects() {
      this.setState({sobjectsLoading: true});
      new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({message: "getSession", sfHost}, message => {
          session = message;
          resolve();
        });
      })
      .then(() => {
        return askSalesforce("/services/data/v" + apiVersion + "/sobjects/");
      })
      .then(res => {
        this.setState({sobjectsLoading: false, sobjects: res.sobjects});
      })
      .catch(() => {
        this.setState({sobjectsLoading: false, sobjects: null});
      });
    },
    render() {
      return (
        React.createElement("div", {className: "input-with-button"},
          React.createElement("div", {className: "input-with-dropdown"},
            React.createElement("div", {},
              React.createElement("input", {
                id: "showAllDataInp",
                ref: "showAllDataInp",
                placeholder: "Record ID, ID prefix or sObject name",
                onInput: this.onAllDataInput,
                onFocus: this.onAllDataFocus,
                onBlur: this.onAllDataBlur,
                className: this.state.sobjectsLoading ? "loading" : "",
                onKeyDown: this.onAllDataKeyDown,
                value: this.state.inspectQuery
              }),
              React.createElement(Autocomplete, {
                ref: "autoComplete",
                updateInput: this.updateAllDataInput,
                matchingResults: (this.state.sobjects || [])
                  .filter(sobject => sobject.name.toLowerCase().includes(this.state.inspectQuery.toLowerCase()) || sobject.label.toLowerCase().includes(this.state.inspectQuery.toLowerCase()) || sobject.keyPrefix == this.state.inspectQuery.substring(0, 3))
                  .map(sobject => ({
                    value: sobject.name,
                    element: [
                      React.createElement("div", {className: "autocomplete-item-main", key: "main"},
                        React.createElement(MarkSubstring, {
                          text: sobject.name,
                          start: sobject.name.toLowerCase().indexOf(this.state.inspectQuery.toLowerCase()),
                          length: this.state.inspectQuery.length
                        })
                      ),
                      React.createElement("div", {className: "autocomplete-item-sub", key: "sub"},
                        React.createElement(MarkSubstring, {
                          text: sobject.keyPrefix || "---",
                          start: sobject.keyPrefix == this.state.inspectQuery.substring(0, 3) ? 0 : -1,
                          length: 3
                        }),
                        " • ",
                        React.createElement(MarkSubstring, {
                          text: sobject.label,
                          start: sobject.label.toLowerCase().indexOf(this.state.inspectQuery.toLowerCase()),
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
          ),
          React.createElement("a", {id: "showAllDataForBtn", href:makeAllDataUrl(this.state.inspectQuery), target: this.props.isDevConsole ? "_blank" : "_top", className: "button", ref: "allDataForBtn"}, "Go")
        )
      );
    }
  });
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
  let Autocomplete = React.createClass({
    getInitialState() {
      return {
        showResults: false,
        selectedIndex: -1,
        resultsMouseIsDown: false
      };
    },
    handleInput() {
      this.setState({showResults: true, selectedIndex: -1});
    },
    handleFocus() {
      this.setState({showResults: true, selectedIndex: -1});
    },
    handleBlur() {
      this.setState({showResults: false});
    },
    handleKeyDown(e) {
      if (e.key == "Enter") {
        if (this.state.selectedIndex >= 0) {
          e.preventDefault();
          let {value} = this.props.matchingResults[this.state.selectedIndex];
          this.props.updateInput(value);
          this.setState({showResults: false, selectedIndex: -1});
        }
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
        let index = this.state.selectedIndex + selectionMove;
        let length = this.props.matchingResults.length;
        if (index < -1) {
          index = length - 1;
        }
        if (index >= length) {
          index = -1;
        }
        this.setState({selectedIndex: index});
      }
    },
    onResultsMouseDown() {
      this.setState({resultsMouseIsDown: true});
    },
    onResultsMouseUp() {
      this.setState({resultsMouseIsDown: false});
    },
    onResultClick(value) {
      this.props.updateInput(value);
      this.setState({showResults: false, selectedIndex: -1});
    },
    onResultMouseEnter(index) {
      this.setState({selectedIndex: index});
    },
   componentDidUpdate(prevProps, prevState) {
      if (this.state.selectedIndex != prevState.selectedIndex && this.refs.selectedItem) {
        let sel = this.refs.selectedItem;
        if (sel.offsetTop < sel.offsetParent.scrollTop) {
          this.refs.selectedItem.scrollIntoView(true);
        } else if (sel.offsetTop + sel.offsetHeight > sel.offsetParent.scrollTop + sel.offsetParent.offsetHeight) {
          this.refs.selectedItem.scrollIntoView(false);
        }
      }
    },
    render() {
      return (
        React.createElement("div", {className: "autocomplete-container", style: {display: (this.state.showResults && this.props.matchingResults.length > 0) || this.state.resultsMouseIsDown ? "" : "none"}, onMouseDown: this.onResultsMouseDown, onMouseUp: this.onResultsMouseUp},
          React.createElement("div", {className: "autocomplete"}, this.props.matchingResults.map(({value, element}, index) => 
            React.createElement("a", {
              key: value,
              ref: this.state.selectedIndex == index ? "selectedItem" : null,
              className: "autocomplete-item " + (this.state.selectedIndex == index ? "selected" : ""),
              onClick: e => this.onResultClick(value),
              onMouseEnter: e => this.onResultMouseEnter(index)
            }, element)
          ))
        )
      );
    }
  });
  ReactDOM.render(React.createElement(app, {
    isDevConsole: params.isDevConsole,
    inAura: params.inAura,
    inInspector: params.inInspector,
  }), document.getElementById("root"));
}
