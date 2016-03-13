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
      if (recordId) {
        document.querySelector('#showAllDataBtn').href = showAllDataUrl({recordId: recordId});
      } else {
        document.querySelector('#showAllDataBtn').removeAttribute("href");
      }
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
      document.querySelector('#showAllDataBtn').click();
    }
    if (e.charCode == "e".charCodeAt(0)) {
      e.preventDefault();
      document.querySelector('#dataExportBtn').click();
    }
    if (e.charCode == "i".charCodeAt(0)) {
      e.preventDefault();
      document.querySelector('#dataImportBtn').click();
    }
    if (e.charCode == "x".charCodeAt(0)) {
      e.preventDefault();
      document.querySelector('#apiExploreBtn').click();
    }
  }
  
  // Click handlers for the buttons
  function showStdPageDetailsClick() {
    if (detailsShown || !recordId) {
      return;
    }
    document.querySelector('#showStdPageDetailsBtn').disabled = true;
    detailsShown = true;
    document.querySelector('#showStdPageDetailsBtn').classList.add("loading");
    parent.postMessage({insextShowStdPageDetails: true}, "*");
    addEventListener("message", function messageHandler(e) {
      if (e.source == parent && e.data.insextShowStdPageDetails) {
        removeEventListener("message", messageHandler);
        document.querySelector('#showStdPageDetailsBtn').classList.remove("loading");
        if (e.data.success) {
          closePopup();
        } else {
          document.querySelector('#showStdPageDetailsBtn').disabled = false;
          detailsShown = false;
        }
      }
    });
  }
  function showAllDataKeypress(e) {
    if (e.keyCode != 13) {
      e.stopPropagation(); // Stop our keyboard shortcut handler
      return;
    }
    e.preventDefault();
    open(showAllDataUrl({recordId: document.querySelector('#showAllDataInp').value}));
    closePopup();
  }

  if (isDevConsole || inInspector) {
    document.querySelector('#thispage').style.display = "none";
  }
  if (!isDevConsole) {
    document.querySelector('#apiExploreBtn').style.display = "none";
  }
  if (isDevConsole) {
    for (let a of Array.from(document.querySelectorAll("a[target=_top]"))) {
      a.target = "_blank";
    }
  }
  document.querySelector('#showStdPageDetailsBtn').addEventListener('click', showStdPageDetailsClick);
  document.querySelector('#showAllDataInp').addEventListener('keypress', showAllDataKeypress);
  document.querySelector('#dataExportBtn').href = dataExportUrl();
  document.querySelector('#dataImportBtn').href = dataImportUrl();
  document.querySelector('#apiExploreBtn').href = apiExploreUrl();
  document.querySelector('#showAllDataInp').addEventListener("focus", function focusListener(e) {
    e.target.removeEventListener("focus", focusListener);
    if (sobjects == null) {
      sobjects = new Promise(function(resolve, reject) {
        document.querySelector("#showAllDataInp").classList.add("loading");
        chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
          session = message;
          resolve();
        });
      })
      .then(function() {
        return askSalesforce('/services/data/v' + apiVersion + '/sobjects/');
      })
      .then(function(res) {
        document.querySelector("#showAllDataInp").classList.remove("loading");
        return res.sobjects;
      })
      .catch(function() {
        document.querySelector("#showAllDataInp").classList.remove("loading");
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
