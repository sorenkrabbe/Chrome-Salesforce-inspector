/* eslint-disable no-unused-vars */
/* exported assertEquals assertNotEquals assert async anonApex isUnitTest */
/* global session:true sfHost:true apiVersion askSalesforce:true askSalesforceSoap:true */
/* exported session sfHost */
/* global popupTest dataImportTest dataExportTest */
/* eslint-enable no-unused-vars */
"use strict";
function assertEquals(expected, actual) {
  let strExpected = JSON.stringify(expected);
  let strActual = JSON.stringify(actual);
  if (strExpected !== strActual) {
    let msg = new Error("assertEquals failed: Expected " + strExpected + " but found " + strActual + ".");
    console.error(msg);
    throw msg;
  }
}

function assertNotEquals(expected, actual) {
  let strExpected = JSON.stringify(expected);
  let strActual = JSON.stringify(actual);
  if (strExpected === strActual) {
    let msg = new Error("assertNotEquals failed: Found " + strActual + ".");
    console.error(msg);
    throw msg;
  }
}

function assert(truth, msg) {
  if (!truth) {
    console.error("assert failed", msg);
    let err = new Error("assert failed: " + msg);
    throw err;
  }
}

function async(iterator) {
  return new Promise((resolve, reject) => {
    function await(step) {
      if (step.done) {
        resolve(step.value);
        return;
      }
      Promise.resolve(step.value).then(iterator.next.bind(iterator), iterator.throw.bind(iterator)).then(await, reject);
    }
    await(iterator.next());
  });
}

function* anonApex(apex) {
  let res = yield askSalesforce("/services/data/v" + apiVersion + "/tooling/executeAnonymous/?anonymousBody=" + encodeURIComponent(apex));
  assert(res.success, res);
}

this.isUnitTest = true;
addEventListener("load", () => {
  async(function*() {
    let args = new URLSearchParams(location.search.slice(1));
    sfHost = args.get("host");
    session = yield new Promise(resolve => {
      chrome.runtime.sendMessage({message: "getSession", sfHost}, resolve);
    });
    yield* popupTest();
    yield* dataImportTest();
    yield* dataExportTest();
  }()).then(() => { console.log("Salesforce Inspector unit test finished"); }, e => { console.error("error", e); });
});
