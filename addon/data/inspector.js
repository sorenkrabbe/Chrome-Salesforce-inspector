var session, orgId;

function loadFieldSetupData(sobjectName) {
  var objectsPromise = askSalesforce("/services/data/v34.0/tooling/query/?q=" + encodeURIComponent("select Id, DeveloperName, NamespacePrefix from CustomObject")).then(function(res) {
    var objectIds = {};
    res.records.forEach(function(customObject) {
      objectIds[(customObject.NamespacePrefix ? customObject.NamespacePrefix + "__" : "") + customObject.DeveloperName + "__c"] = customObject.Id.slice(0, -3);
    });
    return objectIds;
  });
  var fieldsPromise = askSalesforce("/services/data/v34.0/tooling/query/?q=" + encodeURIComponent("select Id, DeveloperName, NamespacePrefix, EntityDefinition.QualifiedApiName from CustomField")).then(function(res) {
    var fieldIds = {};
    res.records.forEach(function(customField) {
      // We build the API name from NamespacePrefix and DeveloperName, since we cannot query FullName when we query more than one field.
      fieldIds[customField.EntityDefinition.QualifiedApiName + "." + (customField.NamespacePrefix ? customField.NamespacePrefix + "__" : "") + customField.DeveloperName + "__c"] = customField.Id.slice(0, -3);
    });
    return fieldIds;
  });
  return Promise.all([objectsPromise, fieldsPromise]);
}

function getFieldSetupLink(fieldSetupData, sobjectName, fieldName) {
  var objectIds = fieldSetupData ? fieldSetupData[0] : {};
  var fieldIds = fieldSetupData ? fieldSetupData[1] : {};
  if (!fieldName.endsWith("__c")) {
    var name = fieldName;
    if (name.substr(-2) == "Id" && name != "Id") {
      name = name.slice(0, -2);
    }
    if (!sobjectName.endsWith("__c")) {
      return 'https://' + session.hostname + '/p/setup/field/StandardFieldAttributes/d?id=' + name + '&type=' + sobjectName;
    } else {
      var objectId = objectIds[sobjectName];
      if (!objectId) {
        return null;
      }
      return 'https://' + session.hostname + '/p/setup/field/StandardFieldAttributes/d?id=' + name + '&type=' + objectId;
    }
  } else {
    var fieldId = fieldIds[sobjectName + '.' + fieldName];
    if (!fieldId) {
      return null;
    }
    return 'https://' + session.hostname + '/' + fieldId;
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
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          resolve(JSON.parse(xhr.responseText));
        } else if (xhr.status == 204) {
          resolve(null);
        } else {
          reject(xhr);
        }
      }
    }
    xhr.send(JSON.stringify(options.body));
  });
}

function askSalesforceSoap(request) {
  return new Promise(function(resolve, reject) {
    if (!session) {
      reject(new Error("Session not found"));
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://" + session.hostname + '/services/Soap/u/34.0?cache=' + Math.random(), true);
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
    xhr.send('<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Header xmlns="urn:partner.soap.sforce.com"><SessionHeader><sessionId>' + session.key + '</sessionId></SessionHeader></soapenv:Header><soapenv:Body xmlns="urn:partner.soap.sforce.com">' + request + '</soapenv:Body></soapenv:Envelope>');
  });
}

function dataExport(options) {
  chrome.runtime.sendMessage({message: "dataExport", args: encodeURIComponent(btoa(JSON.stringify({orgId: orgId, options: options})))}, function(message) {});
}

function dataImport() {
  chrome.runtime.sendMessage({message: "dataImport", args: encodeURIComponent(btoa(JSON.stringify({orgId: orgId})))}, function(message) {});
}

function showAllData(recordDesc) {
  chrome.runtime.sendMessage({message: "showAllData", args: encodeURIComponent(btoa(JSON.stringify({orgId: orgId, recordDesc: recordDesc})))}, function(message) {});
}

function apiExplore(options) {
  chrome.runtime.sendMessage({message: "apiExplore", args: encodeURIComponent(btoa(JSON.stringify({orgId: orgId, options: options})))}, function(message) {});
}
