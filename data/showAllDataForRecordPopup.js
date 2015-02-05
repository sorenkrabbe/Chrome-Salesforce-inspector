function showAllData(recordDesc) {
  // Load a blank page and then inject the HTML to work around https://bugzilla.mozilla.org/show_bug.cgi?id=792479
  // An empty string as URL loads about:blank synchronously
  var popupWin;
  if (window.unsafeWindow && window.XPCNativeWrapper) {
    // Firefox
    // Use unsafeWindow to work around https://bugzilla.mozilla.org/show_bug.cgi?id=996069
    popupWin = new XPCNativeWrapper(unsafeWindow.open('', '', 'width=850,height=800,scrollbars=yes'));
  } else {
    // Chrome
    popupWin = open('', '', 'width=850,height=800,scrollbars=yes');
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
    width: 20em;\
  }\
  .field-value {\
    text-align: right;\
  }\
  .field-type {\
    text-align: right;\
    width: 9em;\
  }\
  .field-setup {\
    text-align: right;\
    width: 4em;\
  }\
  span[tabindex], td[tabindex], th[tabindex] {\
    text-decoration: underline;\
    cursor: pointer;\
    color: darkblue;\
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
  <h1><span id="object-name">Loading all data...</span> <span id="record-name"></span></h1>\
  <input id="filter" placeholder="Filter">\
  <table>\
    <thead>\
      <th class="field-label">Field Label</th>\
      <th class="field-name">API Name</th>\
      <th class="field-value">Value</th>\
      <th class="field-type">Type</th>\
      <th class="field-setup">Setup</th>\
    </thead>\
    <tbody id="dataTableBody">\
    </tbody>\
  </table>\
  <div id="fieldDetailsView">\
    <div class="container">\
      <a href="about:blank" class="closeLnk">X</a>\
      <div class="mainContent">\
        <h3 id="fieldDetailsHeading"></h3>\
        <input id="field-filter" placeholder="Filter">\
        <table>\
          <thead><tr><th>Key</th><th>Value</th></tr></thead>\
          <tbody id="fieldDetailsTbody"></tbody>\
        </table>\
      </div>\
    </div>\
  </div>\
  ';

  //Setup eventlisteners for static content
  document.querySelector('#fieldDetailsView .closeLnk').addEventListener('click', function(event) {
    event.preventDefault();
    hideAllFieldMetadataView();
  });
  document.querySelector('#filter').addEventListener('input', function(event) {
    var value = document.querySelector('#filter').value.trim().toLowerCase();
    var rows = document.querySelectorAll('#dataTableBody tr');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      row.classList.toggle('filter-hidden', value && row.textContent.toLowerCase().indexOf(value) == -1);
    };
  });
  document.querySelector('#field-filter').addEventListener('input', function(event) {
    var value = document.querySelector('#field-filter').value.trim().toLowerCase();
    var rows = document.querySelectorAll('#fieldDetailsTbody tr');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      row.classList.toggle('filter-hidden', value && row.textContent.toLowerCase().indexOf(value) == -1);
    };
  });
  document.querySelector('#filter').focus();

  var objectMetadataResponse;
  var metadataPromise;
  if ("recordId" in recordDesc) {
    metadataPromise = loadMetadataForRecordId(recordDesc.recordId);
  } else if ("recordAttributes" in recordDesc) {
    metadataPromise = askSalesforce("/services/data/v32.0/" + (recordDesc.useToolingApi ? "tooling/" : "") + "sobjects/" + recordDesc.recordAttributes.type + "/describe/");
  } else {
    throw "unknown input for showAllData";
  }
  metadataPromise = metadataPromise.then(function(responseText) {
    objectMetadataResponse = JSON.parse(responseText);
  });
  var recordDataPromise = metadataPromise.then(function() {
    if (objectMetadataResponse.retrieveable) {
      if ("recordId" in recordDesc) {
        if (recordDesc.recordId.length < 15) {
          return JSON.stringify({}); // Just a prefix, don't attempt to load the record
        } else {
          return askSalesforce(objectMetadataResponse.urls.rowTemplate.replace("{ID}", recordDesc.recordId));
        }
      } else if ("recordAttributes" in recordDesc) {
        return askSalesforce(recordDesc.recordAttributes.url);
      } else {
        throw "unknown input for showAllData";
      }
    } else {
      // TODO better display of the error message
      return JSON.stringify({"_": "This object does not support showing all data"});
    }
  });
  var fieldIdsPromise = loadFieldSetupData();
  var fieldDescriptionsPromise = metadataPromise.then(function() {
    return askSalesforce("/services/data/v32.0/tooling/query/?q=" + encodeURIComponent("select QualifiedApiName, Metadata from FieldDefinition where EntityDefinitionId = '" + objectMetadataResponse.name + "'"));
  });
  Promise.all([recordDataPromise, fieldIdsPromise, fieldDescriptionsPromise]).then(function(responses) {
    var objectDataResponse = JSON.parse(responses[0]);
    var fieldIds = responses[1];
    var fieldDescriptions = JSON.parse(responses[2]);

    var fields = {};
    for (var index in objectMetadataResponse.fields) {
      fields[objectMetadataResponse.fields[index].name] = objectMetadataResponse.fields[index];
    }

    for (var fieldName in objectDataResponse) {
      if (fieldName != 'attributes') {
        if (!fields.hasOwnProperty(fieldName)) {
          fields[fieldName] = {};
        }
        fields[fieldName].dataValue = objectDataResponse[fieldName];
      }
    }

    fieldDescriptions.records.forEach(function(fieldDescription) {
      if (fields.hasOwnProperty(fieldDescription.QualifiedApiName)) {
        fields[fieldDescription.QualifiedApiName].description = fieldDescription.Metadata.description;
      }
    });

    //Add to layout
    document.title = 'ALL DATA: ' + objectMetadataResponse.name + ' (' + objectDataResponse.Name + ' / ' + objectDataResponse.Id + ')';
    document.querySelector('#record-name').textContent = '(' + objectDataResponse.Name + ' / ' + objectDataResponse.Id + ')';
    document.querySelector('#object-name').textContent = objectMetadataResponse.name;
    document.querySelector('#object-name').tabIndex = 0;
    document.querySelector('#object-name').addEventListener('click', function() {
      showAllFieldMetadata(objectMetadataResponse);
    });
    for (var index in fields) {
      var fieldTypeDesc = fields[index].type + ' (' + fields[index].length + ')';
      fieldTypeDesc += (fields[index].calculated) ? '*' : '';

      var setupLink = getFieldSetupLink(fieldIds, objectMetadataResponse, fields[index]);
      addRowToDataTable(
        [fields[index].label,
          fields[index].name,
          fields[index].dataValue,
          fieldTypeDesc,
          setupLink ? 'Setup' : ''
        ], [{
          class: 'field-label'
        }, {
          class: 'field-name',
          title: fields[index].name + "\n"
            + (fields[index].calculatedFormula ? "Formula: " + fields[index].calculatedFormula + "\n" : "")
            + (fields[index].description ? "Description: " + fields[index].description + "\n" : "")
            + (fields[index].inlineHelpText ? "Help text: " + fields[index].inlineHelpText + "\n" : "")
            + (fields[index].picklistValues.length > 0 ? "Picklist values: " + fields[index].picklistValues.map(function(pickval) { return pickval.value; }).join(", ") + "\n" : "")
            ,
          'data-all-sfdc-metadata': JSON.stringify(fields[index])
        }, {
          class: 'field-value'
        }, {
          class: 'field-type'
        }, {
          class: 'field-setup',
          'data-setup-link': setupLink
        }], [null,
          function(event) {
            showAllFieldMetadata(JSON.parse(event.currentTarget.getAttribute('data-all-sfdc-metadata')));
          },
          fields[index].type == 'reference' && fields[index].dataValue
            ? function(event) { showAllData({recordId: event.currentTarget.textContent}); }
            : null,
          null,
          setupLink ? function(event) {
            open(event.currentTarget.getAttribute('data-setup-link'));
          } : null
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

    fieldDetailsView.querySelector('#fieldDetailsHeading').textContent = 'All available metadata for "' + allFieldMetadata.name + '"';

    var tbody = fieldDetailsView.querySelector('#fieldDetailsTbody');
    tbody.textContent = '';
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
    fieldDetailsView.style.display = 'block';
    document.querySelector('#field-filter').focus();
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
        tableCell.tabIndex = 0;
      }
      tableCell.textContent = cellData[i];
      tableRow.appendChild(tableCell);
    }

    document.querySelector('#dataTableBody').appendChild(tableRow);
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