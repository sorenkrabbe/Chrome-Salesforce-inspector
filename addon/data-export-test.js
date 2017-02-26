/* eslint-disable no-unused-vars */
/* global sfConn apiVersion async */
/* exported dataExportTest */
/* eslint-enable no-unused-vars */
"use strict";
function* dataExportTest(test) {
  console.log("TEST data-export");
  let {assertEquals, assertNotEquals, assert, loadPage, anonApex} = test;

  localStorage.removeItem("insextQueryHistory");
  localStorage.removeItem("insextSavedQueryHistory");

  let win = yield loadPage("data-export.html");
  let {testData: {model}} = win;
  let vm = model;
  let queryInput = model.queryInput.queryInput;
  function queryAutocompleteEvent() {
    model.queryAutocompleteHandler();
  }

  function setQuery(a, b, c) {
    queryInput.value = a + b + c;
    queryInput.selectionStart = a.length;
    queryInput.selectionEnd = a.length + b.length;
    queryAutocompleteEvent();
  }

  let clipboardValue;
  win.copyToClipboard = value => {
    clipboardValue = value;
  };

  function waitForSpinner() {
    return new Promise(resolve => {
      assertEquals(undefined, model.testCallback);
      model.testCallback = () => {
        if (model.spinnerCount == 0) {
          model.testCallback = undefined;
          resolve();
        }
      };
    });
  }

  function getValues(list) {
    return list.map(el => el.value);
  }

  assertEquals("select Id from Account", queryInput.value);
  queryInput.selectionStart = queryInput.selectionEnd = "select Id from Account".length; // When the cursor is placed after object name, we will try to autocomplete that once the global describe loads, and we will not try to load object field describes, so we can test loading those separately
  vm.queryAutocompleteHandler();

  // Load global describe and user info
  yield waitForSpinner();

  // Autocomplete object names
  assertEquals("Objects:", vm.autocompleteResults().title);
  assertEquals(["Account", "AccountContactRelation"], getValues(vm.autocompleteResults().results).slice(0, 2));

  // See user info
  assert(vm.userInfo().indexOf(" / ") > -1);

  // Autocomplete field name in SELECT with no field metadata
  setQuery("select Id, nam", "", " from Account");
  assertEquals("Loading Account metadata...", vm.autocompleteResults().title);
  assertEquals([], vm.autocompleteResults().results);

  // Load Account field describe
  yield waitForSpinner();

  // Autocomplete field name in SELECT, sould automatically update when describe call completes
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals(["Name"], getValues(vm.autocompleteResults().results));

  // Select autocomplete value in SELECT
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id, Name,  from Account", queryInput.value);
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertNotEquals(["Name"], getValues(vm.autocompleteResults().results));

  // Select multiple values in SELECT using Ctrl+Space
  setQuery("select Id, shipp", "", " from Account");
  assertEquals("select Id, shipp from Account", queryInput.value);
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals(["ShippingAddress", "ShippingCity", "ShippingCountry", "ShippingGeocodeAccuracy", "ShippingLatitude", "ShippingLongitude", "ShippingPostalCode", "ShippingState", "ShippingStreet"], getValues(vm.autocompleteResults().results));
  vm.queryAutocompleteHandler({ctrlSpace: true});
  assertEquals("select Id, ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry, ShippingLatitude, ShippingLongitude, ShippingGeocodeAccuracy, ShippingAddress,  from Account", queryInput.value);

  // Autocomplete relationship field in SELECT
  setQuery("select Id, OWNE", "", " from Account");
  assertEquals("select Id, OWNE from Account", queryInput.value);
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals(["Owner.", "OwnerId", "Ownership"], getValues(vm.autocompleteResults().results));
  // Select relationship field in SELECT
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id, Owner. from Account", queryInput.value);
  assertEquals("Loading User metadata...", vm.autocompleteResults().title);
  assertEquals([], vm.autocompleteResults().results);

  // Load User field describe
  yield waitForSpinner();
  assertEquals("User fields:", vm.autocompleteResults().title);

  // Autocomplete related field in SELECT
  setQuery("select Id, OWNER.USERN", "", " from Account");
  assertEquals("User fields:", vm.autocompleteResults().title);
  assertEquals(["Username"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id, OWNER.Username,  from Account", queryInput.value);

  // Autocomplete function
  setQuery("select Id, Count_di", "", " from Account");
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals(["COUNT_DISTINCT"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id, COUNT_DISTINCT( from Account", queryInput.value);

  // Autocomplete field in function
  setQuery("select Id, count(nam", "", " from Account");
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals(["Name"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id, count(Name,  from Account", queryInput.value); // not ideal suffix

  // Autocomplete field in WHERE
  setQuery("select Id from Account where sic", "", "");
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals(["Sic", "SicDesc"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id from Account where Sic ", queryInput.value);

  // Autocomplete picklist value
  setQuery("select Id from Account where Type = cust", "", "");
  assertEquals("Account.Type values:", vm.autocompleteResults().title);
  assertEquals(["'Customer - Channel'", "'Customer - Direct'"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[1]);
  assertEquals("select Id from Account where Type = 'Customer - Direct' ", queryInput.value);

  // Autocomplete boolean value
  setQuery("select Id from Account where IsDeleted != ", "", "");
  assertEquals("Account.IsDeleted values:", vm.autocompleteResults().title);
  assertEquals(["false", "true"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[1]);
  assertEquals("select Id from Account where IsDeleted != true ", queryInput.value);

  // Autocomplete datetime value
  setQuery("select Id from Account where LastModifiedDate < TOD", "", " and IsDeleted = false");
  assertEquals("Account.LastModifiedDate values:", vm.autocompleteResults().title);
  assertEquals(["TODAY"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id from Account where LastModifiedDate < TODAY  and IsDeleted = false", queryInput.value);

  // Autocomplete object
  setQuery("select Id from OpportunityLi", "", "");
  assertEquals("Objects:", vm.autocompleteResults().title);
  assertEquals(["OpportunityLineItem"], getValues(vm.autocompleteResults().results));

  // Autocomplete unknown object
  setQuery("select Id from UnknownObj", "", "");
  assertEquals("Objects:", vm.autocompleteResults().title);
  assertEquals([], getValues(vm.autocompleteResults().results));

  // Autocomplete no from
  setQuery("select Id fr", "", "");
  assertEquals("\"from\" keyword not found", vm.autocompleteResults().title);
  assertEquals([], getValues(vm.autocompleteResults().results));

  // Autocomplete field name when cursor is just after the "from" keyword
  setQuery("select Id, nam", "", "from Account");
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals(["Name"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id, Name, from Account", queryInput.value);

  // Autocomplete upper case
  setQuery("SELECT ID, NAM", "", " FROM ACCOUNT");
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals(["Name"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("SELECT ID, Name,  FROM ACCOUNT", queryInput.value);

  // Autocomplete with "from" substring before the from keyword
  setQuery("select Id, FieldFrom, FromField, nam", "", " from Account");
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals(["Name"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id, FieldFrom, FromField, Name,  from Account", queryInput.value);

  // Autocomplete field value
  setQuery("select Id from Account where owner.profile.name = admini", "", "");
  assertEquals("Loading Profile metadata...", vm.autocompleteResults().title);
  assertEquals([], getValues(vm.autocompleteResults().results));
  yield waitForSpinner();
  assertEquals("Profile.Name values (Press Ctrl+Space):", vm.autocompleteResults().title);
  assertEquals([], getValues(vm.autocompleteResults().results));
  vm.queryAutocompleteHandler({ctrlSpace: true});
  assertEquals("Loading Profile.Name values...", vm.autocompleteResults().title);
  assertEquals([], getValues(vm.autocompleteResults().results));
  yield waitForSpinner();
  assertEquals("Profile.Name values:", vm.autocompleteResults().title);
  assertEquals(["'System Administrator'"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id from Account where owner.profile.name = 'System Administrator' ", queryInput.value);

  // Autocomplete field value error
  setQuery("select Id from Account where Id = foo", "", ""); // LIKE query not supported by Id field
  assertEquals("Account.Id values (Press Ctrl+Space):", vm.autocompleteResults().title);
  assertEquals([], getValues(vm.autocompleteResults().results));
  vm.queryAutocompleteHandler({ctrlSpace: true});
  assertEquals("Loading Account.Id values...", vm.autocompleteResults().title);
  assertEquals([], getValues(vm.autocompleteResults().results));
  yield waitForSpinner();
  assert(vm.autocompleteResults().title.indexOf("Error:") == 0);
  assertEquals([], getValues(vm.autocompleteResults().results));

  // Autocomplete field value unknown field
  setQuery("select Id from Account where UnknownField = ", "", "");
  assertEquals("Unknown field: Account.UnknownField", vm.autocompleteResults().title);
  assertEquals([], getValues(vm.autocompleteResults().results));

  // Autocomplete unknown relation
  setQuery("select Id from Account where UnknownRelation.FieldName", "", "");
  assertEquals("Unknown field: Account.UnknownRelation.", vm.autocompleteResults().title);
  assertEquals([], getValues(vm.autocompleteResults().results));

  // Autocomplete sort order
  setQuery("select Id", "", " from Account");
  assertEquals("Account fields:", vm.autocompleteResults().title);
  assertEquals("Id", getValues(vm.autocompleteResults().results)[0]);

  // Autocomplete before subquery
  setQuery("select Id from Opportunity where AccountId", "", " in (select AccountId from Asset where Price = null) and StageName = 'Closed Won'");
  yield waitForSpinner();
  assertEquals("Opportunity fields:", vm.autocompleteResults().title);

  // Autocomplete in subquery
  setQuery("select Id from Opportunity where AccountId in (select AccountId from Asset where Price", "", " = null) and StageName = 'Closed Won'");
  yield waitForSpinner();
  assertEquals("Asset fields:", vm.autocompleteResults().title);

  // Autocomplete after subquery
  setQuery("select Id from Opportunity where AccountId in (select AccountId from Asset where Price = null) and StageName", "", " = 'Closed Won'");
  assertEquals("Opportunity fields:", vm.autocompleteResults().title);

  // Autocomplete tooling API
  setQuery("select Id from ApexCla", "", "");
  vm.queryTooling(true);
  vm.queryAutocompleteHandler();
  yield waitForSpinner();
  assertEquals("Objects:", vm.autocompleteResults().title);
  assertEquals(["ApexClass", "ApexClassMember"], getValues(vm.autocompleteResults().results));
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("select Id from ApexClass ", queryInput.value);
  yield waitForSpinner();
  vm.queryTooling(false);
  vm.queryAutocompleteHandler();

  // Show describe
  assertEquals("ApexClass", vm.autocompleteResults().sobjectName);

  // Set up test records
  yield* anonApex(`
    delete [select Id from Inspector_Test__c];
    insert new Inspector_Test__c(Name = 'test1', Checkbox__c = false, Number__c = 100.01);
    insert new Inspector_Test__c(Name = 'test2', Checkbox__c = true, Number__c = 200.02, Lookup__r = new Inspector_Test__c(Name = 'test1'));
    insert new Inspector_Test__c(Name = 'test3', Checkbox__c = false, Number__c = 300.03);
    insert new Inspector_Test__c(Name = 'test4', Checkbox__c = true, Number__c = 400.04, Lookup__r = new Inspector_Test__c(Name = 'test3'));
  `);

  // Export data
  queryInput.value = "select Name, Checkbox__c, Number__c from Inspector_Test__c order by Name";
  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("Ready", vm.exportResult().exportStatus);
  assertEquals(null, vm.exportResult().exportedData);
  assertEquals(null, vm.exportResult().exportError);

  vm.doExport();

  assertEquals(true, vm.exportResult().isWorking);
  assertEquals("Exporting...", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  yield waitForSpinner();

  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("Exported 4 record(s).", vm.exportResult().exportStatus);
  assertEquals([
    ["_", "Name", "Checkbox__c", "Number__c"],
    [{type: "Inspector_Test__c"}, "test1", false, 100.01],
    [{type: "Inspector_Test__c"}, "test2", true, 200.02],
    [{type: "Inspector_Test__c"}, "test3", false, 300.03],
    [{type: "Inspector_Test__c"}, "test4", true, 400.04]
  ], vm.exportResult().exportedData.table.map(row => row.map(cell => cell && cell.attributes ? {type: cell.attributes.type} : cell)));
  assertEquals(null, vm.exportResult().exportError);
  assertEquals([true, true, true, true, true], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true, true, true, true], vm.exportResult().exportedData.colVisibilities);

  // Copy Excel
  assertEquals(true, vm.canCopy());
  vm.copyAsExcel();
  assertEquals('"_"\t"Name"\t"Checkbox__c"\t"Number__c"\r\n"[Inspector_Test__c]"\t"test1"\t"false"\t"100.01"\r\n"[Inspector_Test__c]"\t"test2"\t"true"\t"200.02"\r\n"[Inspector_Test__c]"\t"test3"\t"false"\t"300.03"\r\n"[Inspector_Test__c]"\t"test4"\t"true"\t"400.04"', clipboardValue);

  // Copy CSV
  vm.copyAsCsv();
  assertEquals('"_","Name","Checkbox__c","Number__c"\r\n"[Inspector_Test__c]","test1","false","100.01"\r\n"[Inspector_Test__c]","test2","true","200.02"\r\n"[Inspector_Test__c]","test3","false","300.03"\r\n"[Inspector_Test__c]","test4","true","400.04"', clipboardValue);

  // Copy JSON
  vm.copyAsJson();
  assert(clipboardValue.indexOf("Inspector_Test__c") > -1);

  // Filter results
  vm.setResultsFilter("TRU");
  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("Exported 4 record(s).", vm.exportResult().exportStatus);
  assertEquals([
    ["_", "Name", "Checkbox__c", "Number__c"],
    [{type: "Inspector_Test__c"}, "test1", false, 100.01],
    [{type: "Inspector_Test__c"}, "test2", true, 200.02],
    [{type: "Inspector_Test__c"}, "test3", false, 300.03],
    [{type: "Inspector_Test__c"}, "test4", true, 400.04]
  ], vm.exportResult().exportedData.table.map(row => row.map(cell => cell && cell.attributes ? {type: cell.attributes.type} : cell)));
  assertEquals(null, vm.exportResult().exportError);
  assertEquals([true, false, true, false, true], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true, true, true, true], vm.exportResult().exportedData.colVisibilities);

  // Clear filter
  vm.setResultsFilter("");
  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("Exported 4 record(s).", vm.exportResult().exportStatus);
  assertEquals([
    ["_", "Name", "Checkbox__c", "Number__c"],
    [{type: "Inspector_Test__c"}, "test1", false, 100.01],
    [{type: "Inspector_Test__c"}, "test2", true, 200.02],
    [{type: "Inspector_Test__c"}, "test3", false, 300.03],
    [{type: "Inspector_Test__c"}, "test4", true, 400.04]
  ], vm.exportResult().exportedData.table.map(row => row.map(cell => cell && cell.attributes ? {type: cell.attributes.type} : cell)));
  assertEquals(null, vm.exportResult().exportError);
  assertEquals([true, true, true, true, true], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true, true, true, true], vm.exportResult().exportedData.colVisibilities);

  // Export relationships
  queryInput.value = "select Name, Lookup__r.Name from Inspector_Test__c order by Name";

  vm.doExport();

  assertEquals(true, vm.exportResult().isWorking);
  assertEquals("Exporting...", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  yield waitForSpinner();

  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("Exported 4 record(s).", vm.exportResult().exportStatus);
  assertEquals([
    ["_", "Name", "Lookup__r", "Lookup__r.Name"],
    [{type: "Inspector_Test__c"}, "test1", null, null],
    [{type: "Inspector_Test__c"}, "test2", {type: "Inspector_Test__c"}, "test1"],
    [{type: "Inspector_Test__c"}, "test3", null, null],
    [{type: "Inspector_Test__c"}, "test4", {type: "Inspector_Test__c"}, "test3"]
  ], vm.exportResult().exportedData.table.map(row => row.map(cell => cell && cell.attributes ? {type: cell.attributes.type} : cell)));
  assertEquals(null, vm.exportResult().exportError);
  assertEquals([true, true, true, true, true], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true, true, true, true], vm.exportResult().exportedData.colVisibilities);

  // Export error
  queryInput.value = "select UnknownField from Inspector_Test__c";
  vm.doExport();
  yield waitForSpinner();
  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("Error", vm.exportResult().exportStatus);
  assertEquals(null, vm.exportResult().exportedData);
  assert(vm.exportResult().exportError.indexOf("UnknownField") > -1);

  // Export no data
  queryInput.value = "select Id from Inspector_Test__c where name = 'no such name'";

  vm.doExport();

  assertEquals(true, vm.exportResult().isWorking);
  assertEquals("Exporting...", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  yield waitForSpinner();

  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("No data exported.", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  // Export count
  queryInput.value = "select count() from Inspector_Test__c";

  vm.doExport();

  assertEquals(true, vm.exportResult().isWorking);
  assertEquals("Exporting...", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  yield waitForSpinner();

  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("No data exported. 4 record(s).", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  // Stop export
  queryInput.value = "select count() from Inspector_Test__c";

  vm.doExport();

  assertEquals(true, vm.exportResult().isWorking);
  assertEquals("Exporting...", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  vm.stopExport();
  yield waitForSpinner();

  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("No data exported.", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  // Set up test records
  yield* anonApex(`
    delete [select Id from Inspector_Test__c];
    List<Inspector_Test__c> records = new List<Inspector_Test__c>();
    for (Integer i = 0; i < 3000; i++) { // More than one batch when exporting (a batch is 2000)
      records.add(new Inspector_Test__c());
    }
    insert records;
  `);

  // Export many
  queryInput.value = "select Id from Inspector_Test__c";

  vm.doExport();

  assertEquals(true, vm.exportResult().isWorking);
  assertEquals("Exporting...", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  yield waitForSpinner();

  assertEquals(false, vm.exportResult().isWorking);
  assertEquals("Exported 3000 record(s).", vm.exportResult().exportStatus);
  assertEquals(3001, vm.exportResult().exportedData.table.length);
  assertEquals(3001, vm.exportResult().exportedData.rowVisibilities.length);
  assertEquals(2, vm.exportResult().exportedData.colVisibilities.length);
  assertEquals(null, vm.exportResult().exportError);

  // Set up test records
  yield* anonApex("delete [select Id from Inspector_Test__c];");

  // Query all
  vm.queryAll(true);
  queryInput.value = "select Id from Inspector_Test__c";

  vm.doExport();

  assertEquals(true, vm.exportResult().isWorking);
  assertEquals("Exporting...", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  yield waitForSpinner();

  assertEquals(false, vm.exportResult().isWorking);
  assert(vm.exportResult().exportStatus.indexOf("Exported") > -1);
  assert(vm.exportResult().exportedData.table.length > 3000);
  assert(vm.exportResult().exportedData.rowVisibilities.length > 3000);
  assertEquals(2, vm.exportResult().exportedData.colVisibilities.length);
  assertEquals(null, vm.exportResult().exportError);

  vm.queryAll(false);

  // Query tooling
  vm.queryTooling(true);
  vm.queryAutocompleteHandler();
  queryInput.value = "select Name from ApexClass";

  vm.doExport();

  assertEquals(true, vm.exportResult().isWorking);
  assertEquals("Exporting...", vm.exportResult().exportStatus);
  assertEquals([], vm.exportResult().exportedData.table);
  assertEquals([], vm.exportResult().exportedData.rowVisibilities);
  assertEquals([true], vm.exportResult().exportedData.colVisibilities);
  assertEquals(null, vm.exportResult().exportError);

  yield waitForSpinner();

  assertEquals(false, vm.exportResult().isWorking);
  assert(vm.exportResult().exportStatus.indexOf("Exported") > -1);
  assert(vm.exportResult().exportedData.table.length > 1);
  assert(vm.exportResult().exportedData.rowVisibilities.length > 1);
  assertEquals(2, vm.exportResult().exportedData.colVisibilities.length);
  assertEquals(null, vm.exportResult().exportError);

  vm.queryTooling(false);
  vm.queryAutocompleteHandler();

  // Query history
  assertEquals([
    {query: "select Name from ApexClass", useToolingApi: true},
    {query: "select Id from Inspector_Test__c", useToolingApi: false},
    {query: "select count() from Inspector_Test__c", useToolingApi: false},
    {query: "select Id from Inspector_Test__c where name = 'no such name'", useToolingApi: false},
    {query: "select Name, Lookup__r.Name from Inspector_Test__c order by Name", useToolingApi: false},
    {query: "select Name, Checkbox__c, Number__c from Inspector_Test__c order by Name", useToolingApi: false}
  ], vm.queryHistory.list());
  vm.selectedHistoryEntry(vm.queryHistory.list()[2]);
  vm.selectHistoryEntry();
  assertEquals("select count() from Inspector_Test__c", queryInput.value);
  vm.clearHistory();
  assertEquals([], vm.queryHistory.list());

  // Autocomplete load errors
  let restOrig = win.sfConn.rest;
  let restError = () => Promise.reject();

  // Autocomplete load errors for global describe
  setQuery("select Id from Acco", "", "");
  win.sfConn.rest = restError;
  vm.autocompleteReload();
  assertEquals("Loading metadata...", vm.autocompleteResults().title);
  assertEquals(0, vm.autocompleteResults().results.length);
  yield waitForSpinner();
  assertEquals("Loading metadata failed.", vm.autocompleteResults().title);
  assertEquals(1, vm.autocompleteResults().results.length);
  win.sfConn.rest = restOrig;
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("Loading metadata...", vm.autocompleteResults().title);
  assertEquals(0, vm.autocompleteResults().results.length);
  yield waitForSpinner();
  assertEquals("Objects:", vm.autocompleteResults().title);

  // Autocomplete load errors for object describe
  win.sfConn.rest = restError;
  setQuery("select Id", "", " from Account");
  assertEquals("Loading Account metadata...", vm.autocompleteResults().title);
  assertEquals(0, vm.autocompleteResults().results.length);
  yield waitForSpinner();
  assertEquals("Loading Account metadata failed.", vm.autocompleteResults().title);
  assertEquals(1, vm.autocompleteResults().results.length);
  win.sfConn.rest = restOrig;
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("Loading Account metadata...", vm.autocompleteResults().title);
  assertEquals(0, vm.autocompleteResults().results.length);
  yield waitForSpinner();
  assertEquals("Account fields:", vm.autocompleteResults().title);

  // Autocomplete load errors for relationship object describe
  win.sfConn.rest = restError;
  setQuery("select Id, OWNER.USERN", "", " from Account");
  assertEquals("Loading User metadata...", vm.autocompleteResults().title);
  assertEquals(0, vm.autocompleteResults().results.length);
  yield waitForSpinner();
  assertEquals("Loading User metadata failed.", vm.autocompleteResults().title);
  assertEquals(1, vm.autocompleteResults().results.length);
  win.sfConn.rest = restOrig;
  vm.autocompleteClick(vm.autocompleteResults().results[0]);
  assertEquals("Loading Account metadata...", vm.autocompleteResults().title);
  assertEquals(0, vm.autocompleteResults().results.length);
  yield waitForSpinner();
  assertEquals("User fields:", vm.autocompleteResults().title);

}
