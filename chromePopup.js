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
    document.querySelector('#aboutLnk').addEventListener('click', function(){ 
        chrome.tabs.create({url: 'https://github.com/sorenkrabbe/Chrome-Salesforce-inspector'}); 
    }, false);
}

document.addEventListener('DOMContentLoaded', init);
