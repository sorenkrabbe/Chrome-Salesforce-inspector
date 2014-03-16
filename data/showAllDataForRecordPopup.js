function showAllData(){
    var f = document.createElement('div');
    f.innerHTML = '<div class="insext-alldata-popup">\
        <div class="insext-alldata-close" tabindex="0">Close</div>\
        <h1 id="insext-heading"></h1>\
        <table class="insext-table">\
            <thead>\
                <th class="insext-left">Field Label</th>\
                <th class="insext-left">API Name</th>\
                <th class="insext-right">Value</th>\
                <th class="insext-right">Type</th>\
            </thead>\
            <tbody id="insext-dataTableBody">\
            </tbody>\
        </table>\
        <div id="insext-fieldDetailsView">\
            <div class="insext-container">\
                <a href="#" class="insext-closeLnk">X</a>\
                <div class="insext-mainContent"></div>\
            </div>\
        </div>\
    </div>';
    f = f.firstChild;
    document.body.appendChild(f);
    document.querySelector('.insext-alldata-close').addEventListener('click', function() {
        document.body.removeChild(f);
    });
	//Setup eventlisteners for static content
	document.querySelector('#insext-fieldDetailsView .insext-closeLnk').addEventListener('click', function(event){
		hideAllFieldMetadataView();
	});

	//Query metadata for all objects and identify relevant relevant object (as generalMetadataResponse)
	var recordId = document.location.pathname.substring(1);
	askSalesforce('/sobjects/', function(responseText){
	    var currentObjKeyPrefix = recordId.substring(0, 3);
	    var matchFound = false;
	    var generalMetadataResponse = JSON.parse(responseText);
	    for (var i = 0; i < generalMetadataResponse.sobjects.length; i++) {
	        if (generalMetadataResponse.sobjects[i].keyPrefix == currentObjKeyPrefix) {
	        	
				//Query metadata for the relevant object (as objectMetadataResponse)
				askSalesforce(generalMetadataResponse.sobjects[i].urls.describe, function(responseText){
					var objectMetadataResponse = JSON.parse(responseText);

					//Sort the field objects and struture as hash map
					//TODO: Sort fields alphabetically (rewrite sortObject())
					var fields = {};
					for(var index in objectMetadataResponse.fields) {
						fields[objectMetadataResponse.fields[index].name] = objectMetadataResponse.fields[index];
					}

		        	//Query data for the relevant object (as objectDataResponse) and merge it with objectMetadataResponse in the fields array 
					askSalesforce(objectMetadataResponse.urls.rowTemplate.replace("{ID}", recordId), function(responseText){
					    var objectDataResponse = JSON.parse(responseText);
					    //var objectValues = sortObject(objectDataResponse); //Sort attributes by name
					    for(var fieldName in objectDataResponse) {
					    	if(fieldName != 'attributes') {
						    	if(!fields.hasOwnProperty(fieldName)) {
						    		fields[fieldName] = {};
						    	}
						    	fields[fieldName].dataValue = objectDataResponse[fieldName];
						    }
						}

						//Add to layout
					    this.setHeading(objectDataResponse.attributes.type + ' (' + objectDataResponse.Name + ' / ' + objectDataResponse.Id + ')');
					    for(var index in fields) {
					    	this.addRowToDataTable(
					    		[	fields[index].label,
					    			fields[index].name,	
					    			fields[index].dataValue,	
					    			fields[index].type + ' (' + fields[index].length + ')'
					    		], 
					    		[	{ class: 'insext-left' },
					    			{ class: 'insext-left, insext-detailLink', 'data-all-sfdc-metadata': JSON.stringify(fields[index]) },
					    			{ class: 'insext-right' },
					    			{ class: 'insext-right' }
					    		],
					    		[	null,
					    			function(event){
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
	        alert('Unknown salesforce object. Unable to identify current page\'s object type based on key prefix: ' + currentObjKeyPrefix)
	        return;
	    }
	});
}

function showAllFieldMetadata(allFieldMetadata) {
	var fieldDetailsView = document.querySelector('#insext-fieldDetailsView');
	
	var heading = document.createElement('h3');
	heading.innerHTML = 'All available metadata for "' + allFieldMetadata.name + '"'; 

	var table = document.createElement('table');

	var thead = document.createElement('thead');
	var tr = document.createElement('tr');
	var thKey = document.createElement('th');
	var thValue = document.createElement('th');
	thKey.innerHTML = 'Key';
	thKey.setAttribute('class', 'insext-left');
	thValue.innerHTML = 'Value';
	thValue.setAttribute('class', 'insext-left');
	tr.appendChild(thKey);
	tr.appendChild(thValue);
	thead.appendChild(tr);
	table.appendChild(thead);

	var tbody = document.createElement('tbody');
	for(var fieldMetadataAttribute in allFieldMetadata) {
		var tr = document.createElement('tr');
		var tdKey = document.createElement('td');
		var tdValue = document.createElement('td');
		tdKey.innerHTML = fieldMetadataAttribute;
		tdValue.innerHTML = JSON.stringify( allFieldMetadata[fieldMetadataAttribute] );
		tr.appendChild(tdKey);
		tr.appendChild(tdValue)
		tbody.appendChild(tr);
	}
	table.appendChild(tbody);
	var mainContentElm = fieldDetailsView.querySelector('.insext-mainContent');
	mainContentElm.innerHTML = '';
	mainContentElm.appendChild(heading);
	mainContentElm.appendChild(table);
	fieldDetailsView.style.display = 'block';
}

function hideAllFieldMetadataView() {
	var fieldDetailsView = document.querySelector('#insext-fieldDetailsView');
	fieldDetailsView.style.display = 'none';
}

function addRowToDataTable(cellData, cellAttributes, onClickFunctions){
    var tableRow = document.createElement('tr');
    for (var i = 0; i < cellData.length; i++) {
        var tableCell = document.createElement('td');
        for(var attributeName in cellAttributes[i]) {
        	tableCell.setAttribute(attributeName, cellAttributes[i][attributeName]);
    	}
    	if(onClickFunctions[i] != null) {
    		tableCell.addEventListener('click', onClickFunctions[i]);
    	}
        tableCell.innerHTML = cellData[i];
        tableRow.appendChild(tableCell);
    }

    document.querySelector('#insext-dataTableBody').appendChild(tableRow);
}

function setHeading(label) {
	document.querySelector('#insext-heading').innerHTML = label;
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
