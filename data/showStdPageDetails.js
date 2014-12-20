var outputElement;
var fieldDetailsByLabel = {};
var metadataResponse = {};
var describeAllObjects = {};
var fieldSetupData = null;

function showStdPageDetails() {
  var recordId = getRecordIdFromUrl();
  return Promise.all([
    loadFieldSetupData(),
    loadMetadataForRecordId(recordId)
  ])
  .then(function(results) {
    fieldSetupData = results[0];
    parseSalesforceFieldMetadata(results[1]);
  })
  .catch(function(error) {
      alert(error);
  });
}

function loadFieldSetupData() {
  return askSalesforceMetadata('<listMetadata><queries><type>CustomField</type></queries><asOfVersion>31.0</asOfVersion></listMetadata>').then(function(res) {
    var fields = {};
    for (var fieldEl = res.firstChild; fieldEl; fieldEl = fieldEl.nextSibling) {
      var field = {};
      for (var el = fieldEl.firstChild; el; el = el.nextSibling) {
        field[el.nodeName] = el.textContent;
      }
      fields[field.fullName] = field;
    }
    return fields;
  }, function() {
    return {}; // Don't fail if the user does not have access to the metadata API.
  });
}

function getFieldSetupLink(fields, objectDescribe, fieldDescribe) {
  if (!fieldDescribe.custom) {
    var name = fieldDescribe.name;
    if (name.substr(-2) == "Id") {
      name = name.slice(0, -2);
    }
    return '/p/setup/field/StandardFieldAttributes/d?id=' + name + '&type=' + objectDescribe.name;
  } else {
    var field = fields[objectDescribe.name + '.' + fieldDescribe.name];
    if (!field) {
      return null;
    }
    return '/' + field.id;
  }
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
    //var retUrlEncoded = encodeURIComponent(document.location.pathname);
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
            if (fieldDetail.calculatedFormula) {
                output.appendChild(E('div', [T(fieldDetail.calculatedFormula)]));
            }
            var fieldSetupLink = getFieldSetupLink(fieldSetupData, metadataResponse, fieldDetail);
            if (fieldSetupLink) {
              var a = E('a', [T('Setup')]);
              a.setAttribute('href', fieldSetupLink);
              a.setAttribute('target', '_blank');
              output.appendChild(a);
            }
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
