"use strict";
var sessions = {};
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.message == "putSession") {
    sessions[request.orgId] = request.session;
  }
  if (request.message == "getSession") {
    sendResponse(sessions[request.orgId]);
  }
  function createWin(a, b) {
    if (window.mozContact) {
      delete a.type;
    }
    chrome.windows.create(a, b);
  }
  if (request.message == "dataExport") {
    createWin(
      {
        url: chrome.extension.getURL("data/dataExport.html") + "?" + request.args, 
        type: "popup",
        width: 900,
        height: 800
      }, 
      function(window) {}
    );
  }
  if (request.message == "dataImport") {
    createWin(
      {
        url: chrome.extension.getURL("data/dataImport.html") + "?" + request.args, 
        type: "popup",
        width: 900,
        height: 800
      }, 
      function(window) {}
    );
  }
  if (request.message == "showAllData") {
    createWin(
      {
        url: chrome.extension.getURL("data/showAllData.html") + "?" + request.args, 
        type: "popup",
        width: 850,
        height: 800
      }, 
      function(window) {}
    );
  }
  if (request.message == "apiExplore") {
    createWin(
      {
        url: chrome.extension.getURL("data/apiExplore.html") + "?" + request.args, 
        type: "popup",
        width: 900,
        height: 800
      }, 
      function(window) {}
    );
  }
});
