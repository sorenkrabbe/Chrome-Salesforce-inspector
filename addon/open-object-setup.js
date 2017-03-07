/* eslint-disable no-unused-vars */
/* global sfConn apiVersion */
/* eslint-enable no-unused-vars */
"use strict";

let args = new URLSearchParams(location.search.slice(1));
let sfHost = args.get("host");
sfConn.getSession(sfHost).then(() => {
  let sobjectName = args.get("object");
  if (!sobjectName.endsWith("__c")) {
    location.replace("https://" + sfHost + "/p/setup/layout/LayoutFieldList?type=" + sobjectName + "&setupid=" + sobjectName + "Fields");
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
    sfConn.rest("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("select Id from CustomObject where NamespacePrefix = '" + namespacePrefix + "' and DeveloperName = '" + developerName + "'"))
      .then(res => location.replace("https://" + sfHost + "/" + res.records[0].Id.slice(0, -3)))
      .catch(err => { console.log("Error showing object setup", err); document.title = "Error"; document.body.textContent = "Error showing object setup"; });
  }
});
