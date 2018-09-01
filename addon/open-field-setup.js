/* eslint-disable no-unused-vars */
/* global sfConn apiVersion */
/* eslint-enable no-unused-vars */
"use strict";

let args = new URLSearchParams(location.search.slice(1));
let sfHost = args.get("host");
sfConn.getSession(sfHost).then(() => {
  let sobjectName = args.get("object");
  if (sobjectName == "Task" || sobjectName == "Event") { sobjectName = "Activity"; }
  let fieldName = args.get("field");
  if (!fieldName.endsWith("__c") && !fieldName.endsWith("__pc")) {
    if (fieldName.endsWith("Id") && fieldName != "Id") {
      fieldName = fieldName.slice(0, -2);
    }
    if (!sobjectName.endsWith("__c")) {
      location.replace("https://" + sfHost + "/p/setup/field/StandardFieldAttributes/d?id=" + fieldName + "&type=" + sobjectName);
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
        .then(res => location.replace("https://" + sfHost + "/p/setup/field/StandardFieldAttributes/d?id=" + fieldName + "&type=" + res.records[0].Id.slice(0, -3)))
        .catch(err => { console.log("Error showing field setup", err); document.title = "Error"; document.body.textContent = "Error showing field setup"; });
    }
  } else {
    let parts = fieldName.split("__");
    let namespacePrefix, developerName, suffix;
    if (parts.length == 2) {
      namespacePrefix = "";
      developerName = parts[0];
      suffix = parts[1];
    } else { // parts.length == 3
      namespacePrefix = parts[0];
      developerName = parts[1];
      suffix = parts[2];
    }
    if (suffix == "pc" && sobjectName == "Account") {
      sobjectName = "Contact";
    }
    sfConn.rest("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("select Id from CustomField where EntityDefinition.QualifiedApiName = '" + sobjectName + "' and NamespacePrefix = '" + namespacePrefix + "' and DeveloperName = '" + developerName + "'"))
      .then(res => location.replace("https://" + sfHost + "/" + res.records[0].Id.slice(0, -3)))
      .catch(err => { console.log("Error showing field setup", err); document.title = "Error"; document.body.textContent = "Error showing field setup"; });
  }
});
