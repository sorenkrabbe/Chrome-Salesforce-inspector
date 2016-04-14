"use strict";
if (!this.isUnitTest) {

let args = new URLSearchParams(location.search.slice(1));
sfHost = args.get("host");
initButton(true);
chrome.runtime.sendMessage({message: "getSession", sfHost}, function(message) {
  session = message;

  let queryInput = document.querySelector("#query");

  let queryInputVm = {
    setValue(v) { queryInput.value = v; },
    getValue() { return queryInput.value; },
    getSelStart() { return queryInput.selectionStart; },
    getSelEnd() { return queryInput.selectionEnd; },
    insertText(text, selStart, selEnd) {
      queryInput.focus();
      queryInput.setRangeText(text, selStart, selEnd, "end");
    }
  };

  let queryHistoryStorage = {
    get() { return localStorage.insextQueryHistory; },
    set(v) { localStorage.insextQueryHistory = v; },
    clear() { localStorage.removeItem("insextQueryHistory"); }
  };

  let vm = dataExportVm(args, queryInputVm, queryHistoryStorage, copyToClipboard);
  ko.applyBindings(vm, document.documentElement);

  function queryAutocompleteEvent() {
    vm.queryAutocompleteHandler();
  }
  queryInput.addEventListener("input", queryAutocompleteEvent);
  queryInput.addEventListener("select", queryAutocompleteEvent);
  // There is no event for when caret is moved without any selection or value change, so use keyup and mouseup for that.
  queryInput.addEventListener("keyup", queryAutocompleteEvent);
  queryInput.addEventListener("mouseup", queryAutocompleteEvent);

  // We do not want to perform Salesforce API calls for autocomplete on every keystroke, so we only perform these when the user pressed Ctrl+Space
  // Chrome on Linux does not fire keypress when the Ctrl key is down, so we listen for keydown. Might be https://code.google.com/p/chromium/issues/detail?id=13891#c50
  queryInput.addEventListener("keydown", function(e) {
    if (e.which == 32 /* space */ && e.ctrlKey) {
      e.preventDefault();
      vm.queryAutocompleteHandler({ctrlSpace: true});
    }
  });

  initScrollTable(
    document.querySelector("#result-table"),
    ko.computed(() => vm.exportResult().exportedData),
    ko.computed(() => vm.resultBoxOffsetTop() + "-" + vm.winInnerHeight() + "-" + vm.winInnerWidth())
  );

  let resultBox = document.querySelector("#result-box");
  function recalculateHeight() {
    vm.resultBoxOffsetTop(resultBox.offsetTop);
  }
  if (!window.webkitURL) {
    // Firefox
    // Firefox does not fire a resize event. The next best thing is to listen to when the browser changes the style.height attribute.
    new MutationObserver(recalculateHeight).observe(queryInput, {attributes: true});
  } else {
    // Chrome
    // Chrome does not fire a resize event and does not allow us to get notified when the browser changes the style.height attribute.
    // Instead we listen to a few events which are often fired at the same time.
    // This is not required in Firefox, and Mozilla reviewers don't like it for performance reasons, so we only do this in Chrome via browser detection.
    queryInput.addEventListener("mousemove", recalculateHeight);
    addEventListener("mouseup", recalculateHeight);
  }
  vm.showHelp.subscribe(recalculateHeight);
  vm.autocompleteResults.subscribe(recalculateHeight);
  vm.expandAutocomplete.subscribe(recalculateHeight);
  function resize() {
    vm.winInnerHeight(innerHeight);
    vm.winInnerWidth(innerWidth);
    recalculateHeight(); // a resize event is fired when the window is opened after resultBox.offsetTop has been initialized, so initializes vm.resultBoxOffsetTop
  }
  addEventListener("resize", resize);
  resize();

});

}

