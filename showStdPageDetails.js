var outputElement;
var fieldDetailsByLabel = {};
var metadataResponse = {};
var describeAllObjects = {};

createOutputElement();

//Identifying the object type and then querying describe details for that object
askSalesforce('/sobjects/', function(responseText) {
	var currentObjKeyPrefix = document.location.pathname.substring(1,4);
	var matchFound = false;
	var response = JSON.parse(responseText);
	for(var i=0; i<response.sobjects.length; i++) {
		console.log(response.sobjects[i].keyPrefix);
		if(response.sobjects[i].keyPrefix == currentObjKeyPrefix) {
			askSalesforce('/sobjects/' + response.sobjects[i].name + '/describe/', parseSalesforceFieldMetadata);
			matchFound = true;
			break;
		}
	}
	if(!matchFound) {
		alert('Unknown salesforce object. Unable to identify current page\'s object type based on key prefix: '+ currentObjKeyPrefix)
	}
})

/*******************
* Helper functions *
********************/

function parseSalesforceFieldMetadata(responseText) {
	metadataResponse = JSON.parse(responseText);

	for(var i=0; i<metadataResponse.fields.length; i++) {
		var fieldDetails = metadataResponse.fields[i];

		if(fieldDetailsByLabel[fieldDetails.label] == null) {				
			fieldDetailsByLabel[fieldDetails.label] = [];
		}

		fieldDetailsByLabel[fieldDetails.label].push(fieldDetails);
	}

	fieldDetailsReady();
}


/**
* Loop through all label elements, add event listeners, and put the label text inside <span> tags if it's not inside an element.
*/
function fieldDetailsReady() {
	var labelElements = document.querySelectorAll("td.labelCol")
	for(var i=0; i<labelElements.length; i++) {
		if(!isBlankHtml(labelElements[i].innerHTML)) {
			var fieldLabel = labelElements[i].innerHTML

			if(labelElements[i].childNodes[0].nodeType == Node.TEXT_NODE) {
				//First element of labelElement is text. I.e. it should be put into an element
				var newElement = document.createElement("span");
				newElement.innerHTML = labelElements[i].innerHTML;
				labelElements[i].replaceChild(newElement, labelElements[i].childNodes[0]);
			}

			var labelEventElement = labelElements[i].querySelector('span');
			labelEventElement.addEventListener("mouseover", softShowFieldDetails, false);
			labelEventElement.addEventListener("click", makeFieldDetailsSticky, false);
			labelEventElement.addEventListener("mouseout", softHideFieldDetails, false);
		}
	}
}


/**
*	extracts and returns the label string from a labelElement.
*/
function getLabelFromLabelElement(labelElement) {
	return labelElement.querySelector('span').innerHTML;
}

