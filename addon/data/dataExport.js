"use strict";
if (!this.isUnitTest) {

var args = JSON.parse(atob(decodeURIComponent(location.search.substring(1))));
var options = args.options;
orgId = args.orgId;
initPopup(true);
chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
  session = message;
  var popupWin = window;

  var queryInput = document.querySelector("#query");

  var queryInputVm = {
    setValue: function(v) { queryInput.value = v; },
    getValue: function() { return queryInput.value; },
    getSelStart: function() { return queryInput.selectionStart; },
    getSelEnd: function() { return queryInput.selectionEnd; },
    insertText: function(text, selStart, selEnd) {
      queryInput.focus();
      queryInput.setRangeText(text, selStart, selEnd, "end");
    }
  };

  var queryHistoryStorage = {
    get: function() { return localStorage.insextQueryHistory; },
    set: function(v) { localStorage.insextQueryHistory = v; },
    clear: function() { localStorage.removeItem("insextQueryHistory"); }
  };

  var vm = dataExportVm(options, queryInputVm, queryHistoryStorage, copyToClipboard);
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
  queryInput.addEventListener("keypress", function(e) {
    if (e.charCode == 32 /* space */ && e.ctrlKey) {
      e.preventDefault();
      vm.queryAutocompleteHandler({ctrlSpace: true});
    }
  });

  initScrollTable(
    document.querySelector("#result-table"),
    ko.computed(function() { return vm.exportResult().exportedData; }),
    ko.computed(function() { return vm.resultBoxOffsetTop() + "-" + vm.winInnerHeight() + "-" + vm.winInnerWidth(); })
  );

  var resultBox = document.querySelector("#result-box");
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
    popupWin.addEventListener("mouseup", recalculateHeight);
  }
  vm.showHelp.subscribe(recalculateHeight);
  vm.autocompleteResults.subscribe(recalculateHeight);
  vm.expandAutocomplete.subscribe(recalculateHeight);
  function resize() {
    vm.winInnerHeight(popupWin.innerHeight);
    vm.winInnerWidth(popupWin.innerWidth);
    recalculateHeight(); // a resize event is fired when the window is opened after resultBox.offsetTop has been initialized, so initializes vm.resultBoxOffsetTop
  }
  popupWin.addEventListener("resize", resize);
  resize();

});

}