function dataExportVm(args, queryInput, queryHistoryStorage, copyToClipboard) {

  let vm = {
    sfLink: "https://" + sfHost,
    spinnerCount: ko.observable(0),
    showHelp: ko.observable(false),
    userInfo: ko.observable("..."),
    winInnerHeight: ko.observable(0),
    winInnerWidth: ko.observable({}),
    resultBoxOffsetTop: ko.observable(0),
    queryAll: ko.observable(false),
    queryTooling: ko.observable(false),
    autocompleteResults: ko.observable({sobjectName: "", title: "\u00A0", results: []}),
    autocompleteClick: null,
    exportResult: ko.observable({isWorking: false, exportStatus: "Ready", exportError: null, exportedData: null}),
    queryHistory: ko.observable(getQueryHistory()),
    selectedHistoryEntry: ko.observable(),
    expandAutocomplete: ko.observable(false),
    resultsFilter: ko.observable(""),
    toggleHelp() {
      vm.showHelp(!vm.showHelp());
    },
    toggleExpand() {
      vm.expandAutocomplete(!vm.expandAutocomplete());
    },
    showDescribeUrl() {
      let args = new URLSearchParams();
      args.set("host", sfHost);
      args.set("objectType", vm.autocompleteResults().sobjectName);
      if (vm.queryTooling()) {
        args.set("useToolingApi", "1");
      }
      args.set("recordUrl", "");
      return "inspect.html?" + args;
    },
    selectHistoryEntry() {
      if (vm.selectedHistoryEntry() != undefined) {
        queryInput.setValue(vm.selectedHistoryEntry());
        vm.selectedHistoryEntry(undefined);
      }
    },
    clearHistory() {
      clearQueryHistory();
      vm.queryHistory([]);
    },
    queryAutocompleteHandler: queryAutocompleteHandler,
    doExport: doExport,
    canCopy() {
      return vm.exportResult().exportedData != null;
    },
    copyAsExcel() {
      copyToClipboard(vm.exportResult().exportedData.csvSerialize("\t"));
    },
    copyAsCsv() {
      copyToClipboard(vm.exportResult().exportedData.csvSerialize(","));
    },
    copyAsJson() {
      copyToClipboard(JSON.stringify(vm.exportResult().exportedData.records, null, "  "));
    },
    stopExport: stopExport
  };

  function spinFor(promise) {
    vm.spinnerCount(vm.spinnerCount() + 1);
    promise.catch(e => console.error("spinFor", e)).then(stopSpinner, stopSpinner);
  }
  function stopSpinner() {
    vm.spinnerCount(vm.spinnerCount() - 1);
  }

  let describeInfo = new DescribeInfo(spinFor);
  describeInfo.dataUpdate.subscribe(() => queryAutocompleteHandler({newDescribe: true}));

  spinFor(askSalesforceSoap("/services/Soap/u/" + apiVersion, "urn:partner.soap.sforce.com", "<getUserInfo/>").then(function(res) {
    vm.userInfo(res.querySelector("Body userFullName").textContent + " / " + res.querySelector("Body userName").textContent + " / " + res.querySelector("Body organizationName").textContent);
  }));

  queryInput.setValue(args.get("query") || vm.queryHistory()[0] || "select Id from Account");

  /**
   * SOQL query autocomplete handling.
   * Put caret at the end of a word or select some text to autocomplete it.
   * Searches for both label and API name.
   * Autocompletes sobject names after the "from" keyword.
   * Autocompletes field names, if the "from" keyword exists followed by a valid object name.
   * Supports relationship fields.
   * Autocompletes field values (picklist values, date constants, boolean values).
   * Autocompletes any textual field value by performing a Salesforce API query when Ctrl+Space is pressed.
   * Inserts all autocomplete field suggestions when Ctrl+Space is pressed.
   * Supports subqueries in where clauses, but not in select clauses.
   */
  let autocompleteState = "";
  let autocompleteProgress = {};
  function queryAutocompleteHandler(e) {
    let useToolingApi = vm.queryTooling();
    let query = queryInput.getValue();
    let selStart = queryInput.getSelStart();
    let selEnd = queryInput.getSelEnd();
    let ctrlSpace = e && e.ctrlSpace;

    // Skip the calculation when no change is made. This improves performance and prevents async operations (Ctrl+Space) from being canceled when they should not be.
    let newAutocompleteState = [useToolingApi, query, selStart, selEnd].join("$");
    if (newAutocompleteState == autocompleteState && !ctrlSpace && !(e && e.newDescribe)) {
      return;
    }
    autocompleteState = newAutocompleteState;

    // Cancel any async operation since its results will no longer be relevant.
    if (autocompleteProgress.abort) {
      autocompleteProgress.abort();
    }

    vm.autocompleteClick = function(item) {
      queryInput.insertText(item.value + item.suffix, selStart, selEnd);
      queryAutocompleteHandler();
    };

    // Find the token we want to autocomplete. This is the selected text, or the last word before the cursor.
    let searchTerm = selStart != selEnd
      ? query.substring(selStart, selEnd)
      : query.substring(0, selStart).match(/[a-zA-Z0-9_]*$/)[0];
    selStart = selEnd - searchTerm.length;

    function sortRank(e) {
      let i = 0;
      if (e.value.toLowerCase() == searchTerm.toLowerCase()) {
        return i;
      }
      i++;
      if (e.title.toLowerCase() == searchTerm.toLowerCase()) {
        return i;
      }
      i++;
      if (e.value.toLowerCase().startsWith(searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (e.title.toLowerCase().startsWith(searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (e.value.toLowerCase().includes("__" + searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (e.value.toLowerCase().includes("_" + searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (e.title.toLowerCase().includes(" " + searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      return i;
    }
    function resultsSort(a, b) {
      return sortRank(a) - sortRank(b) || a.rank - b.rank || a.value.localeCompare(b.value);
    }

    // If we are just after the "from" keyword, autocomplete the sobject name
    if (query.substring(0, selStart).match(/(^|\s)from\s*$/)) {
      vm.autocompleteResults({
        sobjectName: "",
        title: "Objects:",
        results: new Enumerable(describeInfo.describeGlobal(useToolingApi))
          .filter(sobjectDescribe => sobjectDescribe.name.toLowerCase().includes(searchTerm.toLowerCase()) || sobjectDescribe.label.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(sobjectDescribe => ({value: sobjectDescribe.name, title: sobjectDescribe.label, suffix: " ", rank: 1}))
          .toArray()
          .sort(resultsSort)
      });
      return;
    }

    let sobjectName, isAfterFrom;
    // Find out what sobject we are querying, by using the word after the "from" keyword.
    // Assuming no subqueries in the select clause, we should find the correct sobjectName. There should be only one "from" keyword, and strings (which may contain the word "from") are only allowed after the real "from" keyword.
    let fromKeywordMatch = /(^|\s)from\s+([a-z0-9_]*)/i.exec(query);
    if (fromKeywordMatch) {
      sobjectName = fromKeywordMatch[2];
      isAfterFrom = selStart > fromKeywordMatch.index + 1;
    } else {
      // We still want to find the from keyword if the user is typing just before the keyword, and there is no space.
      fromKeywordMatch = /^from\s+([a-z0-9_]*)/i.exec(query.substring(selEnd));
      if (fromKeywordMatch) {
        sobjectName = fromKeywordMatch[1];
        isAfterFrom = false;
      } else {
        vm.autocompleteResults({
          sobjectName: "",
          title: "\"from\" keyword not found",
          results: []
        });
        return;
      }
    }
    // If we are in a subquery, try to detect that.
    fromKeywordMatch = /\(\s*select.*\sfrom\s+([a-z0-9_]*)/i.exec(query);
    if (fromKeywordMatch && fromKeywordMatch.index < selStart) {
      let subQuery = query.substring(fromKeywordMatch.index, selStart);
      // Try to detect if the subquery ends before the selection
      if (subQuery.split(")").length < subQuery.split("(").length) {
        sobjectName = fromKeywordMatch[1];
        isAfterFrom = selStart > fromKeywordMatch.index + fromKeywordMatch[0].length;
      }
    }
    let describeSobject = describeInfo.describeSobject(useToolingApi, sobjectName);
    let sobjectDescribe = describeSobject.sobjectDescribe;

    if (!describeSobject.sobjectFound) {
      vm.autocompleteResults({
        sobjectName: sobjectName,
        title: "Unknown object: " + sobjectName,
        results: []
      });
      return;
    }
    if (!sobjectDescribe) {
      vm.autocompleteResults({
        sobjectName: sobjectName,
        title: "Loading metadata for object: " + sobjectName,
        results: []
      });
      return;
    }

    /*
     * The context of a field is used to support queries on relationship fields.
     *
     * For example: If the cursor is at the end of the query "select Id from Contact where Account.Owner.Usern"
     * then the the searchTerm we want to autocomplete is "Usern", the contextPath is "Account.Owner." and the sobjectName is "Contact"
     *
     * When autocompleting field values in the query "select Id from Contact where Account.Type = 'Cus"
     * then the searchTerm we want to autocomplete is "Cus", the fieldName is "Type", the contextPath is "Account." and the sobjectName is "Contact"
     */

    let contextEnd = selStart;

    // If we are on the right hand side of a comparison operator, autocomplete field values
    let isFieldValue = query.substring(0, selStart).match(/\s*[<>=!]+\s*('?[^'\s]*)$/);
    let fieldName = null;
    if (isFieldValue) {
      let fieldEnd = selStart - isFieldValue[0].length;
      fieldName = query.substring(0, fieldEnd).match(/[a-zA-Z0-9_]*$/)[0];
      contextEnd = fieldEnd - fieldName.length;
      selStart -= isFieldValue[1].length;
    }

    /*
    contextSobjectDescribes is a set of describe results for the relevant context sobjects.
    Example: "select Subject, Who.Name from Task"
    The context sobjects for "Subject" is {"Task"}.
    The context sobjects for "Who" is {"Task"}.
    The context sobjects for "Name" is {"Contact", "Lead"}.
    */
    let contextSobjectDescribes = new Enumerable([sobjectDescribe]);
    let contextPath = query.substring(0, contextEnd).match(/[a-zA-Z0-9_\.]*$/)[0];
    let isLoading = false;
    if (contextPath) {
      let contextFields = contextPath.split(".");
      contextFields.pop(); // always empty
      for (let referenceFieldName of contextFields) {
        let newContextSobjectDescribes = new Set();
        for (let referencedSobjectName of contextSobjectDescribes
          .flatMap(contextSobjectDescribe => contextSobjectDescribe.fields)
          .filter(field => field.relationshipName && field.relationshipName.toLowerCase() == referenceFieldName.toLowerCase())
          .flatMap(field => field.referenceTo))
        {
          let describeReferencedSobject = describeInfo.describeSobject(useToolingApi, referencedSobjectName);
          if (describeReferencedSobject.sobjectFound) {
            if (describeReferencedSobject.sobjectDescribe) {
              newContextSobjectDescribes.add(describeReferencedSobject.sobjectDescribe);
            } else {
              isLoading = true;
            }
          }
        }
        contextSobjectDescribes = new Enumerable(newContextSobjectDescribes);
      }
    }

    if (!contextSobjectDescribes.some()) {
      vm.autocompleteResults({
        sobjectName: sobjectName,
        title: isLoading ? "Loading metadata..." : "Unknown field: " + sobjectName + "." + contextPath,
        results: []
      });
      return;
    }

    if (isFieldValue) {
      // Autocomplete field values
      let contextValueFields = contextSobjectDescribes
        .flatMap(sobjectDescribe => sobjectDescribe.fields
          .filter(field => field.name.toLowerCase() == fieldName.toLowerCase())
          .map(field => ({sobjectDescribe: sobjectDescribe, field: field}))
        )
        .toArray();
      if (contextValueFields.length == 0) {
        vm.autocompleteResults({
          sobjectName: sobjectName,
          title: "Unknown field: " + sobjectDescribe.name + "." + contextPath + fieldName,
          results: []
        });
        return;
      }
      let fieldNames = contextValueFields.map(contextValueField => contextValueField.sobjectDescribe.name + "." + contextValueField.field.name).join(", ");
      if (ctrlSpace) {
        // Since this performs a Salesforce API call, we ask the user to opt in by pressing Ctrl+Space
        if (contextValueFields.length > 1) {
          vm.autocompleteResults({
            sobjectName: sobjectName,
            title: "Multiple possible fields: " + fieldNames,
            results: []
          });
          return;
        }
        let contextValueField = contextValueFields[0];
        let queryMethod = useToolingApi ? "tooling/query" : vm.queryAll() ? "queryAll" : "query";
        let acQuery = "select " + contextValueField.field.name + " from " + contextValueField.sobjectDescribe.name + " where " + contextValueField.field.name + " like '%" + searchTerm.replace(/'/g, "\\'") + "%' group by " + contextValueField.field.name + " limit 100";
        spinFor(askSalesforce("/services/data/v" + apiVersion + "/" + queryMethod + "/?q=" + encodeURIComponent(acQuery), autocompleteProgress)
          .catch(function(err) {
            vm.autocompleteResults({
              sobjectName: sobjectName,
              title: "Error: " + ((err && err.askSalesforceError) || err),
              results: []
            });
            return null;
          })
          .then(function queryHandler(data) {
            autocompleteProgress = {};
            if (!data) {
              return;
            }
            vm.autocompleteResults({
              sobjectName: sobjectName,
              title: fieldNames + " values:",
              results: new Enumerable(data.records)
                .map(record => record[contextValueField.field.name])
                .filter(value => value)
                .map(value => ({value: "'" + value + "'", title: value, suffix: " ", rank: 1}))
                .toArray()
                .sort(resultsSort)
            });
          }));
        vm.autocompleteResults({
          sobjectName: sobjectName,
          title: "Loading " + fieldNames + " values...",
          results: []
        });
        return;
      }
      var ar = new Enumerable(contextValueFields).flatMap(function*(contextValueField) {
        let field = contextValueField.field;
        yield* field.picklistValues.map(pickVal => ({value: "'" + pickVal.value + "'", title: pickVal.label, suffix: " ", rank: 1}));
        if (field.type == "boolean") {
          yield {value: "true", title: "true", suffix: " ", rank: 1};
          yield {value: "false", title: "false", suffix: " ", rank: 1};
        }
        if (field.type == "date" || field.type == "datetime") {
          let pad = (n, d) => ("000" + n).slice(-d);
          let d = new Date();
          if (field.type == "date") {
            yield {value: pad(d.getFullYear(), 4) + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2), title: "Today", suffix: " ", rank: 1};
          }
          if (field.type == "datetime") {
            yield {value: pad(d.getFullYear(), 4) + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2) + "T"
              + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2) + "." + pad(d.getMilliseconds(), 3)
              + (d.getTimezoneOffset() <= 0 ? "+" : "-") + pad(Math.floor(Math.abs(d.getTimezoneOffset()) / 60), 2)
              + ":" + pad(Math.abs(d.getTimezoneOffset()) % 60, 2), title: "Now", suffix: " ", rank: 1};
          }
          // from http://www.salesforce.com/us/developer/docs/soql_sosl/Content/sforce_api_calls_soql_select_dateformats.htm Spring 15
          yield {value: "YESTERDAY", title: "Starts 12:00:00 the day before and continues for 24 hours.", suffix: " ", rank: 1};
          yield {value: "TODAY", title: "Starts 12:00:00 of the current day and continues for 24 hours.", suffix: " ", rank: 1};
          yield {value: "TOMORROW", title: "Starts 12:00:00 after the current day and continues for 24 hours.", suffix: " ", rank: 1};
          yield {value: "LAST_WEEK", title: "Starts 12:00:00 on the first day of the week before the most recent first day of the week and continues for seven full days. First day of the week is determined by your locale.", suffix: " ", rank: 1};
          yield {value: "THIS_WEEK", title: "Starts 12:00:00 on the most recent first day of the week before the current day and continues for seven full days. First day of the week is determined by your locale.", suffix: " ", rank: 1};
          yield {value: "NEXT_WEEK", title: "Starts 12:00:00 on the most recent first day of the week after the current day and continues for seven full days. First day of the week is determined by your locale.", suffix: " ", rank: 1};
          yield {value: "LAST_MONTH", title: "Starts 12:00:00 on the first day of the month before the current day and continues for all the days of that month.", suffix: " ", rank: 1};
          yield {value: "THIS_MONTH", title: "Starts 12:00:00 on the first day of the month that the current day is in and continues for all the days of that month.", suffix: " ", rank: 1};
          yield {value: "NEXT_MONTH", title: "Starts 12:00:00 on the first day of the month after the month that the current day is in and continues for all the days of that month.", suffix: " ", rank: 1};
          yield {value: "LAST_90_DAYS", title: "Starts 12:00:00 of the current day and continues for the last 90 days.", suffix: " ", rank: 1};
          yield {value: "NEXT_90_DAYS", title: "Starts 12:00:00 of the current day and continues for the next 90 days.", suffix: " ", rank: 1};
          yield {value: "LAST_N_DAYS:n", title: "For the number n provided, starts 12:00:00 of the current day and continues for the last n days.", suffix: " ", rank: 1};
          yield {value: "NEXT_N_DAYS:n", title: "For the number n provided, starts 12:00:00 of the current day and continues for the next n days.", suffix: " ", rank: 1};
          yield {value: "NEXT_N_WEEKS:n", title: "For the number n provided, starts 12:00:00 of the first day of the next week and continues for the next n weeks.", suffix: " ", rank: 1};
          yield {value: "LAST_N_WEEKS:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous week and continues for the last n weeks.", suffix: " ", rank: 1};
          yield {value: "NEXT_N_MONTHS:n", title: "For the number n provided, starts 12:00:00 of the first day of the next month and continues for the next n months.", suffix: " ", rank: 1};
          yield {value: "LAST_N_MONTHS:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous month and continues for the last n months.", suffix: " ", rank: 1};
          yield {value: "THIS_QUARTER", title: "Starts 12:00:00 of the current quarter and continues to the end of the current quarter.", suffix: " ", rank: 1};
          yield {value: "LAST_QUARTER", title: "Starts 12:00:00 of the previous quarter and continues to the end of that quarter.", suffix: " ", rank: 1};
          yield {value: "NEXT_QUARTER", title: "Starts 12:00:00 of the next quarter and continues to the end of that quarter.", suffix: " ", rank: 1};
          yield {value: "NEXT_N_QUARTERS:n", title: "Starts 12:00:00 of the next quarter and continues to the end of the nth quarter.", suffix: " ", rank: 1};
          yield {value: "LAST_N_QUARTERS:n", title: "Starts 12:00:00 of the previous quarter and continues to the end of the previous nth quarter.", suffix: " ", rank: 1};
          yield {value: "THIS_YEAR", title: "Starts 12:00:00 on January 1 of the current year and continues through the end of December 31 of the current year.", suffix: " ", rank: 1};
          yield {value: "LAST_YEAR", title: "Starts 12:00:00 on January 1 of the previous year and continues through the end of December 31 of that year.", suffix: " ", rank: 1};
          yield {value: "NEXT_YEAR", title: "Starts 12:00:00 on January 1 of the following year and continues through the end of December 31 of that year.", suffix: " ", rank: 1};
          yield {value: "NEXT_N_YEARS:n", title: "Starts 12:00:00 on January 1 of the following year and continues through the end of December 31 of the nth year.", suffix: " ", rank: 1};
          yield {value: "LAST_N_YEARS:n", title: "Starts 12:00:00 on January 1 of the previous year and continues through the end of December 31 of the previous nth year.", suffix: " ", rank: 1};
          yield {value: "THIS_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the current fiscal quarter and continues through the end of the last day of the fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1};
          yield {value: "LAST_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the last fiscal quarter and continues through the end of the last day of that fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1};
          yield {value: "NEXT_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the next fiscal quarter and continues through the end of the last day of that fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1};
          yield {value: "NEXT_N_FISCAL_QUARTERS:n", title: "Starts 12:00:00 on the first day of the next fiscal quarter and continues through the end of the last day of the nth fiscal quarter. The fiscal year is defined in the company profile under Setup atCompany Profile | Fiscal Year.", suffix: " ", rank: 1};
          yield {value: "LAST_N_FISCAL_QUARTERS:n", title: "Starts 12:00:00 on the first day of the last fiscal quarter and continues through the end of the last day of the previous nth fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1};
          yield {value: "THIS_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the current fiscal year and continues through the end of the last day of the fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1};
          yield {value: "LAST_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the last fiscal year and continues through the end of the last day of that fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1};
          yield {value: "NEXT_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the next fiscal year and continues through the end of the last day of that fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1};
          yield {value: "NEXT_N_FISCAL_YEARS:n", title: "Starts 12:00:00 on the first day of the next fiscal year and continues through the end of the last day of the nth fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1};
          yield {value: "LAST_N_FISCAL_YEARS:n", title: "Starts 12:00:00 on the first day of the last fiscal year and continues through the end of the last day of the previous nth fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1};
        }
        if (field.nillable) {
          yield {value: "null", title: "null", suffix: " ", rank: 1};
        }
      })
      .filter(res => res.value.toLowerCase().includes(searchTerm.toLowerCase()) || res.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .toArray()
      .sort(resultsSort);
      vm.autocompleteResults({
        sobjectName: sobjectName,
        title: fieldNames + (ar.length == 0 ? " values (Press Ctrl+Space):" : " values:"),
        results: ar
      });
      return;
    } else {
      // Autocomplete field names and functions
      if (ctrlSpace) {
        let ar = contextSobjectDescribes
          .flatMap(sobjectDescribe => sobjectDescribe.fields)
          .filter(field => field.name.toLowerCase().includes(searchTerm.toLowerCase()) || field.label.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(field => contextPath + field.name)
          .toArray();
        if (ar.length > 0) {
          queryInput.insertText(ar.join(", ") + (isAfterFrom ? " " : ", "), selStart - contextPath.length, selEnd);
        }
        queryAutocompleteHandler();
        return;
      }
      vm.autocompleteResults({
        sobjectName: sobjectName,
        title: contextSobjectDescribes.map(sobjectDescribe => sobjectDescribe.name).toArray().join(", ") + " fields:",
        results: contextSobjectDescribes
          .flatMap(sobjectDescribe => sobjectDescribe.fields)
          .filter(field => field.name.toLowerCase().includes(searchTerm.toLowerCase()) || field.label.toLowerCase().includes(searchTerm.toLowerCase()))
          .flatMap(function*(field) {
            yield {value: field.name, title: field.label, suffix: isAfterFrom ? " " : ", ", rank: 1};
            if (field.relationshipName) {
               yield {value: field.relationshipName + ".", title: field.label, suffix: "", rank: 1};
            }
          })
          .concat(
            new Enumerable(["AVG", "COUNT", "COUNT_DISTINCT", "MIN", "MAX", "SUM", "CALENDAR_MONTH", "CALENDAR_QUARTER", "CALENDAR_YEAR", "DAY_IN_MONTH", "DAY_IN_WEEK", "DAY_IN_YEAR", "DAY_ONLY", "FISCAL_MONTH", "FISCAL_QUARTER", "FISCAL_YEAR", "HOUR_IN_DAY", "WEEK_IN_MONTH", "WEEK_IN_YEAR", "convertTimezone"])
              .filter(fn => fn.toLowerCase().startsWith(searchTerm.toLowerCase()))
              .map(fn => ({value: fn, title: fn + "()", suffix: "(", rank: 2}))
          )
          .toArray()
          .sort(resultsSort)
      });
      return;
    }
  }

  function RecordTable() {
    /*
    We don't want to build our own SOQL parser, so we discover the columns based on the data returned.
    This means that we cannot find the columns of cross-object relationships, when the relationship field is null for all returned records.
    We don't care, because we don't need a stable set of columns for our use case.
    */
    let columnIdx = new Map();
    let header = ["_"];
    function discoverColumns(record, prefix, row) {
      for (let field in record) {
        if (field == "attributes") {
          continue;
        }
        let column = prefix + field;
        let c;
        if (columnIdx.has(column)) {
          c = columnIdx.get(column);
        } else {
          c = header.length;
          columnIdx.set(column, c);
          for (let row of rt.table) {
            row.push(undefined);
          }
          header[c] = column;
          rt.colVisibilities.push(true);
        }
        row[c] = record[field];
        if (typeof record[field] == "object" && record[field] != null) {
          discoverColumns(record[field], column + ".", row);
        }
      }
    }
    function cellToString(cell) {
      if (cell == null) {
        return "";
      } else if (typeof cell == "object" && cell.attributes && cell.attributes.type) {
        return "[" + cell.attributes.type + "]";
      } else {
        return "" + cell;
      }
    }
    let isVisible = (row, filter) => !filter || row.some(cell => cellToString(cell).toLowerCase().includes(filter.toLowerCase()));
    let rt = {
      records: [],
      table: [],
      rowVisibilities: [],
      colVisibilities: [true],
      isTooling: false,
      totalSize: -1,
      addToTable(expRecords) {
        rt.records = rt.records.concat(expRecords);
        if (rt.table.length == 0 && expRecords.length > 0) {
          rt.table.push(header);
          rt.rowVisibilities.push(true);
        }
        let filter = vm.resultsFilter();
        for (let record of expRecords) {
          let row = new Array(header.length);
          row[0] = record;
          rt.table.push(row);
          rt.rowVisibilities.push(isVisible(row, filter));
          discoverColumns(record, "", row);
        }
      },
      csvSerialize: separator => rt.table.map(row => row.map(cell => "\"" + cellToString(cell).split("\"").join("\"\"") + "\"").join(separator)).join("\r\n"),
      updateVisibility() {
        let filter = vm.resultsFilter();
        for (let r = 1 /* always show header */; r < rt.table.length; r++) {
          rt.rowVisibilities[r] = isVisible(rt.table[r], filter);
        }
      }
    };
    return rt;
  }

  vm.queryTooling.subscribe(() => queryAutocompleteHandler());

  function getQueryHistory() {
    let queryHistory;
    try {
      queryHistory = JSON.parse(queryHistoryStorage.get());
    } catch(e) {}
    if (!Array.isArray(queryHistory)) {
      queryHistory = [];
    }
    return queryHistory;
  }

  function addToQueryHistory(query) {
    let queryHistory = getQueryHistory();
    let historyIndex = queryHistory.indexOf(query);
    if (historyIndex > -1) {
      queryHistory.splice(historyIndex, 1);
    }
    queryHistory.splice(0, 0, query);
    if (queryHistory.length > 20) {
      queryHistory.pop();
    }
    queryHistoryStorage.set(JSON.stringify(queryHistory));
    return queryHistory;
  }

  function clearQueryHistory() {
    queryHistoryStorage.clear();
  }

  let exportProgress = {};
  function doExport() {
    let exportedData = new RecordTable();
    exportedData.isTooling = vm.queryTooling();
    let query = queryInput.getValue();
    let queryMethod = exportedData.isTooling ? "tooling/query" : vm.queryAll() ? "queryAll" : "query";
    spinFor(askSalesforce("/services/data/v" + apiVersion + "/" + queryMethod + "/?q=" + encodeURIComponent(query), exportProgress).then(function queryHandler(data) {
      exportedData.addToTable(data.records);
      if (data.totalSize != -1) {
        exportedData.totalSize = data.totalSize;
      }
      if (!data.done) {
        let pr = askSalesforce(data.nextRecordsUrl, exportProgress).then(queryHandler);
        vm.exportResult({
          isWorking: true,
          exportStatus: "Exporting... Completed " + exportedData.records.length + " of " + exportedData.totalSize + " record(s).",
          exportError: null,
          exportedData: exportedData
        });
        return pr;
      }
      vm.queryHistory(addToQueryHistory(query));
      if (exportedData.records.length == 0) {
        vm.exportResult({
          isWorking: false,
          exportStatus: data.totalSize > 0 ? "No data exported. " + data.totalSize + " record(s)." : "No data exported.",
          exportError: null,
          exportedData: exportedData
        });
        return null;
      }
      vm.exportResult({
        isWorking: false,
        exportStatus: "Exported " + exportedData.records.length + (exportedData.records.length != exportedData.totalSize ? " of " + exportedData.totalSize : "") + " record(s).",
        exportError: null,
        exportedData: exportedData
      });
      return null;
    }, function(err) {
      if (!err || !err.askSalesforceError) {
        throw err; // not an askSalesforceError
      }
      if (exportedData.totalSize != -1) {
        // We already got some data. Show it, and indicate that not all data was exported
        vm.exportResult({
          isWorking: false,
          exportStatus: "Exported " + exportedData.records.length + " of " + exportedData.totalSize + " record(s). Stopped by error.",
          exportError: null,
          exportedData: exportedData
        });
        return null;
      }
      vm.exportResult({
        isWorking: false,
        exportStatus: "Error",
        exportError: err.askSalesforceError,
        exportedData: null
      });
      return null;
    }).then(null, function(error) {
      console.error(error);
      vm.exportResult({
        isWorking: false,
        exportStatus: "Error",
        exportError: "UNEXPECTED EXCEPTION:" + error,
        exportedData: null
      });
    }));
    vm.resultsFilter("");
    vm.exportResult({
      isWorking: true,
      exportStatus: "Exporting...",
      exportError: null,
      exportedData: exportedData
    });
  }

  function stopExport() {
    exportProgress.abort({records: [], done: true, totalSize: -1});
  }

  vm.resultsFilter.subscribe(function() {
    let exportResult = vm.exportResult();
    if (exportResult.exportedData == null) {
      return;
    }
    // Recalculate visibility
    exportResult.exportedData.updateVisibility();
    // Notify about the change
    vm.exportResult({
      isWorking: exportResult.isWorking,
      exportStatus: exportResult.exportStatus,
      exportError: exportResult.exportError,
      exportedData: exportResult.exportedData
    });
  });

  return vm;
}
