function* dataExportTest() {
  console.log("TEST dataExportVm");

  var queryInput = {value: "", selectionStart: 0, selectionEnd: 0};
  function setQuery(a, b, c) {
    queryInput.value = a + b + c;
    queryInput.selectionStart = a.length;
    queryInput.selectionEnd = a.length + b.length;
    vm.queryAutocompleteHandler();
  }
  var queryInputVm = {
    setValue: function(v) { queryInput.value = v; },
    getValue: function() { return queryInput.value; },
    getSelStart: function() { return queryInput.selectionStart; },
    getSelEnd: function() { return queryInput.selectionEnd; },
    insertText: function(text, selStart, selEnd) {
      queryInput.value = queryInput.value.substring(0, selStart) + text + queryInput.value.substring(selEnd);
      queryInput.selectionStart = queryInput.selectionEnd = selStart + text.length;
    }
  };

  var queryHistory;
  var queryHistoryStorage = {
    get: function() { return queryHistory; },
    set: function(v) { queryHistory = v; },
    clear: function() { queryHistory = undefined; }
  };

  var vm = dataExportVm({}, queryInputVm, queryHistoryStorage);

  function waitForSpinner() {
    return new Promise(function(resolve, reject) {
      var subs = vm.spinnerCount.subscribe(function(count) {
        if (count == 0) {
          subs.dispose();
          resolve();
        }
      });
    });
  }

  function getValues(list) {
    return list.map(function(el) { return el.value; });
  }

  assertEquals("select Id from Account", queryInput.value);
  queryInput.selectionStart = queryInput.selectionEnd = "select Id from Account".length; // When the cursor is placed after object name, we will try to autocomplete that once the global describe loads, and we will not try to load object field describes, so we can test loading those separately

  // Load global describe and user info
  yield waitForSpinner();

  // Autocomplete object names
  vm.queryAutocompleteHandler();
  assertEquals("Objects:", vm.autocompleteTitle());
  assertEquals(["Account", "AccountContactRole"], getValues(vm.autocompleteResults()).slice(0, 2));

  // See user info
  assert(vm.userInfo().indexOf(" / ") > -1);

  // Autocomplete field name in SELECT with no field metadata
  setQuery("select Id, nam", "", " from Account");
  assertEquals("Loading metadata for object: Account", vm.autocompleteTitle());
  assertEquals([], vm.autocompleteResults());

  // Load Account field describe
  yield waitForSpinner();

  // Autocomplete field name in SELECT, sould automatically update when describe call completes
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertEquals(["Name"], getValues(vm.autocompleteResults()));
  
  // Select autocomplete value in SELECT
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id, Name,  from Account", queryInput.value);
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertNotEquals(["Name"], getValues(vm.autocompleteResults()));
  
  // Select multiple values in SELECT using Ctrl+Space
  setQuery("select Id, shipp", "", " from Account");
  assertEquals("select Id, shipp from Account", queryInput.value);
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertEquals(["ShippingStreet", "ShippingCity", "ShippingState", "ShippingPostalCode", "ShippingCountry", "ShippingLatitude", "ShippingLongitude", "ShippingAddress"], getValues(vm.autocompleteResults()));
  vm.queryAutocompleteHandler({ctrlSpace: true});
  assertEquals("select Id, ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry, ShippingLatitude, ShippingLongitude, ShippingAddress,  from Account", queryInput.value);
  
  // Autocomplete relationship field in SELECT
  setQuery("select Id, OWNE", "", " from Account");
  assertEquals("select Id, OWNE from Account", queryInput.value);
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertEquals(["Ownership", "OwnerId", "Owner."], getValues(vm.autocompleteResults()));
  // Select relationship field in SELECT
  vm.autocompleteClick(vm.autocompleteResults()[2]);
  assertEquals("select Id, Owner. from Account", queryInput.value);
  assertEquals("Loading metadata...", vm.autocompleteTitle());
  assertEquals([], vm.autocompleteResults());

  // Load User field describe
  yield waitForSpinner();
  assertEquals("User fields:", vm.autocompleteTitle());

  // Autocomplete related field in SELECT
  setQuery("select Id, OWNER.USERN", "", " from Account");
  assertEquals("User fields:", vm.autocompleteTitle());
  assertEquals(["Username"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id, OWNER.Username,  from Account", queryInput.value);

  // Autocomplete function
  setQuery("select Id, Count_di", "", " from Account");
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertEquals(["COUNT_DISTINCT"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id, COUNT_DISTINCT( from Account", queryInput.value);

  // Autocomplete field in function
  setQuery("select Id, count(nam", "", " from Account");
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertEquals(["Name"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id, count(Name,  from Account", queryInput.value); // not ideal suffix

  // Autocomplete field in WHERE
  setQuery("select Id from Account where sic", "", "");
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertEquals(["Sic", "SicDesc"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id from Account where Sic ", queryInput.value);

  // Autocomplete picklist value
  setQuery("select Id from Account where Type = cust", "", "");
  assertEquals("Account.Type values:", vm.autocompleteTitle());
  assertEquals(["'Customer - Direct'", "'Customer - Channel'"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[1]);
  assertEquals("select Id from Account where Type = 'Customer - Channel' ", queryInput.value);

  // Autocomplete boolean value
  setQuery("select Id from Account where IsDeleted != ", "", "");
  assertEquals("Account.IsDeleted values:", vm.autocompleteTitle());
  assertEquals(["true", "false"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id from Account where IsDeleted != true ", queryInput.value);

  // Autocomplete datetime value
  setQuery("select Id from Account where LastModifiedDate < TOD", "", " and IsDeleted = false");
  assertEquals("Account.LastModifiedDate values:", vm.autocompleteTitle());
  assertEquals(["TODAY"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id from Account where LastModifiedDate < TODAY  and IsDeleted = false", queryInput.value);

  // Autocomplete object
  setQuery("select Id from OpportunityLi", "", "");
  assertEquals("Objects:", vm.autocompleteTitle());
  assertEquals(["OpportunityLineItem"], getValues(vm.autocompleteResults()));

  // Autocomplete unknown object
  setQuery("select Id from UnknownObj", "", "");
  assertEquals("Objects:", vm.autocompleteTitle());
  assertEquals([], getValues(vm.autocompleteResults()));

  // Autocomplete no from
  setQuery("select Id fr", "", "");
  assertEquals("\"from\" keyword not found", vm.autocompleteTitle());
  assertEquals([], getValues(vm.autocompleteResults()));

  // Autocomplete field name when cursor is just after the "from" keyword
  setQuery("select Id, nam", "", "from Account");
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertEquals(["Name"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id, Name, from Account", queryInput.value);

  // Autocomplete upper case
  setQuery("SELECT ID, NAM", "", " FROM ACCOUNT");
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertEquals(["Name"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("SELECT ID, Name,  FROM ACCOUNT", queryInput.value);

  // Autocomplete with "from" substring before the from keyword
  setQuery("select Id, FieldFrom, FromField, nam", "", " from Account");
  assertEquals("Account fields:", vm.autocompleteTitle());
  assertEquals(["Name"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id, FieldFrom, FromField, Name,  from Account", queryInput.value);

  // Autocomplete field value
  setQuery("select Id from Account where owner.profile.name = admini", "", "");
  assertEquals("Loading metadata...", vm.autocompleteTitle());
  assertEquals([], getValues(vm.autocompleteResults()));
  yield waitForSpinner();
  assertEquals("Profile.Name values (Press Ctrl+Space):", vm.autocompleteTitle());
  assertEquals([], getValues(vm.autocompleteResults()));
  vm.queryAutocompleteHandler({ctrlSpace: true});
  assertEquals("Loading Profile.Name values...", vm.autocompleteTitle());
  assertEquals([], getValues(vm.autocompleteResults()));
  yield waitForSpinner();
  assertEquals("Profile.Name values:", vm.autocompleteTitle());
  assertEquals(["'System Administrator'"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id from Account where owner.profile.name = 'System Administrator' ", queryInput.value);

  // Autocomplete field value error
  setQuery("select Id from Account where Id = foo", "", ""); // LIKE query not supported by Id field
  assertEquals("Account.Id values (Press Ctrl+Space):", vm.autocompleteTitle());
  assertEquals([], getValues(vm.autocompleteResults()));
  vm.queryAutocompleteHandler({ctrlSpace: true});
  assertEquals("Loading Account.Id values...", vm.autocompleteTitle());
  assertEquals([], getValues(vm.autocompleteResults()));
  yield waitForSpinner();
  assert(vm.autocompleteTitle().indexOf("Error:") == 0);
  assertEquals([], getValues(vm.autocompleteResults()));

  // Autocomplete field value unknown field
  setQuery("select Id from Account where UnknownField = ", "", "");
  assertEquals("Unknown field: Account.UnknownField", vm.autocompleteTitle());
  assertEquals([], getValues(vm.autocompleteResults()));

  // Autocomplete unknown relation
  setQuery("select Id from Account where UnknownRelation.FieldName", "", "");
  assertEquals("Unknown field: Account.UnknownRelation.", vm.autocompleteTitle());
  assertEquals([], getValues(vm.autocompleteResults()));

  // Autocomplete tooling API
  setQuery("select Id from ApexCla", "", "");
  vm.queryTooling(true);
  assertEquals("Objects:", vm.autocompleteTitle());
  assertEquals(["ApexClass", "ApexClassMember"], getValues(vm.autocompleteResults()));
  vm.autocompleteClick(vm.autocompleteResults()[0]);
  assertEquals("select Id from ApexClass ", queryInput.value);
  yield waitForSpinner();
  vm.queryTooling(false);

  // Show describe
  assertEquals("ApexClass", vm.sobjectName());

  // Set up test records
  yield vfRemoteAction(InspectorUnitTest.setTestRecords, [
    {Name: "test1", Checkbox__c: false, Number__c: 100.01},
    {Name: "test2", Checkbox__c: true, Number__c: 200.02, Lookup__r: {Name: "test1"}},
    {Name: "test3", Checkbox__c: false, Number__c: 300.03},
    {Name: "test4", Checkbox__c: true, Number__c: 400.04, Lookup__r: {Name: "test3"}}
  ]);

  // Export data
  queryInput.value = "select Name, Checkbox__c, Number__c from Inspector_Test__c order by Name";
  assertEquals("excel", vm.dataFormat());
  vm.doExport();
  assert(vm.exportResultVm().isWorking);
  assert(!vm.exportResultVm().resultTable);
  assertEquals("Exporting...", vm.exportResultVm().resultText);
  yield waitForSpinner();
  assert(!vm.exportResultVm().isWorking);
  assert(!vm.exportResultVm().resultTable);
  assertEquals('"Name"\t"Checkbox__c"\t"Number__c"\r\n"test1"\t"false"\t"100.01"\r\n"test2"\t"true"\t"200.02"\r\n"test3"\t"false"\t"300.03"\r\n"test4"\t"true"\t"400.04"', vm.exportResultVm().resultText);

  // Format CSV
  vm.dataFormat("csv");
  assert(!vm.exportResultVm().resultTable);
  assertEquals('"Name","Checkbox__c","Number__c"\r\n"test1","false","100.01"\r\n"test2","true","200.02"\r\n"test3","false","300.03"\r\n"test4","true","400.04"', vm.exportResultVm().resultText);

  // Format JSON
  vm.dataFormat("json");
  assert(!vm.exportResultVm().resultTable);
  assert(vm.exportResultVm().resultText.indexOf("Inspector_Test__c") > -1);

  // Format Table
  vm.dataFormat("table");
  assert(vm.exportResultVm().resultTable);
  assertEquals({
    header: ["Name", "Checkbox__c", "Number__c"],
    data: [
      {cells: ["test1", false, 100.01], openAllData: undefined},
      {cells: ["test2", true, 200.02], openAllData: undefined},
      {cells: ["test3", false, 300.03], openAllData: undefined},
      {cells: ["test4", true, 400.04], openAllData: undefined}
    ]
  }, vm.exportResultVm().resultTable);

  vm.dataFormat("csv");

  // Export relationships
  queryInput.value = "select Name, Lookup__r.Name from Inspector_Test__c order by Name";
  vm.doExport();
  yield waitForSpinner();
  assert(!vm.exportResultVm().resultTable);
  assertEquals('"Name","Lookup__r","Lookup__r.Name"\r\n"test1","",""\r\n"test2","[Inspector_Test__c]","test1"\r\n"test3","",""\r\n"test4","[Inspector_Test__c]","test3"', vm.exportResultVm().resultText);

  // Export error
  queryInput.value = "select UnknownField from Inspector_Test__c";
  vm.doExport();
  yield waitForSpinner();
  assert(!vm.exportResultVm().resultTable);
  assertEquals("=== ERROR ===", vm.exportResultVm().resultText.split("\n")[0]);

  // Export no data
  queryInput.value = "select Id from Inspector_Test__c where name = 'no such name'";
  vm.doExport();
  yield waitForSpinner();
  assert(!vm.exportResultVm().resultTable);
  assertEquals("No data exported.", vm.exportResultVm().resultText);

  // Export count
  queryInput.value = "select count() from Inspector_Test__c";
  vm.doExport();
  yield waitForSpinner();
  assert(!vm.exportResultVm().resultTable);
  assertEquals("No data exported. 4 record(s).", vm.exportResultVm().resultText);

  // Stop export
  queryInput.value = "select count() from Inspector_Test__c";
  vm.doExport();
  assert(vm.exportResultVm().isWorking);
  vm.stopExport();
  yield waitForSpinner();
  assert(!vm.exportResultVm().isWorking);
  assert(!vm.exportResultVm().resultTable);
  assertEquals("No data exported.", vm.exportResultVm().resultText);

  // Set up test records
  yield vfRemoteAction(InspectorUnitTest.setTestRecordCount, 3000); // More than one batch when exporting (a batch is 2000)

  // Export many
  queryInput.value = "select Id from Inspector_Test__c";
  vm.doExport();
  yield waitForSpinner();
  assert(!vm.exportResultVm().resultTable);
  assertEquals('"Id"'.length + 3000 * '\r\n"123456789012345678"'.length, vm.exportResultVm().resultText.length);

  // Set up test records
  yield vfRemoteAction(InspectorUnitTest.setTestRecords, []);

  // Query all
  vm.queryAll(true);
  queryInput.value = "select Id from Inspector_Test__c";
  vm.doExport();
  yield waitForSpinner();
  assert(!vm.exportResultVm().resultTable);
  assert(vm.exportResultVm().resultText.length > 30000); // Result contains lots of records, at least the 3000 we just deleted
  vm.queryAll(false);

  // Query tooling
  vm.queryTooling(true);
  queryInput.value = "select Name from ApexClass";
  vm.doExport();
  yield waitForSpinner();
  assert(!vm.exportResultVm().resultTable);
  assert(vm.exportResultVm().resultText.indexOf('"Name"') == 0); // Result is not an error value
  vm.queryTooling(false);

  // Query history
  assertEquals(["select Name from ApexClass","select Id from Inspector_Test__c","select count() from Inspector_Test__c","select Id from Inspector_Test__c where name = 'no such name'","select Name, Lookup__r.Name from Inspector_Test__c order by Name","select Name, Checkbox__c, Number__c from Inspector_Test__c order by Name"], vm.queryHistory());
  vm.selectedHistoryEntry(vm.queryHistory()[2]);
  vm.selectHistoryEntry();
  assertEquals("select count() from Inspector_Test__c", queryInput.value);
  vm.clearHistory();
  assertEquals([], vm.queryHistory());
}
