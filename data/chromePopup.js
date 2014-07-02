var buttonParent = document.querySelector('body.sfdcBody');
if (buttonParent) {
    // We are in a Salesforce org
    init();
}

function init() {
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

function askSalesforce(url, callback){
    var session = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
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
