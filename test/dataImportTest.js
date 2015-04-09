function* dataImportTest() {
  console.log("TEST dataImportVm");

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

  var dataInput = {value: "", selectionStart: 0, selectionEnd: 0};
  var dataInputVm = {
    setSelectionRange: function(offsetStart, offsetEnd) { dataInput.selectionStart = offsetStart; dataInput.selectionEnd = offsetEnd; },
    getValue: function() { return dataInput.value; }
  };

  var vm = dataImportVm(dataInputVm);

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

  yield waitForSpinner();

  // TODO write tests
}