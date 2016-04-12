"use strict";

let args = new URLSearchParams(location.search.slice(1));
sfHost = args.get("host");
chrome.runtime.sendMessage({message: "getSession", sfHost}, function(message) {
  session = message;
  let sobjectName = args.get("object");
  if (!sobjectName.endsWith("__c")) {
    location.replace("https://" + session.hostname + "/p/setup/layout/LayoutFieldList?type=" + sobjectName + "&setupid=" + sobjectName + "Fields");
  } else {
    let parts = sobjectName.split("__");
    let namespacePrefix, developerName;
    if (parts.length == 2) {
      namespacePrefix = "";
      developerName = parts[0];
    } else { // parts.length == 3
      namespacePrefix = parts[0];
      developerName = parts[1];
    }
    askSalesforce("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("select Id from CustomObject where NamespacePrefix = '" + namespacePrefix + "' and DeveloperName = '" + developerName + "'"))
      .then(res => location.replace("https://" + session.hostname + "/" + res.records[0].Id.slice(0, -3)))
      .catch(function(err) { console.log("Error showing object setup", err); document.title = "Error"; document.body.textContent = "Error showing object setup"; });
  }
});
