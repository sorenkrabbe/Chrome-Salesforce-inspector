function showStdPageDetails(){
    chrome.tabs.insertCSS(null, {
        file: "main.css"
    });
    chrome.tabs.executeScript(null, {
        file: "showStdPageDetails.js"
    });
    window.close();
}

function showAllData(){
    chrome.tabs.executeScript(null, {
        file: "showAllDataForRecord.js"
    });
    window.close();
}

function init(){
    document.querySelector('#showStdPageDetailsBtn').addEventListener('click', showStdPageDetails, false);
    document.querySelector('#showAllDataBtn').addEventListener('click', showAllData, false);
}

document.addEventListener('DOMContentLoaded', init);
