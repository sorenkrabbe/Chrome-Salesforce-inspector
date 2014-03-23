var buttonParent = document.querySelector('.multiforce .navLinks .linkElements');
if (buttonParent) {
    // We are in a Salesforce org
    init();
}

function init() {
    var f = document.createElement('div');
    f.innerHTML = '<div id="insext">\
        <div class="insext-btn" tabindex="0" title="Show Salesforce details">\
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAB0klEQVQ4T6WS3U4aQRTH5wH6EPYJjC9kihcYIalKXfCTrVBoYnAX0AswJgY/cNsABqiiNcpi44UlNtr2ZkUvVHbRC0UvTGuM/J2ZRKKlKsZJfjmZmd85ZzIzBAB5CfcmXe9MqIdHC+xoOayufObxLrdrNQXWckrDJyV4Fg55MBZ+GuaFQx+gzAbOcqrymkRn5POZaQnl8iEuLo4ox09whNOTA0xGfKB552Qk6MTvX/M43lvC9dtXgJmgZKw/jL4Og/JzO41gwAkiDfegsPMVu4Vl7NUB8xgFbQnDvm6Qj14btn/MYWU5Qm+E1AVzt2iO12MDcQ5Y8C03iS+pEOyCGd83MrBarXC5XPei2+2me4sQuszcVVcnMNBvAbELLVCiQxgf86Kv14psdgHJZBKpVIqTTqerqGoGvT0W7k5FPPxJSX9f6x+HvQWjQRGi2IF8fgOSJCEWi0GWZcTjcfj9fiQSCWxu5iE62zFCXVtnM21o/kuUaKDRIZguXYM2+r4+FItF6LpexTCMKqVSiTvMtQtvLqPTclP1R70XO8vZbAaVSoUfXdM0fuy7kQ1VXQRza75yt6PtStcPuPTY0Iv7YC7+LdDRbqrp+FBk7n8LPIfbvBuXk+n0UFcoZAAAAABJRU5ErkJggg==">\
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
    if(url.substring(0,10) != '/services/') {
    	url  = '/services/data/v28.0' + url;
    }
    xhr.open("GET", "https://" + document.location.hostname + url, true);
    xhr.setRequestHeader('Authorization', "OAuth " + session);
    xhr.setRequestHeader('Accept', "application/json");
    xhr.onreadystatechange = function(){
        if (xhr.readyState == 4) {
            callback(xhr.responseText);
            console.log(JSON.parse(xhr.responseText));
            //console.log((xhr.responseText));
        }
    }
    xhr.send();
}
