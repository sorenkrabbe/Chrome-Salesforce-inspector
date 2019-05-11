/* eslint-disable no-unused-vars */
/* exported initButton */
/* global showStdPageDetails */
/* eslint-enable no-unused-vars */
"use strict";

// sfdcBody = normal Salesforce page
// ApexCSIPage = Developer Console
// auraLoadingBox = Lightning / Salesforce1

chrome.runtime.onMessage.addListener((request) => {
  if (request.message === "open_menu") {
    togglePopup();
  }
});

if (document.querySelector("body.sfdcBody, body.ApexCSIPage, #auraLoadingBox")) {
  // We are in a Salesforce org
  chrome.runtime.sendMessage({message: "getSfHost", url: location.href}, sfHost => {
    if (sfHost) {
      initButton(sfHost, false);
    }
  });
}

const rootElId = "insext";
const btnElId = "insext-btn";
const popupElId = "insext-popup";
const popupLoadStates = {
  NOT_LOADED: 0,
  LOADING: 1,
  LOADED: 2
};

let sfHost;
let inInspector;
let popupLoadStateCode;

function initButton(host, isInInspector) {
  popupLoadStateCode = popupLoadStates.NOT_LOADED;
  sfHost = host;
  inInspector = isInInspector;
  let rootEl = document.createElement("div");
  rootEl.id = rootElId;
  let btn = document.createElement("div");
  btn.id = btnElId;
  btn.className = "insext-btn";
  btn.tabIndex = 0;
  btn.accessKey = "i";
  btn.title = "Show Salesforce details (Alt+I / Shift+Alt+I)";
  rootEl.appendChild(btn);
  let img = document.createElement("img");
  img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAPCAYAAADd/14OAAAA40lEQVQoz2P4//8/AzpWzGj6L59U/V8urgxMg/g4FUn6J/+X9E38LxWc8V8htR67IpCkuGfMfxCQjSpENRFFkXvk/1+/foGxQloDSD0DVkVfvnyBY7hCdEVv3rxBwXCFIIdKh2WDFT1+/BgDo1qd2fL/1q1bWDFcoW5xz3/Xppn/oycu/X/x4kUMDFeoWdD136R8wn+f9rlgxSdOnEDBKFajK96/fz8coyjEpnj79u1gjKEQXXFE/+L/Gzdu/G9WMfG/am4HZlzDFAf3LPwfOWEJWBPIwwzYUg9MsXXNFDAN4gMAmASShdkS4AcAAAAASUVORK5CYII=";
  btn.appendChild(img);
  document.body.appendChild(rootEl);

  btn.addEventListener("click", () => {
    togglePopup();
  });
}

function loadPopup() {
  if (popupLoadStateCode >= popupLoadStates.LOADING) {
    return;
  }
  popupLoadStateCode = popupLoadStates.LOADING;

  const rootEl = getRootEl();
  let popupSrc = chrome.extension.getURL("popup.html");
  let popupEl = document.createElement("iframe");
  popupEl.id = popupElId;
  popupEl.className = "insext-popup";
  popupEl.src = popupSrc;
  addEventListener("message", e => {
    if (e.source != popupEl.contentWindow) {
      return;
    }
    if (e.data.insextInitRequest) {
      popupEl.contentWindow.postMessage({
        insextInitResponse: true,
        sfHost,
        forceTargetBlank: !!document.querySelector("body.ApexCSIPage"),
        showStdPageDetailsSupported: !document.querySelector("#auraLoadingBox") && !inInspector,
      }, "*");
    }
    if (e.data.insextShowStdPageDetails) {
      showStdPageDetails(sfHost, e.data.insextData);
    }
  });
  rootEl.appendChild(popupEl);
  popupLoadStateCode = popupLoadStates.LOADED;
}

function togglePopup() {
  loadPopup();
  const rootEl = getRootEl();
  if (!rootEl.classList.contains("insext-active")) {
    openPopup();
  } else {
    closePopup();
  }
}

function openPopup() {
  const popupEl = getPopupEl();
  const rootEl = getRootEl();
  popupEl.contentWindow.postMessage({insextUpdateRecordId: true, locationHref: location.href}, "*");
  rootEl.classList.add("insext-active");
  // These event listeners are only enabled when the popup is active to avoid interfering with Salesforce when not using the inspector
  addEventListener("click", outsidePopupClick);
  popupEl.focus();
}

function closePopup() {
  const popupEl = getPopupEl();
  const rootEl = getRootEl();
  rootEl.classList.remove("insext-active");
  removeEventListener("click", outsidePopupClick);
  popupEl.blur();
}

function outsidePopupClick(e) {
  const rootEl = getRootEl();
  // Close the popup when clicking outside it
  if (!rootEl.contains(e.target)) {
    closePopup();
  }
}

function getPopupEl() {
  return document.getElementById(popupElId);
}

function getRootEl() {
  return document.getElementById(rootElId);
}
