
if (this.require) {

  // Firefox
  var pageMod = require("sdk/page-mod");
  var self = require("sdk/self");
  var privateBrowsing = require("sdk/private-browsing");
  var events = require("sdk/system/events");

  var normalSessions = {};
  var privateSessions = {};

  pageMod.PageMod({
    include: /^https:\/\/[a-z0-9\-\.]*\.(salesforce\.com|visual\.force\.com)\/.*/,
    contentStyleFile: [self.data.url("chromePopup.css"), self.data.url("showStdPageDetails.css")],
    contentScriptFile: [self.data.url("chromePopup.js"), self.data.url("showAllDataForRecordPopup.js"), self.data.url("showStdPageDetails.js")],
    onAttach: function startListening(worker) {
      var sessions = privateBrowsing.isPrivate(worker) ? privateSessions : normalSessions;
      worker.port.on('putSession', function(orgId, session) {
        sessions[orgId] = session;
      });
      worker.port.on('getSession', function(orgId) {
        worker.port.emit('getSession', sessions[orgId]);
      });
    }
  });

  events.on("last-pb-context-exited", function() {
    privateSessions = {};
  });

} else {

  // Chrome
  var sessions = {};
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.message == "putSession") {
      sessions[request.orgId] = request.session;
    }
    if (request.message == "getSession") {
      sendResponse(sessions[request.orgId]);
    }
  });

}