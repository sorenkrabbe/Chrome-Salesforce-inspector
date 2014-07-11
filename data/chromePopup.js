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
        <div class="insext-btn" tabindex="0" title="Show Salesforce details">\
            <img src="/s.gif" class="menuArrow" />\
        </div>\
        <div class="insext-popup">\
            <h3>Salesforce inspector</h3>\
            <button id="showStdPageDetailsBtn">Show field metadata</button>\
            <button id="showAllDataBtn">Show all data</button>\
            <div class="meta"><a href="#" id="aboutLnk">About</a></div>\
        </div>\
    </div>';
    buttonParent.appendChild(f.firstChild);
    document.querySelector('.insext-btn').addEventListener('click', function() {
        document.querySelector('#insext').classList.toggle('insext-active');
    });
    
    document.querySelector('#showStdPageDetailsBtn').addEventListener('click', function() {
        showStdPageDetails();
        document.querySelector('#insext').classList.remove('insext-active');
    });
    document.querySelector('#showAllDataBtn').addEventListener('click', function() {
        showAllData();
        document.querySelector('#insext').classList.remove('insext-active');
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

function askSalesforce(url, callback){
    if (!session) {
        alert("Session not found");
        callback();
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://" + document.location.hostname + url, true);
    xhr.setRequestHeader('Authorization', "OAuth " + session);
    xhr.setRequestHeader('Accept', "application/json");
    xhr.onreadystatechange = function(){
        if (xhr.readyState == 4) {
            callback(xhr.responseText);
            //console.log(JSON.parse(xhr.responseText));
        }
    }
    xhr.send();
}
