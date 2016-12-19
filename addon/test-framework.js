/* eslint-disable no-unused-vars */
/* exported test */
/* global session:true sfHost:true apiVersion askSalesforce:true askSalesforceSoap:true */
/* exported session sfHost */
/* global popupTest csvParseTest dataImportTest dataExportTest */
/* eslint-enable no-unused-vars */
"use strict";
let seenError = false;
let test = {
  assertEquals(expected, actual) {
    let strExpected = JSON.stringify(expected);
    let strActual = JSON.stringify(actual);
    if (strExpected !== strActual) {
      seenError = true;
      let msg = new Error("assertEquals failed: Expected " + strExpected + " but found " + strActual + ".");
      console.error(msg);
      throw msg;
    }
  },

  assertThrows(expected, fn) {
    let strExpected = JSON.stringify(expected);
    let res;
    try {
      res = fn();
    } catch (actual) {
      let strActual = JSON.stringify(actual);
      if (strExpected !== strActual) {
        seenError = true;
        let msg = new Error("assertThrows failed: Expected " + strExpected + " but found " + strActual + ".");
        console.error(msg);
        throw msg;
      }
      return;
    }
    seenError = true;
    let strRes = JSON.stringify(res);
    let msg = new Error("assertThrows failed: Expected thrown " + strExpected + " but found returned " + strRes + ".");
    console.error(msg);
    throw msg;
  },

  assertNotEquals(expected, actual) {
    let strExpected = JSON.stringify(expected);
    let strActual = JSON.stringify(actual);
    if (strExpected === strActual) {
      seenError = true;
      let msg = new Error("assertNotEquals failed: Found " + strActual + ".");
      console.error(msg);
      throw msg;
    }
  },

  assert(truth, msg) {
    if (!truth) {
      seenError = true;
      console.error("assert failed", msg);
      let err = new Error("assert failed: " + msg);
      throw err;
    }
  },

  loadPage(url) {
    return new Promise(resolve => {
      addEventListener("message", function handler(e) {
        if (e.data.insextTestLoaded) {
          removeEventListener("message", handler);
          resolve(window.page.contentWindow);
        }
      });
      let args = new URLSearchParams();
      args.set("host", sfHost);
      window.page.src = url + "?" + args;
    });
  },

  *anonApex(apex) {
    window.anonApex.removeAttribute("hidden");
    let res = yield askSalesforce("/services/data/v" + apiVersion + "/tooling/executeAnonymous/?anonymousBody=" + encodeURIComponent(apex));
    window.anonApex.setAttribute("hidden", "");
    test.assert(res.success, res);
  }
};

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

this.isUnitTest = true;

addEventListener("load", () => {
  async(function*() {
    try {
      let args = new URLSearchParams(location.search.slice(1));
      sfHost = args.get("host");
      session = yield new Promise(resolve => {
        chrome.runtime.sendMessage({message: "getSession", sfHost}, resolve);
      });
      yield* popupTest();
      yield* csvParseTest();
      yield* dataImportTest();
      yield* dataExportTest();
      test.assert(!seenError, "Expected no error");
      console.log("Salesforce Inspector unit test finished successfully");
      window.result.textContent = "Salesforce Inspector unit test finished successfully";
      window.page.src = "data:text/plain,Salesforce Inspector unit test finished successfully";
    } catch (e) {
      console.error("error", e);
      window.result.textContent = "Error: " + e;
    }
  }());
});
