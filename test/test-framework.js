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
    let msg = new Error("assert failed: " + msg);
    console.error(msg);
    throw msg;
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

function vfRemoteAction(controllerMethod) {
  // Calling @RemoteAction in Visualforce controller
  let args = Array.prototype.slice.call(arguments, 1);
  return new Promise((resolve, reject) => {
    args.push((result, event) => {
      if (event.status) {
        resolve(result);
      } else {
        reject(event)
      }
    });
    args.push({buffer: false, escape: false});
    controllerMethod.apply(null, args);
  });
}

async(function*() {
  yield* dataImportTest();
  yield* dataExportTest();
}()).then(e => { console.log("Salesforce Inspector unit test finished"); }, e => { console.error("error", e); });