function showFieldDetails(labelElement) {
	var retUrlEncoded = encodeURIComponent(document.location.pathname);
	var output = document.createElement('div');

	output.classList.add('salesforce-inspector-details');

	var fieldDetails = fieldDetailsByLabel[getLabelFromLabelElement(labelElement)];

	//Attempt to guess "true" field label. In some cases the UI and API label names don't match? Odd! However, by prepending the object type name to the UI label a match can sometimes be found (for example for Account.phone the UI label is "Phone" but the API defined label is "Account Phone"/"Kontotelefon")
	var guessIndex = 0;
	while(getLabelFromLabelElement(labelElement) != null && getLabelFromLabelElement(labelElement).length>2 && fieldDetails == null && guessIndex <= 3) {
		switch(guessIndex) {
			case 0: 	//e.g. API "Account Type" vs UI "Type" (Account.type in EN)
				fieldDetails = fieldDetailsByLabel[metadataResponse.label + " " + getLabelFromLabelElement(labelElement)];
			break;
			case 1: 	//e.g. API "Kontotype" vs UI "Type" (Account.type in DA)
				fieldDetails = fieldDetailsByLabel[metadataResponse.label + "" + getLabelFromLabelElement(labelElement)];
			break;
			case 2: //e.g. API "Owner ID" vs UI "Account Owner" (Account.Owner)
				var cleanedLabelName = getLabelFromLabelElement(labelElement).replace(metadataResponse.label, "").trim()
				if(cleanedLabelName.length > 2) {	//Only try to append ID if the label still has content after stripping the object name
					fieldDetails = fieldDetailsByLabel[cleanedLabelName + " ID"];
				}
			break;
			case 3: //e.g. API "Parent Account ID" vs UI "Parent Account" (Account.Parent)
				fieldDetails = fieldDetailsByLabel[getLabelFromLabelElement(labelElement) + " ID"];
			break;
		}
		guessIndex++;
	}
	

	if(fieldDetails == null || fieldDetails.length == 0) {
		output.classList.add('salesforce-inspector-error');
		output.innerHTML += '<p>No fields with matching label?!</p>';
	}
	else if(fieldDetails.length == 1) {
		output.innerHTML += '<a href="/p/setup/field/StandardFieldAttributes/d?retURL=' + retUrlEncoded + '&id=' + fieldDetails[0].name + '&type=' + metadataResponse.name + '" class="name" target="_top">' + fieldDetails[0].name + '</a> ';
		output.innerHTML += '<a href="/_ui/common/lookupFilters/FieldAttributesUi/e?retURL=' + retUrlEncoded + '&Table='+ metadataResponse.name +'&FieldOrColumn=' + fieldDetails[0].name + '" class="salesforce-inspector-minor">[edit]</a>';
		var detailsTable = '';
		detailsTable += '<table>';
		detailsTable += '<tr>';
		detailsTable += '	<td>Type:</td>';
		if(fieldDetails[0].type == 'reference') {
			detailsTable += '	<td>[' + fieldDetails[0].referenceTo + ']</td>';
		} else {
			detailsTable += '	<td>' + fieldDetails[0].type + ' (' + fieldDetails[0].length + ')</td>';
		}
		detailsTable += '</tr>';
		//detailsTable += '<tr>';
		//detailsTable += '	<td>SOAP type:</td>';
		//detailsTable += '	<td>' + fieldDetails[0].soapType + '(' + fieldDetails[0].byteLength + ' bytes)</td>';
		//detailsTable += '</tr>';
		detailsTable += '<tr>';
		detailsTable += '	<td>ExtId/Auto/Unique</td>';
		detailsTable += '	<td>' + fieldDetails[0].externalId + '/' + fieldDetails[0].autoNumber + '/' + fieldDetails[0].unique + '</td>';
		detailsTable += '</tr>';
		detailsTable += '</table>';
		output.innerHTML += detailsTable;
	}
	else {
		for(var i=0; fieldDetails.length < i; i++) {
			output.classList.add('inaccurate');
			output.innerHTML += '<p>' + fieldDetails[i].name + '</p>';
			output.innerHTML += '<p>' + fieldDetails[i].type + '</p>';
		}
		output.innerHTML += '<p><em>(multiple fields with same label)</em></p>';
	}
	
	output.addEventListener("mouseout", function(e){
		//Only do mouse-out if the mouse actually leaves the element and not just hovers a child element (http://stackoverflow.com/questions/4697758/prevent-onmouseout-when-hovering-child-element-of-the-parent-absolute-div)
		//Not that only 1 level of content elements is supported
		if ( e.toElement == this || e.toElement.parentNode == this || e.toElement.parentNode.parentNode == this || e.toElement.parentNode.parentNode.parentNode == this || e.toElement.parentNode.parentNode.parentNode.parentNode == this ) {
           return;
        }
		hideFieldDetails(e.fromElement);
	}, false);

	labelElement.appendChild(output);

}


function hideFieldDetails(detailsElement) {
	if(detailsElement != null) {
		detailsElement.remove();
	}
}

function softShowFieldDetails(e) {
	var labelElement = e.toElement.parentElement;

	if(labelElement.querySelector('.salesforce-inspector-details') == null) {
		showFieldDetails(labelElement);
	}
}

function softHideFieldDetails(e) {
	var detailsElement = e.fromElement.parentElement.querySelector('.salesforce-inspector-details');
	if(detailsElement !=null && !detailsElement.classList.contains('sticky')) {
		hideFieldDetails(detailsElement);
	}
}

function makeFieldDetailsSticky(e) {
	var detailsElement = e.target.parentElement.querySelector('.salesforce-inspector-details');
	if(detailsElement != null) {
		detailsElement.classList.add('sticky');
	}
}



function askSalesforce(url, callback) {
	var session = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "https://" + document.location.hostname + "/services/data/v27.0" + url, true);
	xhr.setRequestHeader('Authorization', "OAuth " + session);
	xhr.setRequestHeader('Accept', "application/json");
	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4) {
	    	callback(xhr.responseText);
	    	//console.log(JSON.parse(xhr.responseText));
	    	//console.log((xhr.responseText));
	  	}
	}
	xhr.send();
}

function createOutputElement() {
	//***Dev code start***//
	var oldView = document.getElementById('salesforce-inspector-output')
	if(oldView != null) { oldView.remove(); }
	//***Dev code done:***//

	outputElement = document.createElement('div');
	outputElement.setAttribute('id', 'salesforce-inspector-output')
	outputElement.setAttribute('style', 'z-index:1; position: absolute; top: 60px; right: 20px; background-color: #ffffff; border: solid 3px grey;');
	outputElement.innerHTML = 'DEBUG NOTES:';
	document.getElementsByTagName('body')[0].appendChild(outputElement)
}

function print(msg) {
	var msgElement = document.createElement('div');
	msgElement.innerHTML = msg;
	outputElement.appendChild(msgElement);
}

function isBlankHtml(html) {
	return (html == null || html == '&nbsp;' || html == '');
}