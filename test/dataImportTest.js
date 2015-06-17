function* dataImportTest() {
  console.log("TEST dataImportVm");

  var dataInput = {value: "", selectionStart: 0, selectionEnd: 0};
  var dataInputVm = {
    setSelectionRange: function(offsetStart, offsetEnd) { dataInput.selectionStart = offsetStart; dataInput.selectionEnd = offsetEnd; },
    getValue: function() { return dataInput.value; }
  };

  var vm = dataImportVm(dataInputVm);

  // Simulate what applyBindings does
  ko.computed(vm.idLookupList);
  ko.computed(vm.columnList);

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

  function getRecords(result) {
    for (var record of result.records) {
      record.attributes = undefined
      if (record.Lookup__r) {
        record.Lookup__r.attributes = undefined;
      }
    }
    return result.records;
  }

  vm.importType("Inspector_Test__c");

  yield waitForSpinner();

  // Autocomplete lists
  assert(vm.sobjectList().indexOf("Inspector_Test__c") > -1);
  assertEquals(["Id", "Name"], vm.idLookupList());
  assertEquals(["Id","OwnerId","Owner:Group:Id","Owner:Group:Name","Owner:User:Id","Owner:User:Username","Owner:User:Email","Owner:User:FederationIdentifier","Name","Checkbox__c","Number__c","Lookup__c","Lookup__r:Inspector_Test__c:Id","Lookup__r:Inspector_Test__c:Name","__Status","__Id","__Action","__Errors"], vm.columnList());

  // See user info
  assert(vm.userInfo().indexOf(" / ") > -1);

  // Set up test records
  yield vfRemoteAction(InspectorUnitTest.setTestRecords, [
    {Name: "test1", Checkbox__c: false, Number__c: 100.01},
    {Name: "test2", Checkbox__c: true, Number__c: 200.02}
  ]);
  var records;

  // Create csv
  vm.dataFormat("csv");
  vm.importAction("create");
  assertEquals(null, vm.confirmPopup());
  assertEquals(0, vm.activeBatches());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "", hasMore: null}, vm.importResult());
  vm.dataResultFormat("csv");
  dataInput.value = '"Name","Checkbox__c","Number__c","Lookup__r:Inspector_Test__c:Name"\r\n"test3","false","300.03",""\r\ntest4,false,400.04,test1\r\ntest5,true,500.05,\r\n"test6","true","600.06","notfound"';
  vm.doImport();
  assertEquals({text: "4 records will be imported.", action: undefined}, vm.confirmPopup());
  assertEquals(0, vm.activeBatches());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "", hasMore: null}, vm.importResult());
  vm.confirmPopupNo();
  assertEquals(null, vm.confirmPopup());
  assertEquals(0, vm.activeBatches());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "", hasMore: null}, vm.importResult());
  vm.doImport();
  assertEquals({text: "4 records will be imported.", action: undefined}, vm.confirmPopup());
  assertEquals(0, vm.activeBatches());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "", hasMore: null}, vm.importResult());
  vm.confirmPopupYes();
  assertEquals(null, vm.confirmPopup());
  assertEquals(1, vm.activeBatches());
  assertEquals({counts: {Queued: 0, Processing: 4, Succeeded: 0, Failed: 0, Canceled: 0}, text: '"Name","Checkbox__c","Number__c","Lookup__r:Inspector_Test__c:Name","__Status","__Id","__Action","__Errors"\r\n"test3","false","300.03","","Processing","","",""\r\n"test4","false","400.04","test1","Processing","","",""\r\n"test5","true","500.05","","Processing","","",""\r\n"test6","true","600.06","notfound","Processing","","",""', hasMore: null}, vm.importResult());
  yield waitForSpinner();
  assertEquals(null, vm.confirmPopup());
  assertEquals(0, vm.activeBatches());
  assertEquals({Queued: 0, Processing: 0, Succeeded: 3, Failed: 1, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Name","Checkbox__c","Number__c","Lookup__r:Inspector_Test__c:Name","__Status","__Id","__Action","__Errors"\r\n"test3","false","300.03","","Succeeded","123456789012345678","Inserted",""\r\n"test4","false","400.04","test1","Succeeded","123456789012345678","Inserted",""\r\n"test5","true","500.05","","Succeeded","123456789012345678","Inserted",""\r\n"test6","true","600.06","notfound","Failed","","","INVALID_FIELD: Foreign key external ID: notfound not found for field Name in entity Inspector_Test__c []"', vm.importResult().text.replace(/"[a-z+-9]{18}"/ig, '"123456789012345678"'));
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Name, Checkbox__c, Number__c, Lookup__r.Name from Inspector_Test__c order by Name")));
  assertEquals([
    {Name: "test1", Checkbox__c: false, Number__c: 100.01, Lookup__r: null},
    {Name: "test2", Checkbox__c: true, Number__c: 200.02, Lookup__r: null},
    {Name: "test3", Checkbox__c: false, Number__c: 300.03, Lookup__r: null},
    {Name: "test4", Checkbox__c: false, Number__c: 400.04, Lookup__r: {Name: "test1"}},
    {Name: "test5", Checkbox__c: true, Number__c: 500.05, Lookup__r: null}
  ], records);


  // Create excel
  vm.dataFormat("excel");
  vm.importAction("create");
  vm.dataResultFormat("excel");
  dataInput.value = '"Name"\t"Number__c"\r\ntest6\t600.06\r\n"test7"\t"700.07"\r\n';
  vm.doImport();
  assertEquals({text: "2 records will be imported.", action: undefined}, vm.confirmPopup());
  vm.confirmPopupYes();
  assertEquals(null, vm.confirmPopup());
  assertEquals('"Name"\t"Number__c"\t"__Status"\t"__Id"\t"__Action"\t"__Errors"\r\n"test6"\t"600.06"\t"Processing"\t""\t""\t""\r\n"test7"\t"700.07"\t"Processing"\t""\t""\t""', vm.importResult().text);
  yield waitForSpinner();
  assertEquals({Queued: 0, Processing: 0, Succeeded: 2, Failed: 0, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Name"\t"Number__c"\t"__Status"\t"__Id"\t"__Action"\t"__Errors"\r\n"test6"\t"600.06"\t"Succeeded"\t"123456789012345678"\t"Inserted"\t""\r\n"test7"\t"700.07"\t"Succeeded"\t"123456789012345678"\t"Inserted"\t""', vm.importResult().text.replace(/"[a-z+-9]{18}"/ig, '"123456789012345678"'));
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Name, Checkbox__c, Number__c, Lookup__r.Name from Inspector_Test__c order by Name")));
  assertEquals([
    {Name: "test1", Checkbox__c: false, Number__c: 100.01, Lookup__r: null},
    {Name: "test2", Checkbox__c: true, Number__c: 200.02, Lookup__r: null},
    {Name: "test3", Checkbox__c: false, Number__c: 300.03, Lookup__r: null},
    {Name: "test4", Checkbox__c: false, Number__c: 400.04, Lookup__r: {Name: "test1"}},
    {Name: "test5", Checkbox__c: true, Number__c: 500.05, Lookup__r: null},
    {Name: "test6", Checkbox__c: false, Number__c: 600.06, Lookup__r: null},
    {Name: "test7", Checkbox__c: false, Number__c: 700.07, Lookup__r: null}
  ], records);

  // Update csv
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Id from Inspector_Test__c order by Name")));
  vm.dataFormat("csv");
  vm.importAction("update");
  vm.dataResultFormat("csv");
  dataInput.value = 'Id,Name,Number__c\r\n' + records[4].Id + ',test5update,500.50\r\n' + records[5].Id + ',test6update,600.60\r\n';
  vm.doImport();
  assertEquals({text: "2 records will be imported.", action: undefined}, vm.confirmPopup());
  vm.confirmPopupYes();
  assertEquals('"Id","Name","Number__c","__Status","__Id","__Action","__Errors"\r\n"' + records[4].Id + '","test5update","500.50","Processing","","",""\r\n"' + records[5].Id + '","test6update","600.60","Processing","","",""', vm.importResult().text);
  yield waitForSpinner();
  assertEquals({Queued: 0, Processing: 0, Succeeded: 2, Failed: 0, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Id","Name","Number__c","__Status","__Id","__Action","__Errors"\r\n"' + records[4].Id + '","test5update","500.50","Succeeded","' + records[4].Id + '","Updated",""\r\n"' + records[5].Id + '","test6update","600.60","Succeeded","' + records[5].Id + '","Updated",""', vm.importResult().text);
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Name, Checkbox__c, Number__c, Lookup__r.Name from Inspector_Test__c order by Name")));
  assertEquals([
    {Name: "test1", Checkbox__c: false, Number__c: 100.01, Lookup__r: null},
    {Name: "test2", Checkbox__c: true, Number__c: 200.02, Lookup__r: null},
    {Name: "test3", Checkbox__c: false, Number__c: 300.03, Lookup__r: null},
    {Name: "test4", Checkbox__c: false, Number__c: 400.04, Lookup__r: {Name: "test1"}},
    {Name: "test5update", Checkbox__c: true, Number__c: 500.50, Lookup__r: null},
    {Name: "test6update", Checkbox__c: false, Number__c: 600.60, Lookup__r: null},
    {Name: "test7", Checkbox__c: false, Number__c: 700.07, Lookup__r: null}
  ], records);

  // Delete csv (with ignored column and status column)
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Id from Inspector_Test__c order by Name")));
  vm.dataFormat("csv");
  vm.importAction("delete");
  vm.dataResultFormat("csv");
  dataInput.value = 'Id,_foo*,__Status\r\n' + records[5].Id + ',foo,Canceled\r\n' + records[6].Id + ',foo,Succeeded';
  vm.doImport();
  assertEquals({text: "1 records will be imported. 1 records will be skipped because they have __Status Succeeded.", action: undefined}, vm.confirmPopup());
  vm.confirmPopupYes();
  assertEquals({Queued: 0, Processing: 1, Succeeded: 1, Failed: 0, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Id","_foo*","__Status","__Id","__Action","__Errors"\r\n"' + records[5].Id + '","foo","Processing","","",""\r\n"' + records[6].Id + '","foo","Succeeded","","",""', vm.importResult().text);
  yield waitForSpinner();
  assertEquals({Queued: 0, Processing: 0, Succeeded: 2, Failed: 0, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Id","_foo*","__Status","__Id","__Action","__Errors"\r\n"' + records[5].Id + '","foo","Succeeded","' + records[5].Id + '","Deleted",""\r\n"' + records[6].Id + '","foo","Succeeded","","",""', vm.importResult().text);
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Name, Checkbox__c, Number__c, Lookup__r.Name from Inspector_Test__c order by Name")));
  assertEquals([
    {Name: "test1", Checkbox__c: false, Number__c: 100.01, Lookup__r: null},
    {Name: "test2", Checkbox__c: true, Number__c: 200.02, Lookup__r: null},
    {Name: "test3", Checkbox__c: false, Number__c: 300.03, Lookup__r: null},
    {Name: "test4", Checkbox__c: false, Number__c: 400.04, Lookup__r: {Name: "test1"}},
    {Name: "test5update", Checkbox__c: true, Number__c: 500.50, Lookup__r: null},
    {Name: "test7", Checkbox__c: false, Number__c: 700.07, Lookup__r: null}
  ], records);

  // Upsert csv
  vm.dataFormat("csv");
  vm.importAction("upsert");
  vm.externalId("Name");
  vm.dataResultFormat("csv");
  dataInput.value = 'Name,Number__c\r\ntest2,222\r\ntest6,666\r\n';
  vm.doImport();
  assertEquals({text: "2 records will be imported.", action: undefined}, vm.confirmPopup());
  vm.confirmPopupYes();
  assertEquals('"Name","Number__c","__Status","__Id","__Action","__Errors"\r\n"test2","222","Processing","","",""\r\n"test6","666","Processing","","",""', vm.importResult().text);
  yield waitForSpinner();
  assertEquals({Queued: 0, Processing: 0, Succeeded: 2, Failed: 0, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Name","Number__c","__Status","__Id","__Action","__Errors"\r\n"test2","222","Succeeded","123456789012345678","Updated",""\r\n"test6","666","Succeeded","123456789012345678","Inserted",""', vm.importResult().text.replace(/"[a-z+-9]{18}"/ig, '"123456789012345678"'));
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Name, Checkbox__c, Number__c, Lookup__r.Name from Inspector_Test__c order by Name")));
  assertEquals([
    {Name: "test1", Checkbox__c: false, Number__c: 100.01, Lookup__r: null},
    {Name: "test2", Checkbox__c: true, Number__c: 222, Lookup__r: null},
    {Name: "test3", Checkbox__c: false, Number__c: 300.03, Lookup__r: null},
    {Name: "test4", Checkbox__c: false, Number__c: 400.04, Lookup__r: {Name: "test1"}},
    {Name: "test5update", Checkbox__c: true, Number__c: 500.50, Lookup__r: null},
    {Name: "test6", Checkbox__c: false, Number__c: 666, Lookup__r: null},
    {Name: "test7", Checkbox__c: false, Number__c: 700.07, Lookup__r: null}
  ], records);

  // Create multiple batches
  yield vfRemoteAction(InspectorUnitTest.setTestRecords, []);
  vm.dataFormat("csv");
  vm.importAction("create");
  vm.dataResultFormat("csv");
  vm.batchSize("3");
  vm.batchConcurrency("2");
  dataInput.value = 'Name\r\ntest10\r\ntest11\r\ntest12\r\ntest13\r\ntest14\r\ntest15\r\ntest16\r\ntest17\r\ntest18\r\ntest19\r\ntest20\r\ntest21\r\ntest22\r\ntest23\r\ntest24\r\ntest25';
  vm.doImport();
  assertEquals({text: "16 records will be imported.", action: undefined}, vm.confirmPopup());
  vm.confirmPopupYes();
  assertEquals(null, vm.confirmPopup());
  assertEquals({Queued: 10, Processing: 6, Succeeded: 0, Failed: 0, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Name","__Status","__Id","__Action","__Errors"\r\n"test10","Processing","","",""\r\n"test11","Processing","","",""\r\n"test12","Processing","","",""\r\n"test13","Processing","","",""\r\n"test14","Processing","","",""\r\n"test15","Processing","","",""\r\n"test16","Queued","","",""\r\n"test17","Queued","","",""\r\n"test18","Queued","","",""\r\n"test19","Queued","","",""\r\n"test20","Queued","","",""\r\n"test21","Queued","","",""\r\n"test22","Queued","","",""\r\n"test23","Queued","","",""\r\n"test24","Queued","","",""\r\n"test25","Queued","","",""', vm.importResult().text);
  yield waitForSpinner();
  assertEquals({Queued: 0, Processing: 0, Succeeded: 16, Failed: 0, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Name","__Status","__Id","__Action","__Errors"\r\n"test10","Succeeded","123456789012345678","Inserted",""\r\n"test11","Succeeded","123456789012345678","Inserted",""\r\n"test12","Succeeded","123456789012345678","Inserted",""\r\n"test13","Succeeded","123456789012345678","Inserted",""\r\n"test14","Succeeded","123456789012345678","Inserted",""\r\n"test15","Succeeded","123456789012345678","Inserted",""\r\n"test16","Succeeded","123456789012345678","Inserted",""\r\n"test17","Succeeded","123456789012345678","Inserted",""\r\n"test18","Succeeded","123456789012345678","Inserted",""\r\n"test19","Succeeded","123456789012345678","Inserted",""\r\n"test20","Succeeded","123456789012345678","Inserted",""\r\n"test21","Succeeded","123456789012345678","Inserted",""\r\n"test22","Succeeded","123456789012345678","Inserted",""\r\n"test23","Succeeded","123456789012345678","Inserted",""\r\n"test24","Succeeded","123456789012345678","Inserted",""\r\n"test25","Succeeded","123456789012345678","Inserted",""', vm.importResult().text.replace(/"[a-z+-9]{18}"/ig, '"123456789012345678"'));
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Name from Inspector_Test__c order by Name")));
  assertEquals([
    {Name: "test10"}, {Name: "test11"}, {Name: "test12"}, {Name: "test13"}, {Name: "test14"}, {Name: "test15"}, {Name: "test16"}, {Name: "test17"}, {Name: "test18"}, {Name: "test19"}, {Name: "test20"}, {Name: "test21"}, {Name: "test22"}, {Name: "test23"}, {Name: "test24"}, {Name: "test25"}
  ], records);

  // Stop import
  yield vfRemoteAction(InspectorUnitTest.setTestRecords, []);
  vm.dataFormat("csv");
  vm.importAction("create");
  vm.dataResultFormat("csv");
  vm.batchSize("3");
  vm.batchConcurrency("2");
  dataInput.value = 'Name\r\ntest10\r\ntest11\r\ntest12\r\ntest13\r\ntest14\r\ntest15\r\ntest16\r\ntest17\r\ntest18\r\ntest19\r\ntest20\r\ntest21\r\ntest22\r\ntest23\r\ntest24\r\ntest25';
  vm.doImport();
  assertEquals({text: "16 records will be imported.", action: undefined}, vm.confirmPopup());
  vm.confirmPopupYes();
  assertEquals(null, vm.confirmPopup());
  assertNotEquals(0, vm.activeBatches());
  assertEquals({Queued: 10, Processing: 6, Succeeded: 0, Failed: 0, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Name","__Status","__Id","__Action","__Errors"\r\n"test10","Processing","","",""\r\n"test11","Processing","","",""\r\n"test12","Processing","","",""\r\n"test13","Processing","","",""\r\n"test14","Processing","","",""\r\n"test15","Processing","","",""\r\n"test16","Queued","","",""\r\n"test17","Queued","","",""\r\n"test18","Queued","","",""\r\n"test19","Queued","","",""\r\n"test20","Queued","","",""\r\n"test21","Queued","","",""\r\n"test22","Queued","","",""\r\n"test23","Queued","","",""\r\n"test24","Queued","","",""\r\n"test25","Queued","","",""', vm.importResult().text);
  vm.stopImport();
  assertNotEquals(0, vm.activeBatches());
  assertEquals({Queued: 0, Processing: 6, Succeeded: 0, Failed: 0, Canceled: 10}, vm.importResult().counts);
  assertEquals('"Name","__Status","__Id","__Action","__Errors"\r\n"test10","Processing","","",""\r\n"test11","Processing","","",""\r\n"test12","Processing","","",""\r\n"test13","Processing","","",""\r\n"test14","Processing","","",""\r\n"test15","Processing","","",""\r\n"test16","Canceled","","",""\r\n"test17","Canceled","","",""\r\n"test18","Canceled","","",""\r\n"test19","Canceled","","",""\r\n"test20","Canceled","","",""\r\n"test21","Canceled","","",""\r\n"test22","Canceled","","",""\r\n"test23","Canceled","","",""\r\n"test24","Canceled","","",""\r\n"test25","Canceled","","",""', vm.importResult().text);
  yield waitForSpinner();
  assertEquals(0, vm.activeBatches());
  assertEquals({Queued: 0, Processing: 0, Succeeded: 6, Failed: 0, Canceled: 10}, vm.importResult().counts);
assertEquals('"Name","__Status","__Id","__Action","__Errors"\r\n"test10","Succeeded","123456789012345678","Inserted",""\r\n"test11","Succeeded","123456789012345678","Inserted",""\r\n"test12","Succeeded","123456789012345678","Inserted",""\r\n"test13","Succeeded","123456789012345678","Inserted",""\r\n"test14","Succeeded","123456789012345678","Inserted",""\r\n"test15","Succeeded","123456789012345678","Inserted",""\r\n"test16","Canceled","","",""\r\n"test17","Canceled","","",""\r\n"test18","Canceled","","",""\r\n"test19","Canceled","","",""\r\n"test20","Canceled","","",""\r\n"test21","Canceled","","",""\r\n"test22","Canceled","","",""\r\n"test23","Canceled","","",""\r\n"test24","Canceled","","",""\r\n"test25","Canceled","","",""', vm.importResult().text.replace(/"[a-z+-9]{18}"/ig, '"123456789012345678"'));
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Name from Inspector_Test__c order by Name")));
  assertEquals([
    {Name: "test10"}, {Name: "test11"}, {Name: "test12"}, {Name: "test13"}, {Name: "test14"}, {Name: "test15"}
  ], records);

  // Errors (local validations)
  vm.dataFormat("csv");
  vm.importAction("create");
  dataInput.value = '';
  vm.doImport();
  assertEquals(null, vm.confirmPopup());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "=== ERROR ===\nno data", hasMore: null}, vm.importResult());
  assertEquals({value: '', selectionStart: 0, selectionEnd: 0}, dataInput);

  dataInput.value = '"foo","bar"\r\n"baz","unclosed quote';
  vm.doImport();
  assertEquals(null, vm.confirmPopup());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "=== ERROR ===\nQuote not closed", hasMore: null}, vm.importResult());
  assertEquals({value: '"foo","bar"\r\n"baz","unclosed quote', selectionStart: '"foo","bar"\r\n"baz",'.length, selectionEnd: '"foo","bar"\r\n"baz","'.length}, dataInput);

  dataInput.value = '"foo","bar"\r\n"foo","bar"text after quote';
  vm.doImport();
  assertEquals(null, vm.confirmPopup());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "=== ERROR ===\nunexpected token \'t\'", hasMore: null}, vm.importResult());
  assertEquals({value: '"foo","bar"\r\n"foo","bar"text after quote', selectionStart: '"foo","bar"\r\n"foo","bar"'.length, selectionEnd: '"foo","bar"\r\n"foo","bar"t'.length}, dataInput);

  dataInput.value = 'a,b\r\nc,d\r\ne';
  vm.doImport();
  assertEquals(null, vm.confirmPopup());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "=== ERROR ===\nrow 3 has 1 cells, expected 2", hasMore: null}, vm.importResult());
  assertEquals({value: 'a,b\r\nc,d\r\ne', selectionStart: 'a,b\r\nc,d\r\n'.length, selectionEnd: 'a,b\r\nc,d\r\ne'.length}, dataInput);

  dataInput.value = 'Name';
  vm.doImport();
  assertEquals(null, vm.confirmPopup());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "=== ERROR ===\nNo records to import", hasMore: null}, vm.importResult());

  dataInput.value = 'Na*me\r\ntest0';
  vm.doImport();
  assertEquals(null, vm.confirmPopup());
  assertEquals({counts: {Queued: 0, Processing: 0, Succeeded: 0, Failed: 0, Canceled: 0}, text: "=== ERROR ===\nInvalid column name: Na*me", hasMore: null}, vm.importResult());

  // Errors (whole batch)
  yield vfRemoteAction(InspectorUnitTest.setTestRecords, []);
  vm.dataFormat("csv");
  vm.importAction("create");
  vm.dataResultFormat("csv");
  dataInput.value = 'Name,unknownfield\r\ntest2,222\r\ntest6,666\r\n';
  vm.doImport();
  assertEquals({text: "2 records will be imported.", action: undefined}, vm.confirmPopup());
  vm.confirmPopupYes();
  assertEquals({Queued: 0, Processing: 2, Succeeded: 0, Failed: 0, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Name","unknownfield","__Status","__Id","__Action","__Errors"\r\n"test2","222","Processing","","",""\r\n"test6","666","Processing","","",""', vm.importResult().text);
  yield waitForSpinner();
  assertEquals({Queued: 0, Processing: 0, Succeeded: 0, Failed: 2, Canceled: 0}, vm.importResult().counts);
  assertEquals('"Name","unknownfield","__Status","__Id","__Action","__Errors"\r\n"test2","222","Failed","","","INVALID_FIELD: No such column \'unknownfield\' on entity \'Inspector_Test__c\'. If you are attempting to use a custom field, be sure to append the \'__c\' after the custom field name. Please reference your WSDL or the describe call for the appropriate names."\r\n"test6","666","Failed","","","INVALID_FIELD: No such column \'unknownfield\' on entity \'Inspector_Test__c\'. If you are attempting to use a custom field, be sure to append the \'__c\' after the custom field name. Please reference your WSDL or the describe call for the appropriate names."', vm.importResult().text);
  records = getRecords(yield askSalesforce("/services/data/v34.0/query/?q=" + encodeURIComponent("select Name, Checkbox__c, Number__c, Lookup__r.Name from Inspector_Test__c order by Name")));
  assertEquals([], records);

  // Big result
  // TODO Write test for hasMore/showMore
  // TODO Write test for showStatus
}