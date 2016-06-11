"use strict";

var session, sfHost;

var apiVersion = "37.0";

function askSalesforce(url, progressHandler, options) {
  return new Promise((resolve, reject) => {
    options = options || {};
    if (!session) {
      reject(new Error("Session not found"));
      return;
    }
    url += (url.includes("?") ? "&" : "?") + "cache=" + Math.random();
    let xhr = new XMLHttpRequest();
    if (progressHandler) {
      progressHandler.abort = result => {
        resolve(result);
        xhr.abort();
      }
    }
    xhr.open(options.method || "GET", "https://" + session.hostname + url, true);
    xhr.setRequestHeader("Authorization", "OAuth " + session.key);
    xhr.setRequestHeader("Accept", "application/json");
    if (options.body) {
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
          console.error("Received error response from Salesforce API", xhr);
          let text;
          if (xhr.status == 400 && xhr.response) {
            try {
              text = xhr.response.map(err => err.errorCode + ": " + err.message).join("\n");
            } catch(ex) {
            }
          }
          if (xhr.status == 0) {
            text = "Network error, offline or timeout";
          }
          if (!text) {
            text = "HTTP error " + xhr.status + " " + xhr.statusText + (xhr.response ? "\n\n" + JSON.stringify(xhr.response) : "");
          }
          reject({askSalesforceError: text});
        }
      }
    }
    xhr.send(JSON.stringify(options.body));
  });
}

function askSalesforceSoap(url, namespace, request) {
  return new Promise((resolve, reject) => {
    if (!session) {
      reject(new Error("Session not found"));
      return;
    }
    let xhr = new XMLHttpRequest();
    xhr.open("POST", "https://" + session.hostname + url + "?cache=" + Math.random(), true);
    xhr.setRequestHeader("Content-Type", "text/xml");
    xhr.setRequestHeader("SOAPAction", '""');
    xhr.onreadystatechange = () => {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          resolve(xhr.responseXML);
        } else {
          reject(xhr);
        }
      }
    }
    xhr.send('<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Header xmlns="' + namespace + '"><SessionHeader><sessionId>' + session.key + '</sessionId></SessionHeader></soapenv:Header><soapenv:Body xmlns="' + namespace + '">' + request + '</soapenv:Body></soapenv:Envelope>');
  });
}
