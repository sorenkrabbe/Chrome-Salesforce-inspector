"use strict";
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Perform cookie operations in the background page, because not all foreground pages have access to the cookie API.
  if (request.message == "getOrgId") {
    chrome.cookies.get({url: request.url, name: "sid"}, cookie => {
      if (!cookie) {
        sendResponse(null);
        return;
      }
      let orgId = cookie.value.split("!")[0];
      sendResponse(orgId);
    });
    return true; // Tell Chrome that we want to call sendResponse asynchronously.
  }
  if (request.message == "getSession") {
    // When on a *.visual.force.com page, the session in the cookie does not have API access,
    // so we read the corresponding session from *.salesforce.com page.
    // The first part of the session cookie is the OrgID,
    // which we use as key to support being logged in to multiple orgs at once.
    // http://salesforce.stackexchange.com/questions/23277/different-session-ids-in-different-contexts
    let orgId = request.orgId;
    chrome.cookies.getAll({name: "sid", domain: "salesforce.com", secure: true}, cookies => {
      let sessionCookie = cookies.filter(c => c.value.split("!")[0] == orgId)[0];
      if (!sessionCookie) {
        sendResponse(null);
        return;
      }
      let session = {key: sessionCookie.value, hostname: sessionCookie.domain};
      sendResponse(session);
    });
    return true; // Tell Chrome that we want to call sendResponse asynchronously.
  }
});
