"use strict";
// sfdcBody = normal Salesforce page
// ApexCSIPage = Developer Console
// auraLoadingBox = Lightning / Salesforce1
if (document.querySelector('body.sfdcBody, body.ApexCSIPage, #auraLoadingBox')) {
  // We are in a Salesforce org

  // When on a *.visual.force.com page, the session in the cookie does not have API access,
  // so we read the session from a cache stored in memory.
  // When visiting a *.salesforce.com page, we store the session cookie in the cache.
  // The first part of the session cookie is the OrgID,
  // which we use as key to support being logged in to multiple orgs at once.
  // http://salesforce.stackexchange.com/questions/23277/different-session-ids-in-different-contexts
  orgId = document.cookie.match(/(^|;\s*)sid=(.+?)!/)[2];
  if (location.hostname.indexOf(".salesforce.com") > -1) {
    var session = {key: document.cookie.match(/(^|;\s*)sid=(.+?);/)[2], hostname: location.hostname};
    chrome.runtime.sendMessage({message: "putSession", orgId: orgId, session: session});
  }

  initPopup(false);
}

function initPopup(inInspector) {
  var f = document.createElement('div');
  f.innerHTML = '<div id="insext">\
    <div class="insext-btn" tabindex="0" accesskey="i" title="Show Salesforce details (Alt+I / Shift+Alt+I)">\
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAPCAYAAADd/14OAAAA40lEQVQoz2P4//8/AzpWzGj6L59U/V8urgxMg/g4FUn6J/+X9E38LxWc8V8htR67IpCkuGfMfxCQjSpENRFFkXvk/1+/foGxQloDSD0DVkVfvnyBY7hCdEVv3rxBwXCFIIdKh2WDFT1+/BgDo1qd2fL/1q1bWDFcoW5xz3/Xppn/oycu/X/x4kUMDFeoWdD136R8wn+f9rlgxSdOnEDBKFajK96/fz8coyjEpnj79u1gjKEQXXFE/+L/Gzdu/G9WMfG/am4HZlzDFAf3LPwfOWEJWBPIwwzYUg9MsXXNFDAN4gMAmASShdkS4AcAAAAASUVORK5CYII=">\
    </div>\
  </div>';
  var rootEl = f.firstChild;
  document.body.appendChild(rootEl);
  document.querySelector('.insext-btn').addEventListener('click', function() {
    if (!rootEl.classList.contains('insext-active')) {
      openPopup();
    } else {
      closePopup();
    }
  });

  var closePopup = null;
  var detailsShown = false;
  var sobjects = null;
  function openPopup() {
    var el = document.createElement('div');
    el.innerHTML = '<div class="insext-popup">\
      <div id="insext-spinner" hidden>&#x25dc;</div>\
      <h3>Salesforce inspector</h3>\
      <div id="insext-thispage">\
        <button id="insext-showStdPageDetailsBtn">Show field metadata (m)</button>\
        <button id="insext-showAllDataBtn">Show all data (a)</button>\
      </div>\
      <input id="insext-showAllDataInp" placeholder="Record ID, ID prefix or Sobject name" list="insext-sobjects">\
      <datalist id="insext-sobjects"></datalist>\
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
    }
    if (!recordId && location.hostname.indexOf(".salesforce.com") > -1) {
      match = document.location.pathname.match(/\/([a-zA-Z0-9]*)(\/|$)/);
      if (match) {
        recordId = match[1];
      }
    }
    if (!recordId && location.hostname.indexOf(".lightning.force.com") > -1) {
      match = document.location.hash.match(/\/sObject\/([a-zA-Z0-9]*)(\/|$)/);
      if (match) {
        recordId = match[1];
      }
    }
    if (recordId && recordId.length != 3 && recordId.length != 15 && recordId.length != 18) {
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
    function showAllDataKeypress(e) {
      if (e.keyCode != 13) {
        e.stopPropagation(); // Stop our keyboard shortcut handler
        return;
      }
      e.preventDefault();
      showAllData({recordId: document.querySelector('#insext-showAllDataInp').value});
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

    var isDevConsole = document.querySelector('body.ApexCSIPage');
    var inAura = document.querySelector('#auraLoadingBox');
    if (isDevConsole || inInspector) {
      document.querySelector('#insext-thispage').style.display = "none";
    }
    if (!isDevConsole) {
      document.querySelector('#insext-apiExploreBtn').style.display = "none";
    }
    if (inAura || detailsShown || !recordId) {
      document.querySelector('#insext-showStdPageDetailsBtn').disabled = true;
    }
    if (!recordId) {
      document.querySelector('#insext-showAllDataBtn').disabled = true;
    }
    document.querySelector('#insext-showStdPageDetailsBtn').addEventListener('click', showStdPageDetailsClick);
    document.querySelector('#insext-showAllDataBtn').addEventListener('click', showAllDataClick);
    document.querySelector('#insext-showAllDataInp').addEventListener('keypress', showAllDataKeypress);
    document.querySelector('#insext-dataExportBtn').addEventListener('click', dataExportClick);
    document.querySelector('#insext-dataImportBtn').addEventListener('click', dataImportClick);
    document.querySelector('#insext-apiExploreBtn').addEventListener('click', apiExploreClick);
    document.querySelector('#insext-aboutLnk').addEventListener('click', function(){ 
      open('https://github.com/sorenkrabbe/Chrome-Salesforce-inspector'); 
    });
    document.querySelector('#insext-showAllDataInp').addEventListener("focus", function focusListener(e) {
      e.target.removeEventListener("focus", focusListener);
      if (sobjects == null) {
        sobjects = new Promise(function(resolve, reject) {
          document.querySelector("#insext-spinner").removeAttribute("hidden");
          if (inInspector) {
            resolve();
          } else {
            chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
              session = {key: message.key, hostname: location.hostname};
              resolve();
            });
          }
        })
        .then(function() {
          return askSalesforce('/services/data/v35.0/sobjects/');
        })
        .then(function(res) {
          document.querySelector("#insext-spinner").setAttribute("hidden", "");
          return res.sobjects;
        })
        .catch(function() {
          document.querySelector("#insext-spinner").setAttribute("hidden", "");
        });
      }
      sobjects.then(function(sobjects) {
        var datalist = document.querySelector("#insext-sobjects");
        sobjects.forEach(function(sobject) {
          var option = document.createElement("option");
          option.value = sobject.name;
          datalist.appendChild(option);
        });
      });
    });
  }

}
