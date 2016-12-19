/* eslint-disable no-unused-vars */
/* exported initButton sfHost */
/* global showStdPageDetails */
/* eslint-enable no-unused-vars */
"use strict";

// This is a slightly modified version of button.js. We should find a way to reuse some of that file instead of repeating it here.
let args = new URLSearchParams(location.search.slice(1));
let sfHost = args.get("host");
let locationHref = "https://" + sfHost;
chrome.runtime.sendMessage({message: "getSfHost", url: locationHref}, message => {
  sfHost = message;
  if (sfHost) {
    initButton(false);
  } else {
    console.log("Salesforce Inspector: No session found for host " + locationHref);
  }
});

function initButton(inInspector) {
  let rootEl = document.createElement("div");
  rootEl.id = "insext";
  document.body.appendChild(rootEl);

  let popupSrc = chrome.extension.getURL("popup.html");
  let popupEl = document.createElement("iframe");
  popupEl.className = "insext-popup";
  popupEl.src = popupSrc;
  addEventListener("message", e => {
    if (e.source != popupEl.contentWindow) {
      return;
    }
    if (e.data.insextInitRequest) {
      console.log("Salesforce Inspector: Init popup");
      popupEl.contentWindow.postMessage({
        insextInitResponse: true,
        sfHost,
        forceTargetBlank: !!document.querySelector("body.ApexCSIPage"),
        showStdPageDetailsSupported: !document.querySelector("#auraLoadingBox") && !inInspector,
      }, "*");
    }
    if (e.data.insextLoaded) {
      openPopup();
    }
    if (e.data.insextClosePopup) {
      closePopup();
    }
    if (e.data.insextShowStdPageDetails) {
      showStdPageDetails(e.data.insextData);
    }
  });
  rootEl.appendChild(popupEl);
  function openPopup() {
    console.log("Salesforce Inspector: Open popup");
    popupEl.contentWindow.postMessage({insextUpdateRecordId: true, locationHref}, "*");
    rootEl.classList.add("insext-active");
    parent.postMessage({insextTestLoaded: true}, "*");
    // These event listeners are only enabled when the popup is active to avoid interfering with Salesforce when not using the inspector
    popupEl.focus();
  }
  function closePopup() {
    rootEl.classList.remove("insext-active");
    popupEl.blur();
  }

}
