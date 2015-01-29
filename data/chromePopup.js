var buttonParent = document.querySelector('body.sfdcBody');
if (buttonParent) {
    // We are in a Salesforce org
    init();
}

var session;

function init() {
    // When on a *.visual.force.com page, the session in the cookie does not have API access,
    // so we read the session from a cache stored in memory.
    // When visiting a *.salesforce.com page, we store the session cookie in the cache.
    // The first part of the session cookie is the OrgID,
    // which we use as key to support being logged in to multiple orgs at once.
    // http://salesforce.stackexchange.com/questions/23277/different-session-ids-in-different-contexts
    var orgId = document.cookie.match(/(^|;\s*)sid=(.+?)!/)[2];
    if (location.hostname.indexOf(".salesforce.com") > -1) {
        session = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
        if (this.self && self.port) {
            // Firefox
            self.port.emit("putSession", orgId, session);
        } else {
            // Chrome
            chrome.runtime.sendMessage({message: "putSession", orgId: orgId, session: session});
        }
    } else if (location.hostname.indexOf(".visual.force.com") > -1) {
        if (this.self && self.port) {
            // Firefox
            self.port.emit("getSession", orgId);
            self.port.on("getSession", function(message) {
                session = message;
            });
        } else {
            // Chrome
            chrome.runtime.sendMessage({message: "getSession", orgId: orgId}, function(message) {
                session = message;
            });
        }
    }
    
    var f = document.createElement('div');
    f.innerHTML = '<div id="insext">\
        <div class="insext-btn" tabindex="0" accesskey="i" title="Show Salesforce details (Alt+I / Shift+Alt+I)">\
            <img src="/s.gif" class="menuArrow" />\
        </div>\
        <div class="insext-popup">\
            <img id="insext-spinner" src="/img/loading32.gif" hidden>\
            <h3>Salesforce inspector</h3>\
            <button id="showStdPageDetailsBtn">Show field metadata (m)</button>\
            <button id="showAllDataBtn">Show all data (a)</button>\
            <button id="dataExportBtn">Data Export (e)</button>\
            <button id="dataImportBtn">Data Import (i)</button>\
            <div class="meta"><a href="#" id="aboutLnk">About</a></div>\
        </div>\
    </div>';
    var rootEl = f.firstChild;
    buttonParent.appendChild(rootEl);
    document.querySelector('.insext-btn').addEventListener('click', function() {
        if (!rootEl.classList.contains('insext-active')) {
            rootEl.classList.add('insext-active');
            // These event listeners are only enabled when the popup is active to avoid interfering with Salesforce when not using the inspector
            addEventListener('keypress', keyListener);
            addEventListener('click', outsidePopupClick);
            var ws = document.querySelector('#presence_widgetstatus');
            if (ws) {
                ws.addEventListener('focus', removeConflictingFocus);
            }
        } else {
            closePopup();
        }
    });
    function closePopup() {
        rootEl.classList.remove('insext-active');
        removeEventListener('keypress', keyListener);
        removeEventListener('click', outsidePopupClick);
        var ws = document.querySelector('#presence_widgetstatus');
        if (ws) {
            ws.removeEventListener('focus', removeConflictingFocus);
        }
    }
    function keyListener(e) {
        if (e.charCode == 109 /*m*/) {
            showStdPageDetails();
            closePopup();
            e.preventDefault();
        }
        if (e.charCode == 97 /*a*/) {
            showAllData({recordId: getRecordIdFromUrl()});
            closePopup();
            e.preventDefault();
        }
        if (e.charCode == 101 /*e*/) {
            dataExport();
            closePopup();
            e.preventDefault();
        }
        if (e.charCode == 105 /*i*/) {
            dataImport();
            closePopup();
            e.preventDefault();
        }
    }
    function outsidePopupClick(e) {
        // Close the popup when clicking outside it
        if (!rootEl.contains(e.target)) {
            closePopup();
        }
    }
    function removeConflictingFocus(e) {
        e.target.blur();
    }
    
    document.querySelector('#showStdPageDetailsBtn').addEventListener('click', function() {
        document.querySelector('#showStdPageDetailsBtn').disabled = true;
        document.querySelector("#insext-spinner").removeAttribute("hidden");
        showStdPageDetails().then(function() {
          document.querySelector("#insext-spinner").setAttribute("hidden", "");
          closePopup();
        });
    });
    document.querySelector('#showAllDataBtn').addEventListener('click', function() {
        showAllData({recordId: getRecordIdFromUrl()});
        closePopup();
    });
    document.querySelector('#dataExportBtn').addEventListener('click', function() {
        dataExport();
        closePopup();
    });
    document.querySelector('#dataImportBtn').addEventListener('click', function() {
        dataImport();
        closePopup();
    });
    document.querySelector('#aboutLnk').addEventListener('click', function(){ 
        open('https://github.com/sorenkrabbe/Chrome-Salesforce-inspector'); 
    });
}

function getRecordIdFromUrl() {
    var urlSearch = document.location.search;
    var recordId = urlSearch.indexOf('?id=') > -1 ? urlSearch.substring(urlSearch.indexOf('?id=') + '?id='.length)
        : urlSearch.indexOf('&id=') > -1 ? urlSearch.substring(urlSearch.indexOf('&id=') + '&id='.length)
        : document.location.pathname.substring(1);
    if (recordId.indexOf('&') > -1) {
        recordId = recordId.substring(0, recordId.indexOf('&'));
    }
    return recordId;
}

function loadMetadataForRecordId(recordId) {
    return askSalesforce('/services/data/v32.0/sobjects/').then(function(responseText) {
        var currentObjKeyPrefix = recordId.substring(0, 3);
        var generalMetadataResponse = JSON.parse(responseText);
        for (var i = 0; i < generalMetadataResponse.sobjects.length; i++) {
            if (generalMetadataResponse.sobjects[i].keyPrefix == currentObjKeyPrefix) {
                return askSalesforce(generalMetadataResponse.sobjects[i].urls.describe);
            }
        }
        throw 'Unknown salesforce object. Unable to identify current page\'s object type based on key prefix: ' + currentObjKeyPrefix;
    });
}

function askSalesforce(url) {
    return new Promise(function(resolve, reject) {
        if (!session) {
            reject(new Error("Session not found"));
            return;
        }
        url += (url.indexOf("?") > -1 ? '&' : '?') + 'cache=' + Math.random();
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "https://" + document.location.hostname + url, true);
        xhr.setRequestHeader('Authorization', "OAuth " + session);
        xhr.setRequestHeader('Accept', "application/json");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    resolve(xhr.responseText);
                } else {
                    reject(xhr);
                }
            }
        }
        xhr.send();
    });
}

function askSalesforceSoap(request) {
    return new Promise(function(resolve, reject) {
        if (!session) {
            reject(new Error("Session not found"));
            return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://" + document.location.hostname + '/services/Soap/u/32.0?cache=' + Math.random(), true);
        xhr.setRequestHeader('Content-Type', "text/xml");
        xhr.setRequestHeader('SOAPAction', '""');
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    resolve(xhr.responseXML);
                } else {
                    reject(xhr);
                }
            }
        }
        xhr.send('<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Header xmlns="urn:partner.soap.sforce.com"><SessionHeader><sessionId>' + session + '</sessionId></SessionHeader></soapenv:Header><soapenv:Body xmlns="urn:partner.soap.sforce.com">' + request + '</soapenv:Body></soapenv:Envelope>');
    });
}