function dataExportVm(options, queryInput, queryHistoryStorage, copyToClipboard) {
  options = options || {};

  var vm = {
    spinnerCount: ko.observable(0),
    showHelp: ko.observable(false),
    userInfo: ko.observable("..."),
    winInnerHeight: ko.observable(0),
    winInnerWidth: ko.observable({}),
    resultBoxOffsetTop: ko.observable(0),
    queryAll: ko.observable(false),
    queryTooling: ko.observable(false),
    autocompleteTitle: ko.observable("\u00A0"),
    autocompleteResults: ko.observable([]),
    autocompleteClick: null,
    exportResult: ko.observable({isWorking: false, exportStatus: "Ready", exportError: null, exportedData: null}),
    queryHistory: ko.observable(getQueryHistory()),
    selectedHistoryEntry: ko.observable(),
    sobjectName: ko.observable(""),
    expandAutocomplete: ko.observable(false),
    resultsFilter: ko.observable(""),
    toggleHelp: function() {
      vm.showHelp(!vm.showHelp());
    },
    toggleExpand: function() {
      vm.expandAutocomplete(!vm.expandAutocomplete());
    },
    showDescribe: function() {
      showAllData({
        recordAttributes: {type: vm.sobjectName(), url: null},
        useToolingApi: vm.queryTooling()
      });
    },
    selectHistoryEntry: function() {
      if (vm.selectedHistoryEntry() != undefined) {
        queryInput.setValue(vm.selectedHistoryEntry());
        vm.selectedHistoryEntry(undefined);
      }
    },
    clearHistory: function() {
      clearQueryHistory();
      vm.queryHistory([]);
    },
    queryAutocompleteHandler: queryAutocompleteHandler,
    doExport: doExport,
    canCopy: function() {
      return vm.exportResult().exportedData != null;
    },
    copyAsExcel: function() {
      copyToClipboard(vm.exportResult().exportedData.csvSerialize("\t"));
    },
    copyAsCsv: function() {
      copyToClipboard(vm.exportResult().exportedData.csvSerialize(","));
    },
    copyAsJson: function() {
      copyToClipboard(JSON.stringify(vm.exportResult().exportedData.records, null, "  "));
    },
    stopExport: stopExport
  };

  function spinFor(promise) {
    vm.spinnerCount(vm.spinnerCount() + 1);
    promise.catch(function (e) { console.error("spinFor", e); }).then(stopSpinner, stopSpinner);
  }
  function stopSpinner() {
    vm.spinnerCount(vm.spinnerCount() - 1);
  }

  var describeInfo = new DescribeInfo(spinFor);
  describeInfo.dataUpdate.subscribe(() => queryAutocompleteHandler({newDescribe: true}));

  spinFor(askSalesforceSoap("/services/Soap/u/35.0", "urn:partner.soap.sforce.com", "<getUserInfo/>").then(function(res) {
    vm.userInfo(res.querySelector("Body userFullName").textContent + " / " + res.querySelector("Body userName").textContent + " / " + res.querySelector("Body organizationName").textContent);
  }));

  queryInput.setValue(options.query || vm.queryHistory()[0] || "select Id from Account");

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
   * Does not yet support subqueries.
   */
  var autocompleteState = "";
  var autocompleteProgress = {};
  function queryAutocompleteHandler(e) {
    var useToolingApi = vm.queryTooling();
    var query = queryInput.getValue();
    var selStart = queryInput.getSelStart();
    var selEnd = queryInput.getSelEnd();
    var ctrlSpace = e && e.ctrlSpace;

    // Skip the calculation when no change is made. This improves performance and prevents async operations (Ctrl+Space) from being canceled when they should not be.
    var newAutocompleteState = [useToolingApi, query, selStart, selEnd].join("$");
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
    var searchTerm = selStart != selEnd
      ? query.substring(selStart, selEnd)
      : query.substring(0, selStart).match(/[a-zA-Z0-9_]*$/)[0];
    selStart = selEnd - searchTerm.length;

    // If we are just after the "from" keyword, autocomplete the sobject name
    if (query.substring(0, selStart).match(/(^|\s)from\s*$/)) {
      var ar = [];
      for (let sobjectDescribe of describeInfo.describeGlobal(useToolingApi)) {
        if (sobjectDescribe.name.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1 || sobjectDescribe.label.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1) {
          ar.push({value: sobjectDescribe.name, title: sobjectDescribe.label, suffix: " "});
        }
      }
      vm.sobjectName("");
      vm.autocompleteTitle("Objects:");
      vm.autocompleteResults(ar);
      return;
    }

      var sobjectName, isAfterFrom;
    // Find out what sobject we are querying, by using the word after the "from" keyword.
    // Assuming no subqueries, we should find the correct sobjectName. There should be only one "from" keyword, and strings (which may contain the word "from") are only allowed after the real "from" keyword.
    var fromKeywordMatch = /(^|\s)from\s+([a-z0-9_]*)/i.exec(query);
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
        vm.sobjectName("");
        vm.autocompleteTitle("\"from\" keyword not found");
        vm.autocompleteResults([]);
        return;
      }
    }
    vm.sobjectName(sobjectName);
    let describeSobject = describeInfo.describeSobject(useToolingApi, sobjectName);
    var sobjectDescribe = describeSobject.sobjectDescribe;

    if (!describeSobject.sobjectFound) {
      vm.autocompleteTitle("Unknown object: " + sobjectName);
      vm.autocompleteResults([]);
      return;
    }
    if (!sobjectDescribe) {
      vm.autocompleteTitle("Loading metadata for object: " + sobjectName);
      vm.autocompleteResults([]);
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

    var contextEnd = selStart;

    // If we are on the right hand side of a comparison operator, autocomplete field values
    var isFieldValue = query.substring(0, selStart).match(/\s*[<>=!]+\s*('?[^'\s]*)$/);
    var fieldName = null;
    if (isFieldValue) {
      var fieldEnd = selStart - isFieldValue[0].length;
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
    var contextSobjectDescribes = [sobjectDescribe];
    var contextPath = query.substring(0, contextEnd).match(/[a-zA-Z0-9_\.]*$/)[0];
    var isLoading = false;
    if (contextPath) {
      var contextFields = contextPath.split(".");
      contextFields.pop(); // always empty
      contextFields.forEach(function(referenceFieldName) {
        var newContextSobjectDescribes = new Set();
        contextSobjectDescribes.forEach(function(sobjectDescribe) {
          sobjectDescribe.fields
            .filter(function(field) { return field.relationshipName && field.relationshipName.toLowerCase() == referenceFieldName.toLowerCase(); })
            .forEach(function(field) {
              field.referenceTo.forEach(function(referencedSobjectName) {
                let describeReferencedSobject = describeInfo.describeSobject(useToolingApi, referencedSobjectName.toLowerCase());
                if (describeReferencedSobject.sobjectFound) {
                  if (describeReferencedSobject.sobjectDescribe) {
                    newContextSobjectDescribes.add(describeReferencedSobject.sobjectDescribe);
                  } else {
                    isLoading = true;
                  }
                }
              });
            });
        });
        contextSobjectDescribes = [];
        newContextSobjectDescribes.forEach(function(d) { contextSobjectDescribes.push(d); });
      });
    }

    if (contextSobjectDescribes.length == 0) {
      vm.autocompleteTitle(isLoading ? "Loading metadata..." : "Unknown field: " + sobjectName + "." + contextPath);
      vm.autocompleteResults([]);
      return;
    }

    if (isFieldValue) {
      // Autocomplete field values
      var contextValueFields = [];
      contextSobjectDescribes.forEach(function(sobjectDescribe) {
        sobjectDescribe.fields
          .filter(function(field) { return field.name.toLowerCase() == fieldName.toLowerCase(); })
          .forEach(function(field) {
            contextValueFields.push({sobjectDescribe: sobjectDescribe, field: field});
          });
      });
      if (contextValueFields.length == 0) {
        vm.autocompleteTitle("Unknown field: " + sobjectDescribe.name + "." + contextPath + fieldName);
        vm.autocompleteResults([]);
        return;
      }
      var fieldNames = contextValueFields.map(function(contextValueField) { return contextValueField.sobjectDescribe.name + "." + contextValueField.field.name; }).join(", ");
      if (ctrlSpace) {
        // Since this performs a Salesforce API call, we ask the user to opt in by pressing Ctrl+Space
        if (contextValueFields.length > 1) {
          vm.autocompleteTitle("Multiple possible fields: " + fieldNames);
          vm.autocompleteResults([]);
          return;
        }
        var sobjectDescribe = contextValueFields[0].sobjectDescribe;
        var field = contextValueFields[0].field;
        var queryMethod = useToolingApi ? "tooling/query" : vm.queryAll() ? "queryAll" : "query";
        var acQuery = "select " + field.name + " from " + sobjectDescribe.name + " where " + field.name + " like '%" + searchTerm.replace(/'/g, "\\'") + "%' group by " + field.name + " limit 100";
        spinFor(askSalesforce("/services/data/v35.0/" + queryMethod + "/?q=" + encodeURIComponent(acQuery), autocompleteProgress)
          .catch(function(err) {
            vm.autocompleteTitle("Error: " + ((err && err.askSalesforceError) || err));
            return null;
          })
          .then(function queryHandler(data) {
            autocompleteProgress = {};
            if (!data) {
              return;
            }
            var ar = [];
            data.records.forEach(function(record) {
              var value = record[field.name];
              if (value) {
                ar.push({value: "'" + value + "'", title: value, suffix: " "});
              }
            });
            vm.autocompleteTitle(fieldNames + " values:");
            vm.autocompleteResults(ar);
          }));
        vm.autocompleteTitle("Loading " + fieldNames + " values...");
        vm.autocompleteResults([]);
        return;
      }
      var ar = [];
      contextValueFields.forEach(function(contextValueField) {
        var field = contextValueField.field;
        field.picklistValues.forEach(function(pickVal) {
          ar.push({value: "'" + pickVal.value + "'", title: pickVal.label, suffix: " "});
        });
        if (field.type == "boolean") {
          ar.push({value: "true", title: "true", suffix: " "});
          ar.push({value: "false", title: "false", suffix: " "});
        }
        if (field.type == "date" || field.type == "datetime") {
          let pad = (n, d) => ("000" + n).slice(-d);
          var d = new Date();
          if (field.type == "date") {
            ar.push({value: pad(d.getFullYear(), 4) + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2), title: "Today", suffix: " "});
          }
          if (field.type == "datetime") {
            ar.push({value: pad(d.getFullYear(), 4) + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2) + "T"
              + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2) + "." + pad(d.getMilliseconds(), 3)
              + (d.getTimezoneOffset() <= 0 ? "+" : "-") + pad(Math.floor(Math.abs(d.getTimezoneOffset()) / 60), 2)
              + ":" + pad(Math.abs(d.getTimezoneOffset()) % 60, 2), title: "Now", suffix: " "});
          }
          // from http://www.salesforce.com/us/developer/docs/soql_sosl/Content/sforce_api_calls_soql_select_dateformats.htm Spring 15
          ar.push({value: "YESTERDAY", title: "Starts 12:00:00 the day before and continues for 24 hours.", suffix: " "});
          ar.push({value: "TODAY", title: "Starts 12:00:00 of the current day and continues for 24 hours.", suffix: " "});
          ar.push({value: "TOMORROW", title: "Starts 12:00:00 after the current day and continues for 24 hours.", suffix: " "});
          ar.push({value: "LAST_WEEK", title: "Starts 12:00:00 on the first day of the week before the most recent first day of the week and continues for seven full days. First day of the week is determined by your locale.", suffix: " "});
          ar.push({value: "THIS_WEEK", title: "Starts 12:00:00 on the most recent first day of the week before the current day and continues for seven full days. First day of the week is determined by your locale.", suffix: " "});
          ar.push({value: "NEXT_WEEK", title: "Starts 12:00:00 on the most recent first day of the week after the current day and continues for seven full days. First day of the week is determined by your locale.", suffix: " "});
          ar.push({value: "LAST_MONTH", title: "Starts 12:00:00 on the first day of the month before the current day and continues for all the days of that month.", suffix: " "});
          ar.push({value: "THIS_MONTH", title: "Starts 12:00:00 on the first day of the month that the current day is in and continues for all the days of that month.", suffix: " "});
          ar.push({value: "NEXT_MONTH", title: "Starts 12:00:00 on the first day of the month after the month that the current day is in and continues for all the days of that month.", suffix: " "});
          ar.push({value: "LAST_90_DAYS", title: "Starts 12:00:00 of the current day and continues for the last 90 days.", suffix: " "});
          ar.push({value: "NEXT_90_DAYS", title: "Starts 12:00:00 of the current day and continues for the next 90 days.", suffix: " "});
          ar.push({value: "LAST_N_DAYS:n", title: "For the number n provided, starts 12:00:00 of the current day and continues for the last n days.", suffix: " "});
          ar.push({value: "NEXT_N_DAYS:n", title: "For the number n provided, starts 12:00:00 of the current day and continues for the next n days.", suffix: " "});
          ar.push({value: "NEXT_N_WEEKS:n", title: "For the number n provided, starts 12:00:00 of the first day of the next week and continues for the next n weeks.", suffix: " "});
          ar.push({value: "LAST_N_WEEKS:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous week and continues for the last n weeks.", suffix: " "});
          ar.push({value: "NEXT_N_MONTHS:n", title: "For the number n provided, starts 12:00:00 of the first day of the next month and continues for the next n months.", suffix: " "});
          ar.push({value: "LAST_N_MONTHS:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous month and continues for the last n months.", suffix: " "});
          ar.push({value: "THIS_QUARTER", title: "Starts 12:00:00 of the current quarter and continues to the end of the current quarter.", suffix: " "});
          ar.push({value: "LAST_QUARTER", title: "Starts 12:00:00 of the previous quarter and continues to the end of that quarter.", suffix: " "});
          ar.push({value: "NEXT_QUARTER", title: "Starts 12:00:00 of the next quarter and continues to the end of that quarter.", suffix: " "});
          ar.push({value: "NEXT_N_QUARTERS:n", title: "Starts 12:00:00 of the next quarter and continues to the end of the nth quarter.", suffix: " "});
          ar.push({value: "LAST_N_QUARTERS:n", title: "Starts 12:00:00 of the previous quarter and continues to the end of the previous nth quarter.", suffix: " "});
          ar.push({value: "THIS_YEAR", title: "Starts 12:00:00 on January 1 of the current year and continues through the end of December 31 of the current year.", suffix: " "});
          ar.push({value: "LAST_YEAR", title: "Starts 12:00:00 on January 1 of the previous year and continues through the end of December 31 of that year.", suffix: " "});
          ar.push({value: "NEXT_YEAR", title: "Starts 12:00:00 on January 1 of the following year and continues through the end of December 31 of that year.", suffix: " "});
          ar.push({value: "NEXT_N_YEARS:n", title: "Starts 12:00:00 on January 1 of the following year and continues through the end of December 31 of the nth year.", suffix: " "});
          ar.push({value: "LAST_N_YEARS:n", title: "Starts 12:00:00 on January 1 of the previous year and continues through the end of December 31 of the previous nth year.", suffix: " "});
          ar.push({value: "THIS_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the current fiscal quarter and continues through the end of the last day of the fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " "});
          ar.push({value: "LAST_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the last fiscal quarter and continues through the end of the last day of that fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " "});
          ar.push({value: "NEXT_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the next fiscal quarter and continues through the end of the last day of that fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " "});
          ar.push({value: "NEXT_N_FISCAL_QUARTERS:n", title: "Starts 12:00:00 on the first day of the next fiscal quarter and continues through the end of the last day of the nth fiscal quarter. The fiscal year is defined in the company profile under Setup atCompany Profile | Fiscal Year.", suffix: " "});
          ar.push({value: "LAST_N_FISCAL_QUARTERS:n", title: "Starts 12:00:00 on the first day of the last fiscal quarter and continues through the end of the last day of the previous nth fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " "});
          ar.push({value: "THIS_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the current fiscal year and continues through the end of the last day of the fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " "});
          ar.push({value: "LAST_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the last fiscal year and continues through the end of the last day of that fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " "});
          ar.push({value: "NEXT_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the next fiscal year and continues through the end of the last day of that fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " "});
          ar.push({value: "NEXT_N_FISCAL_YEARS:n", title: "Starts 12:00:00 on the first day of the next fiscal year and continues through the end of the last day of the nth fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " "});
          ar.push({value: "LAST_N_FISCAL_YEARS:n", title: "Starts 12:00:00 on the first day of the last fiscal year and continues through the end of the last day of the previous nth fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " "});
        }
        if (field.nillable) {
          ar.push({value: "null", title: "null", suffix: " "});
        }
      });
      ar = ar.filter(function(res) { return res.value.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1 || res.title.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1; });
      vm.autocompleteTitle(fieldNames + (ar.length == 0 ? " values (Press Ctrl+Space):" : " values:"));
      vm.autocompleteResults(ar);
      return;
    } else {
      // Autocomplete field names and functions
      if (ctrlSpace) {
        var ar = [];
        contextSobjectDescribes.forEach(function(sobjectDescribe) {
          sobjectDescribe.fields
            .filter(function(field) { return field.name.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1 || field.label.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1; })
            .forEach(function(field) {
              ar.push(contextPath + field.name);
            });
        });
        if (ar.length > 0) {
          queryInput.insertText(ar.join(", ") + (isAfterFrom ? " " : ", "), selStart - contextPath.length, selEnd);
        }
        queryAutocompleteHandler();
        return;
      }
      var ar = [];
      contextSobjectDescribes.forEach(function(sobjectDescribe) {
        sobjectDescribe.fields
          .filter(function(field) { return field.name.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1 || field.label.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1; })
          .forEach(function(field) {
            ar.push({value: field.name, title: field.label, suffix: isAfterFrom ? " " : ", "});
            if (field.relationshipName) {
              ar.push({value: field.relationshipName + ".", title: field.label, suffix: ""});
            }
          });
      });
      ["AVG", "COUNT", "COUNT_DISTINCT", "MIN", "MAX", "SUM", "CALENDAR_MONTH", "CALENDAR_QUARTER", "CALENDAR_YEAR", "DAY_IN_MONTH", "DAY_IN_WEEK", "DAY_IN_YEAR", "DAY_ONLY", "FISCAL_MONTH", "FISCAL_QUARTER", "FISCAL_YEAR", "HOUR_IN_DAY", "WEEK_IN_MONTH", "WEEK_IN_YEAR", "convertTimezone"]
        .filter(function (fn) { return fn.toLowerCase().indexOf(searchTerm.toLowerCase()) == 0; })
        .forEach(function(fn) {
          ar.push({value: fn, title: fn + "()", suffix: "("});
        });
      vm.autocompleteTitle(contextSobjectDescribes.map(function(sobjectDescribe) { return sobjectDescribe.name; }).join(", ") + " fields:");
      vm.autocompleteResults(ar);
      return;
    }
  }

  function RecordTable() {
    /*
    We don't want to build our own SOQL parser, so we discover the columns based on the data returned.
    This means that we cannot find the columns of cross-object relationships, when the relationship field is null for all returned records.
    We don't care, because we don't need a stable set of columns for our use case.
    */
    var columnIdx = new Map();
    var header = ["_"];
    function discoverColumns(record, prefix, row) {
      for (var field in record) {
        if (field == "attributes") {
          continue;
        }
        var column = prefix + field;
        var c;
        if (columnIdx.has(column)) {
          c = columnIdx.get(column);
        } else {
          c = header.length;
          columnIdx.set(column, c);
          for (var r = 0; r < rt.table.length; r++) {
            rt.table[r].push(undefined);
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
      addToTable: function(expRecords) {
        rt.records = rt.records.concat(expRecords);
        if (rt.table.length == 0 && expRecords.length > 0) {
          rt.table.push(header);
          rt.rowVisibilities.push(true);
        }
        var filter = vm.resultsFilter();
        for (var i = 0; i < expRecords.length; i++) {
          var record = expRecords[i];
          var row = new Array(header.length);
          row[0] = record;
          rt.table.push(row);
          rt.rowVisibilities.push(isVisible(row, filter));
          discoverColumns(record, "", row);
        }
      },
      csvSerialize: separator => rt.table.map(row => row.map(cell => "\"" + cellToString(cell).split("\"").join("\"\"") + "\"").join(separator)).join("\r\n"),
      updateVisibility: function() {
        let filter = vm.resultsFilter();
        for (let r = 1 /* always show header */; r < rt.table.length; r++) {
          rt.rowVisibilities[r] = isVisible(rt.table[r], filter);
        }
      },
      renderCell: function(cell, td) {
        if (typeof cell == "object" && cell != null && cell.attributes && cell.attributes.type) {
          var a = document.createElement("a");
          a.href = "about:blank";
          a.title = "Show all data";
          a.addEventListener("click", function(e) {
            e.preventDefault();
            showAllData({recordAttributes: cell.attributes, useToolingApi: vm.exportResult().isTooling});
          });
          a.textContent = cell.attributes.type;
          td.appendChild(a);
        } else if (cell == null) {
          td.textContent = "";
        } else {
          td.textContent = cell;
        }
      }
    };
    return rt;
  }

  vm.queryTooling.subscribe(function() {
    queryAutocompleteHandler();
  });

  function getQueryHistory() {
    var queryHistory;
    try {
      queryHistory = JSON.parse(queryHistoryStorage.get());
    } catch(e) {}
    if (!Array.isArray(queryHistory)) {
      queryHistory = [];
    }
    return queryHistory;
  }

  function addToQueryHistory(query) {
    var queryHistory = getQueryHistory();
    var historyIndex = queryHistory.indexOf(query);
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

  var exportProgress = {};
  function doExport() {
    var exportedData = new RecordTable();
    exportedData.isTooling = vm.queryTooling();
    var query = queryInput.getValue();
    var queryMethod = exportedData.isTooling ? "tooling/query" : vm.queryAll() ? "queryAll" : "query";
    spinFor(askSalesforce("/services/data/v35.0/" + queryMethod + "/?q=" + encodeURIComponent(query), exportProgress).then(function queryHandler(data) {
      exportedData.addToTable(data.records);
      if (data.totalSize != -1) {
        exportedData.totalSize = data.totalSize;
      }
      if (!data.done) {
        var pr = askSalesforce(data.nextRecordsUrl, exportProgress).then(queryHandler);
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
