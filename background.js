chrome.browserAction.onClicked.addListener(function(tab) {
	chrome.tabs.insertCSS(null, {file:"main.css"});
	chrome.tabs.executeScript(null, {file:"showStdPageDetails.js"});
});
