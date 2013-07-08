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
    chrome.windows.create({
        url: 'showSObjectDataPopup',
        width: 200,
        height: 120,
        type: 'popup'
    });
    
}

function init(){
    document.querySelector('#showStdPageDetailsBtn').addEventListener('click', showStdPageDetails, false);
    document.querySelector('#showAllDataBtn').addEventListener('click', showAllData, false);
}

document.addEventListener('DOMContentLoaded', init);
