function init(){
	var recordId = QueryString.recordId;
	
	//Find objecttype and query field values
	askSalesforce('/sobjects/', function(responseText){
	    var currentObjKeyPrefix = QueryString.recordId.substring(0, 3);
	    var matchFound = false;
	    var metadataResponse = JSON.parse(responseText);
	    for (var i = 0; i < metadataResponse.sobjects.length; i++) {
	        if (metadataResponse.sobjects[i].keyPrefix == currentObjKeyPrefix) {
				askSalesforce(metadataResponse.sobjects[i].urls.rowTemplate.replace("{ID}", recordId), function(responseText){
				    var dataResponse = JSON.parse(responseText);
				    this.setHeading(dataResponse.attributes.type + ' (' + dataResponse.Name + ' / ' + dataResponse.Id + ')');
				    var objectValues = sortObject(dataResponse); //Sort attributes by name
				    for(var index in objectValues) {
				    	if(objectValues[index].key != 'attributes') {
					    	this.addRowToDataTable(
					    		[metadataResponse.sobjects[i].keyPrefix,	objectValues[index].key,	objectValues[index].value,	''], 
					    		['left',									'left',						'right',					'left']);
						}
					}
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
 var test;
function askSalesforce(url, callback){
    var session = QueryString.sessionToken; //document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
    var salesforceHostname = QueryString.salesforceHostname; //document.location.hostname;
    var xhr = new XMLHttpRequest();
    console.log(url);
    if(url.substring(0,10) != '/services/') {
    	url  = '/services/data/v28.0' + url;
    }
    xhr.open("GET", "https://" + salesforceHostname + url, true);
    xhr.setRequestHeader('Authorization', "OAuth " + session);
    xhr.setRequestHeader('Accept', "application/json");
    xhr.onreadystatechange = function(){
        if (xhr.readyState == 4) {
            callback(xhr.responseText);
            console.log(JSON.parse(xhr.responseText));
            //console.log((xhr.responseText));
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

