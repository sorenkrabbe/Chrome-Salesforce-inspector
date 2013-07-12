/**
 * When this script file is injected, the Salesforce session token will be extracted (and thereby returned to the creator of the popup)
 */

var sessionToken = document.cookie.match(/(^|;\s*)sid=(.+?);/)[2];
var salesforceHostname = document.location.hostname;
var recordId = document.location.pathname.substring(1);
var result = { 
    'sessionToken': sessionToken,
    'salesforceHostname': salesforceHostname,
    'recordId': recordId
};

result; //Return values to the callback of the function injecting the script.