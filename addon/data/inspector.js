"use strict";

var session, orgId;

var apiVersion = "36.0";

function openFieldSetup(sobjectName, fieldName) {
  let w = open(""); // Open the new tab synchronously, to avoid the pop-up blocker, then later redirect it when we have the URL
  if (!fieldName.endsWith("__c") && !fieldName.endsWith("__pc")) {
    if (fieldName.substr(-2) == "Id" && fieldName != "Id") {
      fieldName = fieldName.slice(0, -2);
    }
    if (!sobjectName.endsWith("__c")) {
      w.location = "https://" + session.hostname + "/p/setup/field/StandardFieldAttributes/d?id=" + fieldName + "&type=" + sobjectName;
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
        .then(res => w.location = "https://" + session.hostname + "/p/setup/field/StandardFieldAttributes/d?id=" + fieldName + "&type=" + res.records[0].Id.slice(0, -3))
        .catch(function(err) { console.log("Error showing field setup", err); w.location = "data:text/plain,Error showing field setup"; });
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
    askSalesforce("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("select Id from CustomField where EntityDefinition.QualifiedApiName = '" + sobjectName + "' and NamespacePrefix = '" + namespacePrefix + "' and DeveloperName = '" + developerName + "'"))
      .then(res => w.location = "https://" + session.hostname + "/" + res.records[0].Id.slice(0, -3))
      .catch(function(err) { console.log("Error showing field setup", err); w.location = "data:text/plain,Error showing field setup"; });
  }
}

function openObjectSetup(sobjectName) {
  let w = open(""); // Open the new tab synchronously, to avoid the pop-up blocker, then later redirect it when we have the URL
  if (!sobjectName.endsWith("__c")) {
    w.location = "https://" + session.hostname + "/p/setup/layout/LayoutFieldList?type=" + sobjectName + "&setupid=" + sobjectName + "Fields";
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
      .then(res => w.location = "https://" + session.hostname + "/" + res.records[0].Id.slice(0, -3))
      .catch(function(err) { console.log("Error showing field setup", err); w.location = "data:text/plain,Error showing field setup"; });
  }
}

function askSalesforce(url, progressHandler, options) {
  return new Promise(function(resolve, reject) {
    options = options || {};
    if (!session) {
      reject(new Error("Session not found"));
      return;
    }
    url += (url.indexOf("?") > -1 ? '&' : '?') + 'cache=' + Math.random();
    var xhr = new XMLHttpRequest();
    if (progressHandler) {
      progressHandler.abort = function(result) {
        resolve(result);
        xhr.abort();
      }
    }
    xhr.open(options.method || "GET", "https://" + session.hostname + url, true);
    xhr.setRequestHeader('Authorization', "OAuth " + session.key);
    xhr.setRequestHeader('Accept', "application/json");
    if (options.body) {
      xhr.setRequestHeader('Content-Type', "application/json");
    }
    xhr.responseType = "json";
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          resolve(xhr.response);
        } else if (xhr.status == 204) {
          resolve(null);
        } else {
          console.error("Received error response from Salesforce API", xhr);
          var text;
          if (xhr.status == 400 && xhr.response) {
            try {
              text = xhr.response.map(err => err.errorCode + ": " + err.message).join("\n");
            } catch(ex) {
            }
          }
          if (xhr.status == 0) {
            text = "Network error, offline or timeout";
          }
          if (!text) {
            text = "HTTP error " + xhr.status + " " + xhr.statusText + (xhr.response ? "\n\n" + JSON.stringify(xhr.response) : "");
          }
          reject({askSalesforceError: text});
        }
      }
    }
    xhr.send(JSON.stringify(options.body));
  });
}

function askSalesforceSoap(url, namespace, request) {
  return new Promise(function(resolve, reject) {
    if (!session) {
      reject(new Error("Session not found"));
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://" + session.hostname + url + "?cache=" + Math.random(), true);
    xhr.setRequestHeader('Content-Type', "text/xml");
    xhr.setRequestHeader('SOAPAction', '""');
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          resolve(xhr.responseXML);
        } else {
          reject(xhr);
        }
      }
    }
    xhr.send('<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Header xmlns="' + namespace + '"><SessionHeader><sessionId>' + session.key + '</sessionId></SessionHeader></soapenv:Header><soapenv:Body xmlns="' + namespace + '">' + request + '</soapenv:Body></soapenv:Envelope>');
  });
}

function dataExportUrl(options) {
  return chrome.extension.getURL("data/dataExport.html") + "?" + encodeURIComponent(btoa(JSON.stringify({orgId: orgId, options: options})));
}

function dataImportUrl() {
  return chrome.extension.getURL("data/dataImport.html") + "?" + encodeURIComponent(btoa(JSON.stringify({orgId: orgId})));
}

function showAllDataUrl(recordDesc) {
  return chrome.extension.getURL("data/showAllData.html") + "?" + encodeURIComponent(btoa(JSON.stringify({orgId: orgId, recordDesc: recordDesc})));
}

function apiExploreUrl(options) {
  return chrome.extension.getURL("data/apiExplore.html") + "?" + encodeURIComponent(btoa(JSON.stringify({orgId: orgId, options: options})));
}
