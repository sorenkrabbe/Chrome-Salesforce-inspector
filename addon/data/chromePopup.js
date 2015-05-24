// sfdcBody = normal Salesforce page
// ApexCSIPage = Developer Console
var buttonParent = document.querySelector('body.sfdcBody, body.ApexCSIPage');
if (buttonParent) {
  // We are in a Salesforce org
  init();
}

var session;

function init() {
  // When on a *.visual.force.com page, the session in the cookie does not have API access,
  // so we read the session from a cache stored in memory.
  // When visiting a *.salesforce.com page, we store the session cookie in the cache.
  // The first part of the session cookie is the OrgID,
  // which we use as key to support being logged in to multiple orgs at once.
  // http://salesforce.stackexchange.com/questions/23277/different-session-ids-in-different-contexts
  var orgId = document.cookie.match(/(^|;\s*)sid=(.+?)!/)[2];
  if (location.hostname.indexOf(".salesforce.com") > -1) {
    session = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
    if (this.self && self.port) {
      // Firefox
      self.port.emit("putSession", orgId, session);
    } else {
      // Chrome
      chrome.runtime.sendMessage({message: "putSession", orgId: orgId, session: session});
    }
  } else if (location.hostname.indexOf(".visual.force.com") > -1) {
    if (this.self && self.port) {
      // Firefox
      self.port.emit("getSession", orgId);
      self.port.on("getSession", function(message) {
        session = message;
      });
    } else {
      // Chrome
      chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
        session = message;
      });
    }
  }
  
  var f = document.createElement('div');
  f.innerHTML = '<div id="insext">\
    <div class="insext-btn" tabindex="0" accesskey="i" title="Show Salesforce details (Alt+I / Shift+Alt+I)">\
      <img src="/s.gif" class="menuArrow" />\
    </div>\
  </div>';
  var rootEl = f.firstChild;
  buttonParent.appendChild(rootEl);
  document.querySelector('.insext-btn').addEventListener('click', function() {
    if (!rootEl.classList.contains('insext-active')) {
      openPopup();
    } else {
      closePopup();
    }
  });
}

var closePopup = null;
var detailsShown = false;
function openPopup() {
  var el = document.createElement('div');
  el.innerHTML = '<div class="insext-popup">\
    <img id="insext-spinner" src="/img/loading32.gif" hidden>\
    <h3>Salesforce inspector</h3>\
    <button id="insext-showStdPageDetailsBtn">Show field metadata (m)</button>\
    <button id="insext-showAllDataBtn">Show all data (a)</button>\
    <button id="insext-dataExportBtn">Data Export (e)</button>\
    <button id="insext-dataImportBtn">Data Import (i)</button>\
    <button id="insext-apiExploreBtn">Explore API (x)</button>\
    <div class="insext-meta"><div class="insext-version">(v<!--##VERSION##-->)</div><a href="#" id="insext-aboutLnk">About</a></div>\
  </div>\
  ';
  var popupEl = el.firstChild;
  var rootEl = document.getElementById("insext");
  rootEl.appendChild(popupEl);
  rootEl.classList.add('insext-active');
  // These event listeners are only enabled when the popup is active to avoid interfering with Salesforce when not using the inspector
  addEventListener('keypress', keyListener);
  addEventListener('click', outsidePopupClick);
  var ws = document.querySelector('#presence_widgetstatus');
  if (ws) {
    ws.addEventListener('focus', removeConflictingFocus);
  }
  closePopup = function() {
    rootEl.removeChild(popupEl);
    rootEl.classList.remove('insext-active');
    removeEventListener('keypress', keyListener);
    removeEventListener('click', outsidePopupClick);
    if (ws) {
      ws.removeEventListener('focus', removeConflictingFocus);
    }
    closePopup = null;
  }
  function keyListener(e) {
    if (e.charCode == "m".charCodeAt(0)) {
      e.preventDefault();
      showStdPageDetailsClick();
    }
    if (e.charCode == "a".charCodeAt(0)) {
      e.preventDefault();
      showAllDataClick();
    }
    if (e.charCode == "e".charCodeAt(0)) {
      e.preventDefault();
      dataExportClick();
    }
    if (e.charCode == "i".charCodeAt(0)) {
      e.preventDefault();
      dataImportClick();
    }
    if (e.charCode == "x".charCodeAt(0)) {
      e.preventDefault();
      apiExploreClick();
    }
  }
  function outsidePopupClick(e) {
    // Close the popup when clicking outside it
    if (!rootEl.contains(e.target)) {
      closePopup();
    }
  }
  function removeConflictingFocus(e) {
    e.target.blur();
  }

  // Find record ID from URL
  var urlSearch = document.location.search;
  var recordId = null;
  var match = document.location.search.match(/(\?|&)id=([a-zA-Z0-9]*)(&|$)/);
  if (match) {
    recordId = match[2];
  } else {
    match = document.location.pathname.match(/\/([a-zA-Z0-9]*)(\/|$)/);
    if (match) {
      recordId = match[1];
    }
  }
  if (recordId.length != 3 && recordId.length != 15 && recordId.length != 18) {
    recordId = null;
  }

  // Click handlers for the buttons
  function showStdPageDetailsClick() {
    if (detailsShown || !recordId) {
      return;
    }
    document.querySelector('#insext-showStdPageDetailsBtn').disabled = true;
    detailsShown = true;
    document.querySelector("#insext-spinner").removeAttribute("hidden");
    showStdPageDetails(recordId)
      .catch(function(error) {
        alert(error);
        detailsShown = false;
      })
      .then(function() {
        closePopup();
      });
  }
  function showAllDataClick() {
    if (!recordId) {
      return;
    }
    showAllData({recordId: recordId});
    closePopup();
  }
  function dataExportClick() {
    dataExport();
    closePopup();
  }
  function dataImportClick() {
    dataImport();
    closePopup();
  }
  function apiExploreClick() {
    apiExplore();
    closePopup();
  }

  if (detailsShown || !recordId) {
    document.querySelector('#insext-showStdPageDetailsBtn').disabled = true;
  }
  if (!recordId) {
    document.querySelector('#insext-showAllDataBtn').disabled = true;
  }
  document.querySelector('#insext-showStdPageDetailsBtn').addEventListener('click', showStdPageDetailsClick);
  document.querySelector('#insext-showAllDataBtn').addEventListener('click', showAllDataClick);
  document.querySelector('#insext-dataExportBtn').addEventListener('click', dataExportClick);
  document.querySelector('#insext-dataImportBtn').addEventListener('click', dataImportClick);
  document.querySelector('#insext-apiExploreBtn').addEventListener('click', apiExploreClick);
  document.querySelector('#insext-aboutLnk').addEventListener('click', function(){ 
    open('https://github.com/sorenkrabbe/Chrome-Salesforce-inspector'); 
  });
}

