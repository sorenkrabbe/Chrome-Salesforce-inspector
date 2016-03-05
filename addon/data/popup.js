"use strict";
parent.postMessage({insextInitRequest: true}, "*");
addEventListener("message", function initResponseHandler(e) {
  if (e.source == parent && e.data.insextInitResponse) {
    removeEventListener("message", initResponseHandler);
    orgId = e.data.orgId;
    init(e.data);
  }
});

function closePopup() {
  parent.postMessage({insextClosePopup: true}, "*");
}

function init(params) {
  var recordId = null;
  var isDevConsole = params.isDevConsole;
  var inAura = params.inAura;
  var inInspector = params.inInspector;

  addEventListener("message", function(e) {
    if (e.source == parent && e.data.insextUpdateRecordId) {
      recordId = e.data.recordId;
      document.querySelector('#showStdPageDetailsBtn').disabled = inAura || detailsShown || !recordId;
      document.querySelector('#showAllDataBtn').disabled = !recordId;
    }
  });

  var sobjects = null;
  var detailsShown = false;
  addEventListener('keypress', keyListener);
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
  
  // Click handlers for the buttons
  function showStdPageDetailsClick() {
    if (detailsShown || !recordId) {
      return;
    }
    document.querySelector('#showStdPageDetailsBtn').disabled = true;
    detailsShown = true;
    document.querySelector("#spinner").removeAttribute("hidden");
    parent.postMessage({insextShowStdPageDetails: true}, "*");
    addEventListener("message", function messageHandler(e) {
      if (e.source == parent && e.data.insextShowStdPageDetails) {
        removeEventListener("message", messageHandler);
        document.querySelector("#spinner").setAttribute("hidden", "");
        if (e.data.success) {
          closePopup();
        } else {
          document.querySelector('#showStdPageDetailsBtn').disabled = false;
          detailsShown = false;
        }
      }
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
    showAllData({recordId: document.querySelector('#showAllDataInp').value});
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

  if (isDevConsole || inInspector) {
    document.querySelector('#thispage').style.display = "none";
  }
  if (!isDevConsole) {
    document.querySelector('#apiExploreBtn').style.display = "none";
  }
  document.querySelector('#showStdPageDetailsBtn').addEventListener('click', showStdPageDetailsClick);
  document.querySelector('#showAllDataBtn').addEventListener('click', showAllDataClick);
  document.querySelector('#showAllDataInp').addEventListener('keypress', showAllDataKeypress);
  document.querySelector('#dataExportBtn').addEventListener('click', dataExportClick);
  document.querySelector('#dataImportBtn').addEventListener('click', dataImportClick);
  document.querySelector('#apiExploreBtn').addEventListener('click', apiExploreClick);
  document.querySelector('#aboutLnk').addEventListener('click', function(){ 
    open('https://github.com/sorenkrabbe/Chrome-Salesforce-inspector'); 
  });
  document.querySelector('#showAllDataInp').addEventListener("focus", function focusListener(e) {
    e.target.removeEventListener("focus", focusListener);
    if (sobjects == null) {
      sobjects = new Promise(function(resolve, reject) {
        document.querySelector("#spinner").removeAttribute("hidden");
        chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
          session = message;
          resolve();
        });
      })
      .then(function() {
        return askSalesforce('/services/data/v' + apiVersion + '/sobjects/');
      })
      .then(function(res) {
        document.querySelector("#spinner").setAttribute("hidden", "");
        return res.sobjects;
      })
      .catch(function() {
        document.querySelector("#spinner").setAttribute("hidden", "");
      });
    }
    sobjects.then(function(sobjects) {
      var datalist = document.querySelector("#sobjects");
      sobjects.forEach(function(sobject) {
        var option = document.createElement("option");
        option.value = sobject.name;
        datalist.appendChild(option);
      });
    });
  });
  document.body.classList.remove("loading");
}
