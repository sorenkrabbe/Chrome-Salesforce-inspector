if (!this.isUnitTest) {

var args = JSON.parse(atob(decodeURIComponent(location.search.substring(1))));
var options = args.options;
orgId = args.orgId;
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

  var vm = dataExportVm(options, queryInputVm, queryHistoryStorage);
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
    document.querySelector("#result-box"),
    ko.computed(function() { return vm.exportResultVm().resultTable || []; }),
    ko.computed(function() { return vm.resultBoxOffsetTop() + "-" + vm.winInnerHeight() + "-" + vm.winInnerWidth(); })
  );

  var resultBox = document.querySelector("#result-box");
  function recalculateHeight() {
    vm.resultBoxOffsetTop(resultBox.offsetTop);
  }
  if (!this.webkitURL) {
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

function dataExportVm(options, queryInput, queryHistoryStorage) {
  options = options || {};
  var exportResult = ko.observable({isWorking: false, exportStatus: "", exportError: "", exportedData: null});

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
    dataFormat: ko.observable("table"),
    autocompleteClick: null,
    exportResultVm: ko.computed(computeExportResultVm),
    queryHistory: ko.observable(getQueryHistory()),
    selectedHistoryEntry: ko.observable(),
    sobjectName: ko.observable(""),
    expandAutocomplete: ko.observable(false),
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
    stopExport: stopExport
  };

  function spinFor(promise) {
    vm.spinnerCount(vm.spinnerCount() + 1);
    promise.catch(function (e) { console.error("spinFor", e); }).then(stopSpinner, stopSpinner);
  }
  function stopSpinner() {
    vm.spinnerCount(vm.spinnerCount() - 1);
  }

  /**
   * sobjectDescribes is a map.
   * Keys are lowercased sobject API names.
   * Values are DescribeGlobalSObjectResult objects with two extra properties:
   *   - The "fields" property contains and array of DescribeFieldResult objects of all fields on the given sobject.
   *     The "fields" property does not exist if fields are not yet loaded.
   *   - The "fieldsRequest" contains a boolean, which is true if fields are loaded or a request to load them is in progress.
   */
  var sobjectDataDescribes = {};
  var sobjectToolingDescribes = {};
  var describeState = 0;
  function maybeGetFields(sobjectDescribe) {
    if (!sobjectDescribe.fieldsRequest) {
      console.log("getting fields for " + sobjectDescribe.name);
      sobjectDescribe.fieldsRequest = true;
      spinFor(askSalesforce(sobjectDescribe.urls.describe).then(function(res) {
        sobjectDescribe.fields = res.fields;
        describeState++;
        queryAutocompleteHandler();
      }, function() {
        sobjectDescribe.fieldsRequest = false; // Request failed, allow trying again
      }));
    }
  }
  spinFor(askSalesforce("/services/data/v34.0/sobjects/").then(function(res) {
    res.sobjects.forEach(function(sobjectDescribe) {
      sobjectDataDescribes[sobjectDescribe.name.toLowerCase()] = sobjectDescribe;
    });
    describeState++;
    queryAutocompleteHandler();
  }));
  spinFor(askSalesforce("/services/data/v34.0/tooling/sobjects/").then(function(res) {
    res.sobjects.forEach(function(sobjectDescribe) {
      sobjectToolingDescribes[sobjectDescribe.name.toLowerCase()] = sobjectDescribe;
    });
    describeState++;
    queryAutocompleteHandler();
  }));

  spinFor(askSalesforceSoap("<getUserInfo/>").then(function(res) {
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
    var sobjectDescribes = vm.queryTooling() ? sobjectToolingDescribes : sobjectDataDescribes;
    var query = queryInput.getValue();
    var selStart = queryInput.getSelStart();
    var selEnd = queryInput.getSelEnd();
    var ctrlSpace = e && e.ctrlSpace;

    // Skip the calculation when no change is made. This improves performance and prevents async operations (Ctrl+Space) from being canceled when they should not be.
    var newAutocompleteState = [vm.queryTooling(), describeState, query, selStart, selEnd].join("$");
    if (newAutocompleteState == autocompleteState && !ctrlSpace) {
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
      for (var sName in sobjectDescribes) {
        var sobjectDescribe = sobjectDescribes[sName];
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
    var sobjectDescribe = sobjectDescribes[sobjectName.toLowerCase()];

    if (!sobjectDescribe) {
      vm.autocompleteTitle("Unknown object: " + sobjectName);
      vm.autocompleteResults([]);
      return;
    }
    if (!sobjectDescribe.fields) {
      maybeGetFields(sobjectDescribe);
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
                var referencedSobjectDescribe = sobjectDescribes[referencedSobjectName.toLowerCase()];
                if (referencedSobjectDescribe) {
                  if (referencedSobjectDescribe.fields) {
                    newContextSobjectDescribes.add(referencedSobjectDescribe);
                  } else {
                    maybeGetFields(referencedSobjectDescribe);
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
        var queryMethod = vm.queryTooling() ? "tooling/query" : vm.queryAll() ? "queryAll" : "query";
        var acQuery = "select " + field.name + " from " + sobjectDescribe.name + " where " + field.name + " like '%" + searchTerm.replace(/'/g, "\\'") + "%' group by " + field.name + " limit 100";
        spinFor(askSalesforce("/services/data/v34.0/" + queryMethod + "/?q=" + encodeURIComponent(acQuery), autocompleteProgress)
          .catch(function(xhr) {
            vm.autocompleteTitle("Error: " + (xhr && xhr.responseText));
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
          function pad(n, d) {
            return ("000" + n).slice(-d);
          }
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
    var header = [""];
    var table = [];
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
          for (var r = 0; r < table.length; r++) {
            table[r].push(undefined);
          }
          header[c] = column;
        }
        row[c] = record[field];
        if (typeof record[field] == "object" && record[field] != null) {
          discoverColumns(record[field], column + ".", row);
        }
      }
    }
    return {
      records: [],
      table: table,
      isTooling: false,
      totalSize: -1,
      addToTable: function(expRecords) {
        this.records = this.records.concat(expRecords);
        if (table.length == 0 && expRecords.length > 0) {
          table.push(header);
        }
        for (var i = 0; i < expRecords.length; i++) {
          var record = expRecords[i];
          var row = new Array(header.length);
          row[0] = record;
          table.push(row);
          discoverColumns(record, "", row);
        }
      }
    };
  }

  function computeExportResultVm() {
    if (exportResult().exportError != null) {
      return {
        isWorking: exportResult().isWorking,
        resultStatus: exportResult().exportStatus,
        resultText: exportResult().exportError
      };
    }
    var dataFormat = vm.dataFormat();
    if (dataFormat == "json") {
      return {
        isWorking: exportResult().isWorking,
        resultStatus: exportResult().exportStatus,
        resultText: JSON.stringify(exportResult().exportedData.records, null, "  ")
      };
    }
    
    var table1 = exportResult().exportedData.table;
    var table2 = [];
    for (var r = 0; r < table1.length; r++) {
      var row1 = table1[r];
      var row2 = [];
      for (var c = 0; c < row1.length; c++) {
        var value1 = row1[c];
        var value2;
        if (typeof value1 == "object" && value1 != null && value1.attributes && value1.attributes.type) {
          if (dataFormat == "table") {
            value2 = {
              text: value1.attributes.type,
              allDataParam: {recordAttributes: value1.attributes, useToolingApi: exportResult().exportedData.isTooling}
            };
          } else {
            value2 = "[" + value1.attributes.type + "]";
          }
        } else if (value1 == null) {
          value2 = "";
        } else {
          value2 = "" + value1;
        }
        row2.push(value2);
      }
      table2.push(row2);
    }

    if (dataFormat == "table") {
      return {
        isWorking: exportResult().isWorking,
        resultStatus: exportResult().exportStatus,
        resultTable: table2
      };
    } else {
      var separator = dataFormat == "excel" ? "\t" : ",";
      return {
        isWorking: exportResult().isWorking,
        resultStatus: exportResult().exportStatus,
        resultText: csvSerialize(table2, separator)
      };
    }
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
    spinFor(askSalesforce("/services/data/v34.0/" + queryMethod + "/?q=" + encodeURIComponent(query), exportProgress).then(function queryHandler(data) {
      exportedData.addToTable(data.records);
      if (data.totalSize != -1) {
        exportedData.totalSize = data.totalSize;
      }
      if (!data.done) {
        var pr = askSalesforce(data.nextRecordsUrl, exportProgress).then(queryHandler);
        exportResult({
          isWorking: true,
          exportStatus: "Exporting... Completed " + exportedData.records.length + " of " + exportedData.totalSize + " records.",
          exportError: null,
          exportedData: exportedData
        });
        return pr;
      }
      vm.queryHistory(addToQueryHistory(query));
      if (exportedData.records.length == 0) {
        exportResult({
          isWorking: false,
          exportStatus: data.totalSize > 0 ? "No data exported. " + data.totalSize + " record(s)." : "No data exported.",
          exportError: null,
          exportedData: exportedData
        });
        return null;
      }
      exportResult({
        isWorking: false,
        exportStatus: "Exported " + exportedData.records.length + (exportedData.records.length != exportedData.totalSize ? " of " + exportedData.totalSize : "") + " records.",
        exportError: null,
        exportedData: exportedData
      });
      return null;
    }, function(xhr) {
      if (!xhr || xhr.readyState != 4) {
        throw xhr; // Not an HTTP error response
      }
      if (exportedData.totalSize != -1) {
        // We already got some data. Show it, and indicate that not all data was exported
        exportResult({
          isWorking: false,
          exportStatus: "Exported " + exportedData.records.length + " of " + exportedData.totalSize + " records. Stopped by error.",
          exportError: null,
          exportedData: exportedData
        });
        return null;
      }
      var data = JSON.parse(xhr.responseText);
      var text = "=== ERROR ===\n";
      for (var i = 0; i < data.length; i++) {
        text += data[i].message + "\n";
      }
      exportResult({
        isWorking: false,
        exportStatus: "Error",
        exportError: text,
        exportedData: exportedData
      });
      return null;
    }).then(null, function(error) {
      console.error(error);
      exportResult({
        isWorking: false,
        exportStatus: "Error",
        exportError: "UNEXPECTED EXCEPTION:" + error,
        exportedData: exportedData
      });
    }));
    exportResult({
      isWorking: true,
      exportStatus: "Exporting...",
      exportError: null,
      exportedData: exportedData
    });
  }

  function stopExport() {
    exportProgress.abort({records: [], done: true, totalSize: -1});
  }

  function csvSerialize(table, separator) {
    return table.map(function(row) { return row.map(function(text) { return "\"" + ("" + (text == null ? "" : text)).split("\"").join("\"\"") + "\""; }).join(separator); }).join("\r\n");
  }

  return vm;
}

/*
A table that contains millions of records will freeze the browser if we try to render the entire table at once.
Therefore we implement a table within a scrollable area, where the cells are only rendered, when they are scrolled into view.

Limitations:
* It is not possible to select the contents of the table outside the rendered area. The user will need to use the Excel or CSV formats to do that.
* Since we initially estimate the sice of each cell and then update as we render them, the table will sometimes "jump" as the user scrolls.
* There is no line wrapping within the cells. A cell with a lot of text will be very wide.

Implementation:
Since we don't know the height of each row before we render it, we assume to begin with that it is fairly small, and we then grow it to fit the rendered content, as the user scrolls.
We never schrink the height of a row, to ensure that it stabilzes as the user scrolls. The heights are stored in the `rowHeights` array.
To avoid re-rendering the visible part on every scroll, we render an area that is slightly larger than the viewport, and we then only re-render, when the viewport moves outside the rendered area.
Since we don't know the height of each row before we render it, we don't know exactly how many rows to render.
However since we never schrink the height of a row, we never render too few rows, and since we update the height estimates after each render, we won't repeatedly render too many rows.
The initial estimate of the height of each row should be large enough to ensure we don't render too many rows in our initial render.
We only measure the current size at the end of each render, to minimize the number of synchronous layouts the browser needs to make.
We support adding new rows to the end of the table, and new cells to the end of a row, but not deleting existing rows, and we do not reduce the height of a row if the existing content changes.
In addition to keeping track of the height of each cell, we keep track of the total height in order to adjust the height of the scrollable area, and we keep track of the position of the scrolled area.
After a scroll we search for the position of the new rendered area using the position of the old scrolled area, which should be the least amound of work when the user scrolls in one direction.
The table must have at least one row, since the code keeps track of the first rendered row.
We do the exact same logic for columns, as we do for rows.
We assume that the size of a cell is not influenced by the size of other cells. Therefore we style cells with `white-space: pre`.
We assume that the height of the cells we measure sum up to the height of the table.
*/
function initScrollTable(element, dataObs, resizeObs) {
  var scroller = document.createElement("div");
  scroller.className = "scrolltable-scroller";
  element.appendChild(scroller);
  var scrolled = document.createElement("div");
  scrolled.className = "scrolltable-scrolled";
  scroller.appendChild(scrolled);

  var initialRowHeight = 15; // constant: The initial estimated height of a row before it is rendered
  var initialColWidth = 50; // constant: The initial estimated width of a column before it is rendered
  var bufferHeight = 500; // constant: The number of pixels to render above and below the current viewport
  var bufferWidth = 500; // constant: The number of pixels to render to the left and right of the current viewport
  var headerRows = 1; // constant: The number of header rows
  var headerCols = 0; // constant: The number of header columns

  var rowHeights = [];
  var rowCount = 0;
  var totalHeight = 0;
  var firstRowIdx = 0; // The index of the first rendered row
  var firstRowTop = 0; // The distance from the top of the table to the top of the first rendered row
  var lastRowIdx = 0; // The index of the row below the last rendered row
  var lastRowTop = 0; // The distance from the top of the table to the bottom of the last rendered row (the top of the row below the last rendered row)
  var colWidths = [];
  var colCount =  0;
  var totalWidth = 0;
  var firstColIdx = 0; // The index of the first rendered column
  var firstColLeft = 0; // The distance from the left of the table to the left of the first rendered column
  var lastColIdx = 0; // The index of the column to the right of the last rendered column
  var lastRowLeft = 0; // The distance from the left of the table to the right of the last rendered column (the left of the row below the last rendered row)

  function dataChange() {
    var data = dataObs();
    if (data.length == 0) {
      // First render, or table was cleared
      rowHeights = [];
      rowCount = 0;
      totalHeight = 0;
      firstRowIdx = 0;
      firstRowTop = 0;
      lastRowIdx = 0;
      lastRowTop = 0;

      colWidths = [];
      colCount =  0;
      totalWidth = 0;
      firstColIdx = 0;
      firstColLeft = 0;
      lastColIdx = 0;
      lastRowLeft = 0;
      render(data, {force: true});
    } else {
      // Rows or columns were added to an existing table
      var rowsAdded = false;
      var newRowCount = data.length;
      if (newRowCount > rowCount) {
        for (var r = rowCount; r < newRowCount; r++) {
          rowHeights[r] = initialRowHeight;
          totalHeight += initialRowHeight;
        }
        rowsAdded = true;
        rowCount = newRowCount;
      }
      var colsAdded = false;
      var newColCount = data[0].length;
      if (newColCount > colCount) {
        for (var c = colCount; c < newColCount; c++) {
          colWidths[c] = initialColWidth;
          totalWidth += initialColWidth;
        }
        colsAdded = true;
        colCount = newColCount;
      }
      render(data, {rowsAdded: rowsAdded, colsAdded: colsAdded});
    }
  }

  function viewportChange() {
    render(dataObs(), {});
  }

  function render(data, options) {
    if (rowCount == 0 || colCount == 0) {
      scrolled.textContent = ""; // Delete previously rendered content
      scrolled.style.height = "0px";
      scrolled.style.width = "0px";
      return;
    }

    var scrollTop = scroller.scrollTop;
    var scrollLeft = scroller.scrollLeft;
    var offsetHeight = scroller.offsetHeight;
    var offsetWidth = scroller.offsetWidth;

    if (!options.force && firstRowTop <= scrollTop && (lastRowTop >= scrollTop + offsetHeight || (lastRowIdx == rowCount && !options.rowsAdded)) && firstColLeft <= scrollLeft && (lastColLeft >= scrollLeft + offsetWidth || (lastColIdx == colCount && !options.colsAdded))) {
      if (options.rowsAdded || options.colsAdded) {
        scrolled.style.height = totalHeight + "px";
        scrolled.style.width = totalWidth + "px";
      }
      return;
    }
    console.log("render");

    while (firstRowTop < scrollTop - bufferHeight && firstRowIdx < rowCount - 1) {
      firstRowTop += rowHeights[firstRowIdx];
      firstRowIdx++;
    }
    while (firstRowTop > scrollTop - bufferHeight && firstRowIdx > 0) {
      firstRowIdx--;
      firstRowTop -= rowHeights[firstRowIdx];
    }
    while (firstColLeft < scrollLeft - bufferWidth && firstColIdx < colCount - 1) {
      firstColLeft += colWidths[firstColIdx];
      firstColIdx++;
    }
    while (firstColLeft > scrollLeft - bufferWidth && firstColIdx > 0) {
      firstColIdx--;
      firstColLeft -= colWidths[firstColIdx];
    }

    lastRowIdx = firstRowIdx;
    lastRowTop = firstRowTop;
    while (lastRowTop < scrollTop + offsetHeight + bufferHeight && lastRowIdx < rowCount) {
      lastRowTop += rowHeights[lastRowIdx];
      lastRowIdx++;
    }
    lastColIdx = firstColIdx;
    lastColLeft = firstColLeft;
    while (lastColLeft < scrollLeft + offsetWidth + bufferWidth && lastColIdx < colCount) {
      lastColLeft += colWidths[lastColIdx];
      lastColIdx++;
    }

    scrolled.textContent = ""; // Delete previously rendered content
    scrolled.style.height = totalHeight + "px";
    scrolled.style.width = totalWidth + "px";

    var table = document.createElement("table");
    for (var r = firstRowIdx; r < lastRowIdx; r++) {
      var row = data[r];
      var tr = document.createElement("tr");
      for (var c = firstColIdx; c < lastColIdx; c++) {
        var cell = row[c];
        var td = document.createElement("td");
        td.className = "scrolltable-cell";
        if (r < headerRows || c < headerCols) {
          td.className += " header";
        }
        td.style.minWidth = colWidths[c] + "px";
        td.style.minHeight = rowHeights[r] + "px";
        if (typeof cell == "object") {
          var a = document.createElement("a");
          a.href = "about:blank";
          a.title = "Show all data";
          a.addEventListener("click", function(e) {
            e.preventDefault();
            showAllData(this.allDataParam);
          }.bind(cell));
          a.textContent = cell.text;
          td.appendChild(a);
        } else {
          td.textContent = cell;
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    table.style.top = firstRowTop + "px";
    table.style.left = firstColLeft + "px";
    scrolled.appendChild(table);
    // Before this point we invalidate style and layout. After this point we recalculate style and layout, and we do not invalidate them again.
    tr = table.firstElementChild;
    for (var r = firstRowIdx; r < lastRowIdx; r++) {
      var rowRect = tr.firstElementChild.getBoundingClientRect();
      var oldHeight = rowHeights[r];
      var newHeight = Math.max(oldHeight, rowRect.height);
      rowHeights[r] = newHeight;
      totalHeight += newHeight - oldHeight;
      lastRowTop += newHeight - oldHeight;
      tr = tr.nextElementSibling;
    }
    td = table.firstElementChild.firstElementChild;
    for (var c = firstColIdx; c < lastColIdx; c++) {
      var colRect = td.getBoundingClientRect();
      var oldWidth = colWidths[c];
      var newWidth = Math.max(oldWidth, colRect.width);
      colWidths[c] = newWidth;
      totalWidth += newWidth - oldWidth;
      lastColLeft += newWidth - oldWidth;
      td = td.nextElementSibling;
    }
  }

  dataChange();
  dataObs.subscribe(dataChange);
  resizeObs.subscribe(viewportChange);
  scroller.addEventListener("scroll", viewportChange);
}
