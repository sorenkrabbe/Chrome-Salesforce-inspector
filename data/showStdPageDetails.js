function showStdPageDetails() {
  var fieldDetailsByLabel = {};
  var metadataResponse = {};
  var fieldSetupData = {};

  var recordId = getRecordIdFromUrl();
  return loadMetadataForRecordId(recordId)
    .then(function(res) {
      metadataResponse = res;
      
      // We don't wait for loadFieldSetupData to resolve. We show the data we have, and add the field setup links once that data arrives
      fieldDetailsReady();
      
      loadFieldSetupData(metadataResponse.name)
        .then(function(res) {
          fieldSetupData = res;
        }, function() {
          // Don't fail if the user does not have access to the tooling API.
        });
    })
    .catch(function(error) {
      alert(error);
    });


/**
 * Loop through all label elements, add event listeners
 */
function fieldDetailsReady(){
    for (var i = 0; i < metadataResponse.fields.length; i++) {
        var fieldDetails = metadataResponse.fields[i];
        
        if (fieldDetailsByLabel[fieldDetails.label] == null) {
            fieldDetailsByLabel[fieldDetails.label] = [];
        }
        
        fieldDetailsByLabel[fieldDetails.label].push(fieldDetails);
    }
    
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


function showFieldDetails(labelElement){
    //var retUrlEncoded = encodeURIComponent(document.location.pathname);
    var output = document.createElement('div');
    
    output.classList.add('salesforce-inspector-details');
    
    // if there is a Help Text or not
    var labelText = labelElement.firstElementChild ? labelElement.firstElementChild.firstChild.textContent : labelElement.textContent;
    var fieldDetails = fieldDetailsByLabel[labelText];
    
    //Attempt to guess "true" field label. In some cases the UI and API label names don't match? Odd! However, by prepending the object type name to the UI label a match can sometimes be found (for example for Account.phone the UI label is "Phone" but the API defined label is "Account Phone"/"Kontotelefon")
    if (labelText != null && labelText.length > 2) {
            if (fieldDetails == null) { //e.g. API "Account Type" vs UI "Type" (Account.type in EN)
                fieldDetails = fieldDetailsByLabel[metadataResponse.label + " " + labelText];
            }
            if (fieldDetails == null) { //e.g. API "Kontotype" vs UI "Type" (Account.type in DA)
                fieldDetails = fieldDetailsByLabel[metadataResponse.label + "" + labelText];
            }
            if (fieldDetails == null) { //e.g. API "Owner ID" vs UI "Account Owner" (Account.Owner)
                var cleanedLabelName = labelText.replace(metadataResponse.label, "").trim()
                if (cleanedLabelName.length > 2) { //Only try to append ID if the label still has content after stripping the object name
                    fieldDetails = fieldDetailsByLabel[cleanedLabelName + " ID"];
                }
            }
            if (fieldDetails == null) { //e.g. API "Parent Account ID" vs UI "Parent Account" (Account.Parent)
                fieldDetails = fieldDetailsByLabel[labelText + " ID"];
            }
    }
    
    function Ea(name, attrs, children) {
        var e = document.createElement(name);
        for (var attrName in attrs) {
            e.setAttribute(attrName, attrs[attrName]);
        }
        for (var i = 0; i < children.length; i++) {
          e.appendChild(children[i]);
        }
        return e;
    }
    function E(name, children) {
        return Ea(name, {}, children);
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
                E('div', [
                    T(
                        fieldDetail.type == 'reference' ? '[' + fieldDetail.referenceTo.join(', ') + ']'
                        : fieldDetail.type
                            + (fieldDetail.length != 0 ? ' (' + fieldDetail.length + ')' : '')
                            + (fieldDetail.precision != 0 || fieldDetail.scale != 0 ? ' (' + fieldDetail.precision + ', ' + fieldDetail.scale + ')' : '')
                    ),
                    T(' '),
                    Ea('span', {'class': fieldDetail.externalId ? 'insext-checked' : 'insext-unchecked'}, [T('ExtId')]),
                    T(' '),
                    Ea('span', {'class': fieldDetail.autoNumber ? 'insext-checked' : 'insext-unchecked'}, [T('Auto')]),
                    T(' '),
                    Ea('span', {'class': fieldDetail.unique ? 'insext-checked' : 'insext-unchecked'}, [T('Unique')])
                ])
            );
            if (fieldDetail.calculatedFormula) {
                output.appendChild(Ea('div', {'class': 'insext-formula'}, [T(fieldDetail.calculatedFormula)]));
            }
            var fieldSetupLink = getFieldSetupLink(fieldSetupData, metadataResponse, fieldDetail);
            if (fieldSetupLink) {
                output.appendChild(Ea('a', {'href': fieldSetupLink, 'target': '_blank'}, [T('Setup')]));
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

}
