var test;
function init(){
	var recordId = QueryString.recordId;
	
	//Query metadata for all objects and identify relevant relevant object (as generalMetadataResponse)
	askSalesforce('/sobjects/', function(responseText){
	    var currentObjKeyPrefix = QueryString.recordId.substring(0, 3);
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
					    		[fields[index].label,	fields[index].name,			fields[index].dataValue,		fields[index].type + ' (' + fields[index].length + ')'], 
					    		['left',				'left',						'right',						'right']
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
	    }
	});
}

function addRowToDataTable(cellData, cellClasses){
    var tableRow = document.createElement('tr');
    for (var i = 0; i < cellData.length; i++) {
        var tableCell = document.createElement('td');
        tableCell.setAttribute('class', cellClasses[i])
        tableCell.innerHTML = cellData[i];
        tableRow.appendChild(tableCell);
    }

    document.querySelector('#dataTableBody').appendChild(tableRow);
}

function setHeading(label) {
	document.querySelector('#heading').innerHTML = label;
}

/**
 * Refactor: Also implemented (diff on how the session token is located) in showStdPageDetails.js.
 */
function askSalesforce(url, callback){
    var session = QueryString.sessionToken; //document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
    var salesforceHostname = QueryString.salesforceHostname; //document.location.hostname;
    var xhr = new XMLHttpRequest();
    if(url.substring(0,10) != '/services/') {
    	url  = '/services/data/v28.0' + url;
    }
    xhr.open("GET", "https://" + salesforceHostname + url, true);
    xhr.setRequestHeader('Authorization', "OAuth " + session);
    xhr.setRequestHeader('Accept', "application/json");
    xhr.onreadystatechange = function(){
        if (xhr.readyState == 4) {
            callback(xhr.responseText);
            //console.log(JSON.parse(xhr.responseText));
        }
    }
    xhr.send();
}

/**
 * Refactor: move to general utility file?
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

/**
 * Refactor: move to general utility file?
 * credits: http://stackoverflow.com/questions/979975/how-to-get-the-value-from-url-parameter
 */
var QueryString = function () {
	// This function is anonymous, is executed immediately and 
	// the return value is assigned to QueryString!
	var query_string = {};
	var query = window.location.search.substring(1);
	var vars = query.split("&");
	for (var i=0;i<vars.length;i++) {
		var pair = vars[i].split("=");
		// If first entry with this name
		if (typeof query_string[pair[0]] === "undefined") {
			query_string[pair[0]] = pair[1];
			// If second entry with this name
		} else if (typeof query_string[pair[0]] === "string") {
			var arr = [ query_string[pair[0]], pair[1] ];
			query_string[pair[0]] = arr;
			// If third or later entry with this name
		} else {
			query_string[pair[0]].push(pair[1]);
		}
	} 
	return query_string;
} ();


document.addEventListener('DOMContentLoaded', init);

