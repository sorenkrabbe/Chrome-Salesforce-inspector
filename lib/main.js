var pageMod = require("sdk/page-mod");
var self = require("sdk/self");
 
pageMod.PageMod({
  include: ["*.salesforce.com"],
  contentStyleFile: [self.data.url("chromePopup.css"), self.data.url("showAllDataForRecordPopup.css"), self.data.url("showStdPageDetails.css")],
  contentScriptFile: [self.data.url("chromePopup.js"), self.data.url("showAllDataForRecordPopup.js"), self.data.url("showStdPageDetails.js")]
});
