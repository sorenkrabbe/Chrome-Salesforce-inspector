function showAllData() {
  var w = open('', '', 'width=850,height=800'); //An empty string loads about:blank synchronously
  var document = w.document;
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
  }\
  tr:hover {\
    background-color: lightblue;\
  }\
  .right {\
    text-align: right;\
  }\
  .left {\
    text-align: left;\
  }\
  .detailLink {\
    text-decoration: underline;\
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
  </style>\
  ';

  document.body.innerHTML = '\
  <h1 id="heading"></h1>\
  <table>\
  <thead>\
  <th class="left">Field Label</th>\
  <th class="left">API Name</th>\
  <th class="right">Value</th>\
  <th class="right">Type</th>\
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

  //Query metadata for all objects and identify relevant relevant object (as generalMetadataResponse)
  var recordId = window.document.location.pathname.substring(1);
  askSalesforce('/sobjects/', function(responseText) {
    var currentObjKeyPrefix = recordId.substring(0, 3);
    var matchFound = false;
    var generalMetadataResponse = JSON.parse(responseText);
    for (var i = 0; i < generalMetadataResponse.sobjects.length; i++) {
      if (generalMetadataResponse.sobjects[i].keyPrefix == currentObjKeyPrefix) {

        //Query metadata for the relevant object (as objectMetadataResponse)
        askSalesforce(generalMetadataResponse.sobjects[i].urls.describe, function(responseText) {
          var objectMetadataResponse = JSON.parse(responseText);

          //Sort the field objects and struture as hash map
          //TODO: Sort fields alphabetically (rewrite sortObject())
          var fields = {};
          for (var index in objectMetadataResponse.fields) {
            fields[objectMetadataResponse.fields[index].name] = objectMetadataResponse.fields[index];
          }

          //Query data for the relevant object (as objectDataResponse) and merge it with objectMetadataResponse in the fields array 
          askSalesforce(objectMetadataResponse.urls.rowTemplate.replace("{ID}", recordId), function(responseText) {
            var objectDataResponse = JSON.parse(responseText);
            //var objectValues = sortObject(objectDataResponse); //Sort attributes by name
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
              addRowToDataTable(
                [fields[index].label,
                  fields[index].name,
                  fields[index].dataValue,
                  fields[index].type + ' (' + fields[index].length + ')'
                ], [{
                  class: 'left'
                }, {
                  class: 'left, detailLink',
                  'data-all-sfdc-metadata': JSON.stringify(fields[index])
                }, {
                  class: 'right'
                }, {
                  class: 'right'
                }], [null,
                  function(event) {
                    showAllFieldMetadata(JSON.parse(event.target.getAttribute('data-all-sfdc-metadata')));
                  },
                  null,
                  null
                ]
              );
            }
          });

        });

        matchFound = true;
        break;
      }
    }
    if (!matchFound) {
      w.alert('Unknown salesforce object. Unable to identify current page\'s object type based on key prefix: ' + currentObjKeyPrefix)
      return;
    }
  });

  function showAllFieldMetadata(allFieldMetadata) {
    var fieldDetailsView = document.querySelector('#fieldDetailsView');

    var heading = document.createElement('h3');
    heading.innerHTML = 'All available metadata for "' + allFieldMetadata.name + '"';

    var table = document.createElement('table');

    var thead = document.createElement('thead');
    var tr = document.createElement('tr');
    var thKey = document.createElement('th');
    var thValue = document.createElement('th');
    thKey.innerHTML = 'Key';
    thKey.setAttribute('class', 'left');
    thValue.innerHTML = 'Value';
    thValue.setAttribute('class', 'left');
    tr.appendChild(thKey);
    tr.appendChild(thValue);
    thead.appendChild(tr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    for (var fieldMetadataAttribute in allFieldMetadata) {
      var tr = document.createElement('tr');
      var tdKey = document.createElement('td');
      var tdValue = document.createElement('td');
      tdKey.innerHTML = fieldMetadataAttribute;
      tdValue.innerHTML = JSON.stringify(allFieldMetadata[fieldMetadataAttribute]);
      tr.appendChild(tdKey);
      tr.appendChild(tdValue)
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    var mainContentElm = fieldDetailsView.querySelector('.mainContent');
    mainContentElm.innerHTML = '';
    mainContentElm.appendChild(heading);
    mainContentElm.appendChild(table);
    fieldDetailsView.style.display = 'block';
  }

  function hideAllFieldMetadataView() {
    var fieldDetailsView = document.querySelector('#fieldDetailsView');
    fieldDetailsView.style.display = 'none';
  }

  function addRowToDataTable(cellData, cellAttributes, onClickFunctions) {
    var tableRow = document.createElement('tr');
    for (var i = 0; i < cellData.length; i++) {
      var tableCell = document.createElement('td');
      for (var attributeName in cellAttributes[i]) {
        tableCell.setAttribute(attributeName, cellAttributes[i][attributeName]);
      }
      if (onClickFunctions[i] != null) {
        tableCell.addEventListener('click', onClickFunctions[i]);
      }
      tableCell.innerHTML = cellData[i];
      tableRow.appendChild(tableCell);
    }

    document.querySelector('#dataTableBody').appendChild(tableRow);
  }

  function setHeading(label) {
    document.querySelector('#heading').innerHTML = label;
  }

  /**
   * Refactor: move to general utility file? Currently not used.
   */
  function sortObject(obj) {
    var arr = [];
    for (var propertyName in obj) {
      if (obj.hasOwnProperty(propertyName)) {
        arr.push({
          'key': propertyName,
          'value': obj[propertyName]
        });
      }
    }
    arr.sort(function(a, b) {
      return a.key.toLowerCase().localeCompare(b.key.toLowerCase());
    });
    return arr;
  }
}