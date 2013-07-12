function showStdPageDetails(){
    chrome.tabs.insertCSS(null, {
        file: "main.css"
    });
    chrome.tabs.executeScript(null, {
        file: "showStdPageDetails.js"
    });
    window.close();
}
var a;
function showAllData(){
    chrome.tabs.executeScript(null, {
        file: "showAllDataForRecord.js",
        runAt: "document_end"
    },
    function(result) {
        result = result[0];
        console.log("Done injecting script showAllDataForRecord.js");     
        console.log(result);   
        chrome.windows.create({
            'url': 'showAllDataForRecordPopup.html?sessionToken=' + result.sessionToken + '&salesforceHostname=' + result.salesforceHostname + '&recordId=' + result.recordId + '&objectTypeName=' + result.objectTypeName, 
            'type': 'popup'}, 
            function(window) {}
        );   //TODO: Investigate if it's a security flaw to pass the salesforce session token as a URL param to the chrome extension popup window. Could alternative approach be to store the token in the popup and have the popup query the value via chrome extension messages?
        window.close();
    });
}

function init(){
    document.querySelector('#showStdPageDetailsBtn').addEventListener('click', showStdPageDetails, false);
    document.querySelector('#showAllDataBtn').addEventListener('click', showAllData, false);
}

document.addEventListener('DOMContentLoaded', init);
