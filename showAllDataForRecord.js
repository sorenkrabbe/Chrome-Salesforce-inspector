/**
 * When injected, the Salesforce session will be used to query salesforce and display showAllDataForRecordPopup
 */
var dataPopup = window.open('showAllDataForRecordPopup.html', 'name', 'height=400,width=300, toolbar=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes');
var recordId = '001U0000003hI30'; //TODO:get proper record id from URL
askSalesforce('/sobjects/Account/' + recordId, function(responseText){
    var response = JSON.parse(responseText);
    
    dataPopup.addRowToDataTable(['aaa', 'bbb', 'ccc', 'ddd']);
});


/**
 * Also implemented in showStdPageDetails.js. Should be refactored.
 */
function askSalesforce(url, callback){
    var session = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://" + document.location.hostname + "/services/data/v28.0" + url, true);
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

