var outputElement;
var fieldDetailsByLabel = {};
var metadataResponse = {};
var describeAllObjects = {};

function showStdPageDetails() {
    //Identifying the object type and then querying describe details for that object
    askSalesforce('/services/data/v28.0/sobjects/', function(responseText){
        var currentObjKeyPrefix = document.location.pathname.substring(1, 4);
        var matchFound = false;
        var response = JSON.parse(responseText);
        for (var i = 0; i < response.sobjects.length; i++) {
            if (response.sobjects[i].keyPrefix == currentObjKeyPrefix) {
                askSalesforce(response.sobjects[i].urls.describe, parseSalesforceFieldMetadata);
                matchFound = true;
                break;
            }
        }
        if (!matchFound) {
            alert('Unknown salesforce object. Unable to identify current page\'s object type based on key prefix: ' + currentObjKeyPrefix)
        }
    });
}

/*******************
 * Helper functions *
 ********************/
function parseSalesforceFieldMetadata(responseText){
    metadataResponse = JSON.parse(responseText);
    
    for (var i = 0; i < metadataResponse.fields.length; i++) {
        var fieldDetails = metadataResponse.fields[i];
        
        if (fieldDetailsByLabel[fieldDetails.label] == null) {
            fieldDetailsByLabel[fieldDetails.label] = [];
        }
        
        fieldDetailsByLabel[fieldDetails.label].push(fieldDetails);
    }
    
    fieldDetailsReady();
}


/**
 * Loop through all label elements, add event listeners
 */
function fieldDetailsReady(){
    var labelElements = document.querySelectorAll("td.labelCol")
    for (var i = 0; i < labelElements.length; i++) {
        if (labelElements[i].textContent.trim() != '') {
            var labelEventElement = labelElements[i];
            labelEventElement.addEventListener("mouseenter", softShowFieldDetails, false);
            labelEventElement.addEventListener("click", makeFieldDetailsSticky, false);
            labelEventElement.addEventListener("mouseleave", softHideFieldDetails, false);
        }
    }
}


/**
 *	extracts and returns the label string from a labelElement.
 */
function getLabelFromLabelElement(labelElement){
    // if there is a Help Text or not
    return labelElement.firstElementChild ? labelElement.firstElementChild.firstChild.textContent : labelElement.textContent;
}

function showFieldDetails(labelElement){
    var retUrlEncoded = encodeURIComponent(document.location.pathname);
    var output = document.createElement('div');
    
    output.classList.add('salesforce-inspector-details');
    
    var fieldDetails = fieldDetailsByLabel[getLabelFromLabelElement(labelElement)];
    
    //Attempt to guess "true" field label. In some cases the UI and API label names don't match? Odd! However, by prepending the object type name to the UI label a match can sometimes be found (for example for Account.phone the UI label is "Phone" but the API defined label is "Account Phone"/"Kontotelefon")
    var guessIndex = 0;
    while (getLabelFromLabelElement(labelElement) != null && getLabelFromLabelElement(labelElement).length > 2 && fieldDetails == null && guessIndex <= 3) {
        switch (guessIndex) {
            case 0: //e.g. API "Account Type" vs UI "Type" (Account.type in EN)
                fieldDetails = fieldDetailsByLabel[metadataResponse.label + " " + getLabelFromLabelElement(labelElement)];
                break;
            case 1: //e.g. API "Kontotype" vs UI "Type" (Account.type in DA)
                fieldDetails = fieldDetailsByLabel[metadataResponse.label + "" + getLabelFromLabelElement(labelElement)];
                break;
            case 2: //e.g. API "Owner ID" vs UI "Account Owner" (Account.Owner)
                var cleanedLabelName = getLabelFromLabelElement(labelElement).replace(metadataResponse.label, "").trim()
                if (cleanedLabelName.length > 2) { //Only try to append ID if the label still has content after stripping the object name
                    fieldDetails = fieldDetailsByLabel[cleanedLabelName + " ID"];
                }
                break;
            case 3: //e.g. API "Parent Account ID" vs UI "Parent Account" (Account.Parent)
                fieldDetails = fieldDetailsByLabel[getLabelFromLabelElement(labelElement) + " ID"];
                break;
        }
        guessIndex++;
    }
    
    function E(name, children) {
        var e = document.createElement(name);
        for (var i = 0; i < children.length; i++) {
          e.appendChild(children[i]);
        }
        return e;
    }
    function T(text) {
        return document.createTextNode(text);
    }
    
    if (fieldDetails == null || fieldDetails.length == 0) {
        output.classList.add('salesforce-inspector-error');
        output.appendChild(E('p', [T('No fields with matching label?!')]));
    } else {
        if (fieldDetails.length > 1) {
            output.classList.add('inaccurate');
            output.appendChild(E('p', [T('Multiple fields with same label')]));
        }
        for (var i = 0; i < fieldDetails.length; i++) {
            var fieldDetail = fieldDetails[i];
            output.appendChild(E('div', [T(fieldDetail.name)]));
            // /p/setup/layout/LayoutFieldList?type=Account and /01I20000000Mnwf?setupid=CustomObjects
            //output.inner HTML += '<a href="/p/setup/field/StandardFieldAttributes/d?retURL=' + retUrlEncoded + '&id=' + fieldDetail.name + '&type=' + metadataResponse.name + '" class="name" target="_top">' + fieldDetail.name + '</a> ';
            //output.inner HTML += '<a href="/_ui/common/lookupFilters/FieldAttributesUi/e?retURL=' + retUrlEncoded + '&Table='+ metadataResponse.name +'&FieldOrColumn=' + fieldDetail.name + '" class="salesforce-inspector-minor">[edit]</a>';
            output.appendChild(
                E('table', [
                    E('tr', [
                        E('td', [T('Type:')]),
                        E('td', [T(fieldDetail.type == 'reference' ? '[' + fieldDetail.referenceTo + ']' : fieldDetail.type + ' (' + fieldDetail.length + ')')])
                    ]),
                    //E('tr', [
                    //    E('td', [T('SOAP type:')]),
                    //    E('td', [T(fieldDetail.soapType + '(' + fieldDetail.byteLength + ' bytes)')])
                    //]),
                    E('tr', [
                        E('td', [T('ExtId/Auto/Unique')]),
                        E('td', [T(fieldDetail.externalId + '/' + fieldDetail.autoNumber + '/' + fieldDetail.unique)])
                    ])
                ])
            );
        }
    }
    
    output.addEventListener("mouseleave", function(e){
        hideFieldDetails(e.target);
    }, false);
    
    labelElement.appendChild(output);
}

function hideFieldDetails(detailsElement){
    if (detailsElement != null) {
        detailsElement.remove();
    }
}

function softShowFieldDetails(e){
    var labelElement = e.currentTarget;
    
    if (labelElement.querySelector('.salesforce-inspector-details') == null) {
        showFieldDetails(labelElement);
    }
}

function softHideFieldDetails(e){
    var detailsElement = e.currentTarget.querySelector('.salesforce-inspector-details');
    if (detailsElement != null && !detailsElement.classList.contains('sticky')) {
        hideFieldDetails(detailsElement);
    }
}

function makeFieldDetailsSticky(e){
    var detailsElement = e.currentTarget.querySelector('.salesforce-inspector-details');
    if (detailsElement != null) {
      detailsElement.classList.add('sticky');
    }
}