function loadMetadataForRecordId(recordId) {
  return Promise
    .all([
      askSalesforce('/services/data/v33.0/sobjects/'),
      askSalesforce('/services/data/v33.0/tooling/sobjects/')
    ])
    .then(function(responses) {
      var currentObjKeyPrefix = recordId.substring(0, 3);
      for (var x = 0; x < responses.length; x++) {
        var generalMetadataResponse = responses[x];
        for (var i = 0; i < generalMetadataResponse.sobjects.length; i++) {
          if (generalMetadataResponse.sobjects[i].keyPrefix == currentObjKeyPrefix) {
            return askSalesforce(generalMetadataResponse.sobjects[i].urls.describe);
          }
        }
      }
      throw 'Unknown salesforce object. Unable to identify current page\'s object type based on key prefix: ' + currentObjKeyPrefix;
    });
}

function loadFieldSetupData(sobjectName) {
  return askSalesforce("/services/data/v33.0/tooling/query/?q=" + encodeURIComponent("select Id, FullName from CustomField")).then(function(res) {
    var fieldIds = {};
    res.records.forEach(function(customField) {
      fieldIds[customField.FullName] = customField.Id;
    });
    return fieldIds;
  });
}

function getFieldSetupLink(fieldIds, sobjectDescribe, fieldDescribe) {
  if (!fieldDescribe.custom) {
    var name = fieldDescribe.name;
    if (name.substr(-2) == "Id" && name != "Id") {
      name = name.slice(0, -2);
    }
    return 'https://' + document.location.hostname + '/p/setup/field/StandardFieldAttributes/d?id=' + name + '&type=' + sobjectDescribe.name;
  } else {
    var fieldId = fieldIds[sobjectDescribe.name + '.' + fieldDescribe.name];
    if (!fieldId) {
      return null;
    }
    return 'https://' + document.location.hostname + '/' + fieldId;
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
    xhr.open(options.method || "GET", "https://" + document.location.hostname + url, true);
    xhr.setRequestHeader('Authorization', "OAuth " + session);
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
    xhr.open("POST", "https://" + document.location.hostname + '/services/Soap/u/33.0?cache=' + Math.random(), true);
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
    xhr.send('<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Header xmlns="urn:partner.soap.sforce.com"><SessionHeader><sessionId>' + session + '</sessionId></SessionHeader></soapenv:Header><soapenv:Body xmlns="urn:partner.soap.sforce.com">' + request + '</soapenv:Body></soapenv:Envelope>');
  });
}
