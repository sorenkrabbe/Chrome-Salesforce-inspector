"use strict";
// sfdcBody = normal Salesforce page
// ApexCSIPage = Developer Console
// auraLoadingBox = Lightning / Salesforce1
if (document.querySelector("body.sfdcBody, body.ApexCSIPage, #auraLoadingBox")) {
  // We are in a Salesforce org
  chrome.runtime.sendMessage({message: "getSfHost", url: location.href}, function(message) {
    sfHost = message;
    if (sfHost) {
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

    let popupSrc = chrome.extension.getURL("popup.html");
    let popupEl = document.createElement("iframe");
    popupEl.className = "insext-popup";
    popupEl.src = popupSrc;
    addEventListener("message", function(e) {
      if (e.source == popupEl.contentWindow && e.data.insextInitRequest) {
        popupEl.contentWindow.postMessage({
          insextInitResponse: true,
          sfHost: sfHost,
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
        showStdPageDetails(getRecordId(location))
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
      popupEl.contentWindow.postMessage({insextUpdateRecordId: true, recordId: getRecordId(location)}, "*");
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
  }

}

function getRecordId(url) {
  // Find record ID from URL
  let searchParams = new URLSearchParams(url.search.substring(1));
  // Salesforce Classic and Console
  if (url.hostname.endsWith(".salesforce.com")) {
    let match = url.pathname.match(/\/([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/);
    if (match) {
      let res = match[1];
      if (res.includes("0000") || res.length == 3) {
        return match[1];
      }
    }
  }
  // Lightning Experience and Salesforce1
  if (url.hostname.endsWith(".lightning.force.com")) {
    let match = url.hash.match(/\/sObject\/([a-zA-Z0-9]+)(?:\/|$)/);
    if (match) {
      return match[1];
    }
  }
  // Visualforce
  {
    let idParam = searchParams.get("id");
    if (idParam) {
      return idParam;
    }
  }
  // Visualforce page that does not follow standard Visualforce naming
  for (let [, p] of searchParams) {
    if (p.match(/^([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/) && p.includes("0000")) {
      return p;
    }
  }
  return null;
}
