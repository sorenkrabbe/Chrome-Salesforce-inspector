function showAllData() {
  // Load a blank page and then inject the HTML to work around https://bugzilla.mozilla.org/show_bug.cgi?id=792479
  // An empty string as URL loads about:blank synchronously
  var popupWin;
  if (window.unsafeWindow && window.XPCNativeWrapper) {
    // Firefox
    // Use unsafeWindow to work around https://bugzilla.mozilla.org/show_bug.cgi?id=996069
    popupWin = new XPCNativeWrapper(unsafeWindow.open('', '', 'width=850,height=800'));
  } else {
    // Chrome
    popupWin = open('', '', 'width=850,height=800');
  }
  window.addEventListener("pagehide", function() {
    // All JS runs in the parent window, and will stop working when the parent goes away. Therefore close the popup.
    popupWin.close();
  });
  var document = popupWin.document;
  document.head.innerHTML = '\
  <title>Loading all data...</title>\
  <style>\
  body {\
    font-family: Arial, Helvetica, sans-serif;\
    font-size: 11px;\
  }\
  table {\
    width: 100%;\
    border-spacing: 0px;\
    font-size: 11px;\
    word-wrap: break-word;\
    white-space: pre-wrap;\
    table-layout: fixed;\
  }\
  tr.calculated {\
    color: #777777;\
    background-color: #CCCCCC;\
    font-style: italic;\
  }\
  tr:hover, tr.calculated:hover {\
    background-color: lightblue;\
  }\
  th {\
    text-align: left;\
  }\
  .field-label {\
    width: 20em;\
  }\
  .field-name {\
    text-decoration: underline;\
    width: 20em;\
  }\
  .field-value {\
    text-align: right;\
  }\
  .field-type {\
    text-align: right;\
    width: 9em;\
  }\
  #fieldDetailsView {\
    display: none;\
    position: fixed;\
    top: 0;\
    right: 0;\
    bottom: 0;\
    left: 0;\
    background: rgba(0,0,0,0.8);\
    z-index: 99999;\
  }\
  \
  #fieldDetailsView > div.container {\
    width: 400px;\
    height: 500px;\
    position: relative;\
    margin: 10% auto;\
    border-radius: 10px;\
    background: #fff;\
  }\
  #fieldDetailsView > div.container > div.mainContent {\
    overflow: auto;\
    height: 470px;\
    padding: 5px 20px 13px 20px;\
  }\
  .closeLnk {\
    background: #606061;\
    color: #FFFFFF;\
    line-height: 25px;\
    position: absolute;\
    right: -12px;\
    text-align: center;\
    top: -10px;\
    width: 24px;\
    text-decoration: none;\
    font-weight: bold;\
    border-radius: 12px;\
    box-shadow: 1px 1px 3px #000;\
  }\
  .closeLnk:hover {\
    background: #00d9ff;\
  }\
  #filter {\
    width: 20em;\
  }\
  .filter-hidden {\
    display: none;\
  }\
  </style>\
  ';

  document.body.innerHTML = '\
  <h1 id="heading">Loading all data...</h1>\
  <input id="filter" placeholder="Filter">\
  <table>\
  <thead>\
  <th class="field-label">Field Label</th>\
  <th class="field-name">API Name</th>\
  <th class="field-value">Value</th>\
  <th class="field-type">Type</th>\
  </thead>\
  <tbody id="dataTableBody">\
  </tbody>\
  </table>\
  <div id="fieldDetailsView">\
  <div class="container">\
  <a href="#" class="closeLnk">X</a>\
  <div class="mainContent"></div>\
  </div>\
  </div>\
  ';

  //Setup eventlisteners for static content
  document.querySelector('#fieldDetailsView .closeLnk').addEventListener('click', function(event) {
    hideAllFieldMetadataView();
  });
  document.querySelector('#filter').addEventListener('input', function(event) {
    console.log("filtering!");
    var value = document.querySelector('#filter').value.trim().toLowerCase();
    var rows = document.querySelectorAll('#dataTableBody tr');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      row.classList.toggle('filter-hidden', value && row.textContent.toLowerCase().indexOf(value) == -1);
    };
  });
  document.querySelector('#filter').focus();

  var recordId = getRecordIdFromUrl();
  var fields = {};
  loadMetadataForRecordId(recordId).then(function(responseText) {
    var objectMetadataResponse = JSON.parse(responseText);

    for (var index in objectMetadataResponse.fields) {
      fields[objectMetadataResponse.fields[index].name] = objectMetadataResponse.fields[index];
    }

    //Query data for the relevant object (as objectDataResponse) and merge it with objectMetadataResponse in the fields array 
    return askSalesforce(objectMetadataResponse.urls.rowTemplate.replace("{ID}", recordId));

  }).then(function(responseText) {
    var objectDataResponse = JSON.parse(responseText);
    for (var fieldName in objectDataResponse) {
      if (fieldName != 'attributes') {
        if (!fields.hasOwnProperty(fieldName)) {
          fields[fieldName] = {};
        }
        fields[fieldName].dataValue = objectDataResponse[fieldName];
      }
    }

    //Add to layout
    document.title = 'ALL DATA: ' + objectDataResponse.attributes.type + ' (' + objectDataResponse.Name + ' / ' + objectDataResponse.Id + ')';
    setHeading(objectDataResponse.attributes.type + ' (' + objectDataResponse.Name + ' / ' + objectDataResponse.Id + ')');
    for (var index in fields) {
      var fieldTypeDesc = fields[index].type + ' (' + fields[index].length + ')';
      fieldTypeDesc += (fields[index].calculated) ? '*' : '';

      addRowToDataTable(
        [fields[index].label,
          fields[index].name,
          fields[index].dataValue,
          fieldTypeDesc
        ], [{
          class: 'field-label'
        }, {
          class: 'field-name',
          'data-all-sfdc-metadata': JSON.stringify(fields[index])
        }, {
          class: 'field-value'
        }, {
          class: 'field-type'
        }], [null,
          function(event) {
            showAllFieldMetadata(JSON.parse(event.currentTarget.getAttribute('data-all-sfdc-metadata')));
          },
          null,
          null
        ],
        (fields[index].calculated) ? 'calculated' : null
      );
    }
    makeSortable(document.querySelector('#dataTableBody').parentNode);
  }).then(null, function(error) {
    popupWin.alert(error);
  });

  function showAllFieldMetadata(allFieldMetadata) {
    var fieldDetailsView = document.querySelector('#fieldDetailsView');

    var heading = document.createElement('h3');
    heading.textContent = 'All available metadata for "' + allFieldMetadata.name + '"';

    var table = document.createElement('table');

    var thead = document.createElement('thead');
    var tr = document.createElement('tr');
    var thKey = document.createElement('th');
    var thValue = document.createElement('th');
    thKey.textContent = 'Key';
    thValue.textContent = 'Value';
    tr.appendChild(thKey);
    tr.appendChild(thValue);
    thead.appendChild(tr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    for (var fieldMetadataAttribute in allFieldMetadata) {
      var tr = document.createElement('tr');
      var tdKey = document.createElement('td');
      var tdValue = document.createElement('td');
      tdKey.textContent = fieldMetadataAttribute;
      tdValue.textContent = JSON.stringify(allFieldMetadata[fieldMetadataAttribute]);
      tr.appendChild(tdKey);
      tr.appendChild(tdValue)
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    var mainContentElm = fieldDetailsView.querySelector('.mainContent');
    mainContentElm.textContent = '';
    mainContentElm.appendChild(heading);
    mainContentElm.appendChild(table);
    fieldDetailsView.style.display = 'block';
  }

  function hideAllFieldMetadataView() {
    var fieldDetailsView = document.querySelector('#fieldDetailsView');
    fieldDetailsView.style.display = 'none';
  }

  function addRowToDataTable(cellData, cellAttributes, onClickFunctions, rowClass) {
    var tableRow = document.createElement('tr');
    tableRow.setAttribute('class', rowClass);

    for (var i = 0; i < cellData.length; i++) {
      var tableCell = document.createElement('td');
      for (var attributeName in cellAttributes[i]) {
        tableCell.setAttribute(attributeName, cellAttributes[i][attributeName]);
      }
      if (onClickFunctions[i] != null) {
        tableCell.addEventListener('click', onClickFunctions[i]);
      }
      tableCell.textContent = cellData[i];
      tableRow.appendChild(tableCell);
    }

    document.querySelector('#dataTableBody').appendChild(tableRow);
  }

  function setHeading(label) {
    document.querySelector('#heading').textContent = label;
  }

  function sortTable(table, col, dir) {
    var tbody = table.tBodies[0];
    var rows = Array.prototype.slice.call(tbody.rows, 0);
    rows = rows.sort(function (a, b) {
      return dir * (a.cells[col].textContent.trim().localeCompare(b.cells[col].textContent.trim()));
    });
    for (var i = 0; i < rows.length; ++i) {
      tbody.appendChild(rows[i]);
    }
  }

  function makeSortable(table) {
    var thead = table.tHead.rows[0].cells;
    var sortCol = 0;
    var sortDir = -1;
    for (var col = 0; col < thead.length; col++) {
      thead[col].tabIndex = 0;
      (function (col) {
        thead[col].addEventListener("click", function () {
          thead[sortCol].style.background = '';
          sortDir = col == sortCol ? -sortDir : 1;
          sortCol = col;
          thead[sortCol].style.backgroundImage = sortDir > 0 ? 'url(/img/colTitle_downarrow.gif)' : 'url(/img/colTitle_uparrow.gif)';
          sortTable(table, sortCol, sortDir);
        });
      }(col));
    }
  }

}