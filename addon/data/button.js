"use strict";
// sfdcBody = normal Salesforce page
// ApexCSIPage = Developer Console
// auraLoadingBox = Lightning / Salesforce1
if (document.querySelector("body.sfdcBody, body.ApexCSIPage, #auraLoadingBox")) {
  // We are in a Salesforce org
  chrome.runtime.sendMessage({message: "getOrgId", url: location.href}, function(message) {
    orgId = message;
    if (orgId) {
      initButton(false);
    }
  });
}

function initButton(inInspector) {
  let rootEl = document.createElement("div");
  rootEl.id = "insext";
  let btn = document.createElement("div");
  btn.className = "insext-btn";
  btn.tabIndex = 0;
  btn.accessKey = "i";
  btn.title = "Show Salesforce details (Alt+I / Shift+Alt+I)";
  rootEl.appendChild(btn);
  let img = document.createElement("img");
  img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAPCAYAAADd/14OAAAA40lEQVQoz2P4//8/AzpWzGj6L59U/V8urgxMg/g4FUn6J/+X9E38LxWc8V8htR67IpCkuGfMfxCQjSpENRFFkXvk/1+/foGxQloDSD0DVkVfvnyBY7hCdEVv3rxBwXCFIIdKh2WDFT1+/BgDo1qd2fL/1q1bWDFcoW5xz3/Xppn/oycu/X/x4kUMDFeoWdD136R8wn+f9rlgxSdOnEDBKFajK96/fz8coyjEpnj79u1gjKEQXXFE/+L/Gzdu/G9WMfG/am4HZlzDFAf3LPwfOWEJWBPIwwzYUg9MsXXNFDAN4gMAmASShdkS4AcAAAAASUVORK5CYII=";
  btn.appendChild(img);
  document.body.appendChild(rootEl);
  btn.addEventListener("click", function clickListener() {
    btn.removeEventListener("click", clickListener);
    loadPopup();
  });

  function loadPopup() {
    btn.addEventListener("click", function() {
      if (!rootEl.classList.contains("insext-active")) {
        openPopup();
      } else {
        closePopup();
      }
    });

    let popupSrc = chrome.extension.getURL("data/popup.html");
    let popupEl = document.createElement("iframe");
    popupEl.className = "insext-popup";
    popupEl.src = popupSrc;
    addEventListener("message", function(e) {
      if (e.source == popupEl.contentWindow && e.data.insextInitRequest) {
        popupEl.contentWindow.postMessage({
          insextInitResponse: true,
          orgId: orgId,
          isDevConsole: !!document.querySelector("body.ApexCSIPage"),
          inAura: !!document.querySelector("#auraLoadingBox"),
          inInspector: inInspector
        }, "*");
        openPopup();
      }
      if (e.source == popupEl.contentWindow && e.data.insextClosePopup) {
        closePopup();
      }
      if (e.source == popupEl.contentWindow && e.data.insextShowStdPageDetails) {
        showStdPageDetails(getRecordId())
          .then(
            () => {
              popupEl.contentWindow.postMessage({insextShowStdPageDetails: true, success: true}, "*");
            },
            error => {
              console.error(error);
              popupEl.contentWindow.postMessage({insextShowStdPageDetails: true, success: false}, "*");
              alert(error);
            }
          );
      }
    });
    rootEl.appendChild(popupEl);
    function openPopup() {
      popupEl.contentWindow.postMessage({insextUpdateRecordId: true, recordId: getRecordId()}, "*");
      rootEl.classList.add("insext-active");
      // These event listeners are only enabled when the popup is active to avoid interfering with Salesforce when not using the inspector
      addEventListener("click", outsidePopupClick);
      popupEl.focus();
    }
    function closePopup() {
      rootEl.classList.remove("insext-active");
      removeEventListener("click", outsidePopupClick);
      popupEl.blur();
    }
    function outsidePopupClick(e) {
      // Close the popup when clicking outside it
      if (!rootEl.contains(e.target)) {
        closePopup();
      }
    }
    function getRecordId() {
      // Find record ID from URL
      let recordId = null;
      let match = document.location.search.match(/(\?|&)id=([a-zA-Z0-9]*)(&|$)/);
      if (match) {
        recordId = match[2];
      }
      if (!recordId && location.hostname.indexOf(".salesforce.com") > -1) {
        match = document.location.pathname.match(/\/([a-zA-Z0-9]*)(\/|$)/);
        if (match) {
          recordId = match[1];
        }
      }
      if (recordId && recordId.length != 3 && recordId.length != 15 && recordId.length != 18) {
        recordId = null;
      }
      if (!recordId && location.hostname.includes(".lightning.force.com")) {
        match = document.location.hash.match(/\/sObject\/([a-zA-Z0-9]*)(\/|$)/);
        if (match) {
          recordId = match[1];
        }
      }
      return recordId;
    }
  }

}
