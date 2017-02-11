/* exported sfConn apiVersion async */
"use strict";

var apiVersion = "39.0"; // eslint-disable-line no-var
var sfConn = { // eslint-disable-line no-var

  getSession(sfHost) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({message: "getSession", sfHost}, message => {
        if (message) {
          this.instanceHostname = message.hostname;
          this.sessionId = message.key;
        }
        resolve();
      });
    });
  },

  rest(url, options) {
    return new Promise((resolve, reject) => {
      options = options || {};
      if (!sfConn.instanceHostname || !sfConn.sessionId) {
        reject(new Error("Session not found"));
        return;
      }
      url += (url.includes("?") ? "&" : "?") + "cache=" + Math.random();
      let xhr = new XMLHttpRequest();
      if (options.progressHandler) {
        options.progressHandler.abort = result => {
          resolve(result);
          xhr.abort();
        };
      }
      xhr.open(options.method || "GET", "https://" + sfConn.instanceHostname + url, true);
      xhr.setRequestHeader("Authorization", "OAuth " + sfConn.sessionId);
      xhr.setRequestHeader("Accept", "application/json");
      if (options.body || options.bodyText) {
        xhr.setRequestHeader("Content-Type", "application/json");
      }
      xhr.responseType = "json";
      xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
          if (xhr.status == 200) {
            resolve(xhr.response);
          } else if (xhr.status == 204) {
            resolve(null);
          } else {
            console.error("Received error response from Salesforce REST API", xhr);
            let text;
            if (xhr.status == 400 && xhr.response) {
              try {
                text = xhr.response.map(err => err.errorCode + ": " + err.message).join("\n");
              } catch (ex) {
                // empty
              }
            }
            if (xhr.status == 0) {
              text = "Network error, offline or timeout";
            }
            if (!text) {
              text = "HTTP error " + xhr.status + " " + xhr.statusText + (xhr.response ? "\n\n" + JSON.stringify(xhr.response) : "");
            }
            reject({sfConnError: text});
          }
        }
      };
      xhr.send(JSON.stringify(options.body) || options.bodyText);
    });
  },

  wsdl(apiVersion, apiName) {
    return {
      Enterprise: {
        servicePortAddress: "/services/Soap/c/" + apiVersion,
        targetNamespace: "urn:enterprise.soap.sforce.com"
      },
      Partner: {
        servicePortAddress: "/services/Soap/u/" + apiVersion,
        targetNamespace: "urn:partner.soap.sforce.com"
      },
      Apex: {
        servicePortAddress: "/services/Soap/s/" + apiVersion,
        targetNamespace: "http://soap.sforce.com/2006/08/apex"
      },
      Metadata: {
        servicePortAddress: "/services/Soap/m/" + apiVersion,
        targetNamespace: "http://soap.sforce.com/2006/04/metadata"
      },
      Tooling: {
        servicePortAddress: "/services/Soap/T/" + apiVersion,
        targetNamespace: "urn:tooling.soap.sforce.com"
      }
    }[apiName];
  },

  soap(wsdl, method, args) {
    return Promise.resolve()
      .then(() => {
        function buildRequest(el, params) {
          if (params == null) {
            el.setAttribute("xsi:nil", "true");
          } else if (typeof params == "object") {
            for (let [key, value] of Object.entries(params)) {
              if (key == "$xsi:type") {
                el.setAttribute("xsi:type", value);
              } else if (value === undefined) {
                // ignore
              } else if (Array.isArray(value)) {
                for (let element of value) {
                  let x = doc.createElement(key);
                  buildRequest(x, element);
                  el.appendChild(x);
                }
              } else {
                let x = doc.createElement(key);
                buildRequest(x, value);
                el.appendChild(x);
              }
            }
          } else {
            el.textContent = params;
          }
        }
        let doc = document.implementation.createDocument("", method);
        buildRequest(doc.documentElement, args);
        let req = new XMLSerializer().serializeToString(doc);
        return sfConn.rawSoap(wsdl, req);
      })
      .then(res => {
        function parseResponse(element) {
          let str = ""; // XSD Simple Type value
          let obj = null; // XSD Complex Type value
          // If the element has child elements, it is a complex type. Otherwise we assume it is a simple type.
          if (element.getAttribute("xsi:nil") == "true") {
            return null;
          }
          let type = element.getAttribute("xsi:type");
          if (type) {
            // Salesforce never sets the xsi:type attribute on simple types. It is only used on sObjects.
            obj = {
              "$xsi:type": type
            };
          }
          for (let child = element.firstChild; child != null; child = child.nextSibling) {
            if (child instanceof CharacterData) {
              str += child.data;
            } else if (child instanceof Element) {
              if (obj == null) {
                obj = {};
              }
              let name = child.localName;
              let content = parseResponse(child);
              if (name in obj) {
                if (obj[name] instanceof Array) {
                  obj[name].push(content);
                } else {
                  obj[name] = [obj[name], content];
                }
              } else {
                obj[name] = content;
              }
            } else {
              throw new Error("Unknown child node type");
            }
          }
          return obj || str;
        }
        let body = res.querySelector(method + "Response");
        let parsed = parseResponse(body).result;
        return parsed;
      });
  },

  rawSoap(wsdl, xmlBody) {
    return new Promise((resolve, reject) => {
      if (!sfConn.instanceHostname || !sfConn.sessionId) {
        reject(new Error("Session not found"));
        return;
      }
      let xhr = new XMLHttpRequest();
      xhr.open("POST", "https://" + sfConn.instanceHostname + wsdl.servicePortAddress + "?cache=" + Math.random(), true);
      xhr.setRequestHeader("Content-Type", "text/xml");
      xhr.setRequestHeader("SOAPAction", '""');
      xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
          resolve(xhr);
        }
      };
      xhr.send('<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Header xmlns="' + wsdl.targetNamespace + '"><SessionHeader><sessionId>' + sfConn.sessionId + '</sessionId></SessionHeader></soapenv:Header><soapenv:Body xmlns="' + wsdl.targetNamespace + '">' + xmlBody + '</soapenv:Body></soapenv:Envelope>'); // eslint-disable-line quotes
    }).then(xhr => {
      if (xhr.status == 200) {
        return xhr.responseXML;
      } else {
        console.error("Received error response from Salesforce SOAP API", xhr);
        let errorText;
        if (xhr.responseXML != null) {
          errorText = xhr.responseXML.querySelector("faultstring").textContent;
        } else {
          errorText = "Connection to Salesforce failed" + (xhr.status != 0 ? " (HTTP " + xhr.status + ")" : "");
        }
        throw {sfConnError: errorText, rawSoapError: xhr.responseXML};
      }
    });
  },

  asArray(x) {
    if (!x) return [];
    if (x instanceof Array) return x;
    return [x];
  },

};

function async(generator) {
  return function(...args) {
    let iterator = generator.apply(this, args);
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
  };
}
