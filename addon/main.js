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
});
