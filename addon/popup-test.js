export async function popupTest(test) {
  console.log("TEST popup");
  let {assertEquals, loadPage} = test;
  let {getRecordId} = await loadPage("test-page.html");
  // Classic & Console
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://na1.salesforce.com/001i0000007BlV0"))); // classic record detail page
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://cs81.salesforce.com/001i0000007BlV0"))); // in sandbox
  assertEquals("001i0000007BlV0AAK", getRecordId(new URL("https://na1.salesforce.com/001i0000007BlV0AAK"))); // with 18 character ID
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://mydomain.my.salesforce.com/001i0000007BlV0"))); // using My Domain
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://mydomain--sandbox.cs81.my.salesforce.com/001i0000007BlV0"))); // using My Domain in sandbox
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://na1.salesforce.com/001i0000007BlV0/e?retURL=xyz"))); // classic record edit page
  assertEquals("005i0000000Eths", getRecordId(new URL("https://na1.salesforce.com/_ui/core/userprofile/UserProfilePage?u=005i0000000Eths&tab=sfdc.ProfilePlatformFeed"))); // user profile page
  assertEquals("005i0000000Eths", getRecordId(new URL("https://na1.salesforce.com/005i0000000Eths?noredirect=1&isUserEntityOverride=1"))); // user detail page
  assertEquals("0Afi000000STGOj", getRecordId(new URL("https://na1.salesforce.com/changemgmt/monitorDeploymentsDetails.apexp?retURL=/changemgmt/monitorDeployment.apexp&asyncId=0Afi000000STGOj")));
  assertEquals(null, getRecordId(new URL("https://na1.salesforce.com/home/home.jsp"))); // no ID
  assertEquals(null, getRecordId(new URL("https://na1.salesforce.com/foofoofoofoofoo"))); // 15 character non-ID
  assertEquals("001", getRecordId(new URL("https://na1.salesforce.com/001/o"))); // record home
  assertEquals("001i0000007BlV0AAK", getRecordId(new URL("https://na1.salesforce.com/001i0000007BlV0AAK?id=a37E0000000DV1c"))); // prefer standard
  // Visualforce
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://na1.visual.force.com/apex/VfPage?id=001i0000007BlV0"))); // visualforce
  assertEquals("001i0000007BlV0AAK", getRecordId(new URL("https://na1.visual.force.com/apex/VfPage?id=001i0000007BlV0AAK"))); // visualforce with 18 character ID
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://na1.visual.force.com/apex/VfPage?scontrolCaching=1&id=001i0000007BlV0&retURL=xyz"))); // visualforce with other parameters
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://mydomain--c.na1.visual.force.com/apex/VfPage?id=001i0000007BlV0"))); // visualforce with My Domain
  assertEquals("a37E0000000DV1c", getRecordId(new URL("https://bmcservicedesk.na9.visual.force.com/apex/RemedyforceConsole?record_id=a37E0000000DV1c&objectName=Incident__c&inctype=Incident#false"))); // visuflforce page with non-standard parameter name
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://na1.visual.force.com/apex/VfPage?id=001i0000007BlV0&other=a37E0000000DV1c"))); // prefer standard parameter name
  assertEquals("a37E0000000DV1c", getRecordId(new URL("https://na1.visual.force.com/apex/VfPage?other=001i0000007BlV0&id=a37E0000000DV1c"))); // prefer standard parameter name
  assertEquals("001i0000007BlV0", getRecordId(new URL("https://na1.visual.force.com/apex/VfPage?other=001i0000007BlV0"))); // another non-standard name
  assertEquals(null, getRecordId(new URL("https://na1.visual.force.com/apex/VfPage?other=foo"))); // parameter containing 3 character non-ID
  assertEquals(null, getRecordId(new URL("https://na1.visual.force.com/apex/VfPage?other=foofoofoofoofoo"))); // parameter containing 15 character non-ID
  // Lightning Experience / Salesforce1 (Pre URL change: https://docs.releasenotes.salesforce.com/en-us/spring18/release-notes/rn_general_enhanced_urls_cruc.htm)
  assertEquals("Account", getRecordId(new URL("https://na1.lightning.force.com/one/one.app?source=aloha#/sObject/Account/home?t=1473700726105"))); // lightning record home
  assertEquals("Account", getRecordId(new URL("https://mydomain.lightning.force.com/one/one.app?source=aloha#/sObject/Account/home?t=1473700726105"))); // lightning record home with My Domain
  assertEquals("001i0000007BlV0AAK", getRecordId(new URL("https://na1.lightning.force.com/one/one.app?source=aloha#/sObject/001i0000007BlV0AAK/view?t=1473700726105"))); // lightning record detail page
  assertEquals("001i0000007BlV0AAK", getRecordId(new URL("https://na1.lightning.force.com/one/one.app?id=a37E0000000DV1c#/sObject/001i0000007BlV0AAK/view?t=1473700726105"))); // prefer standard
  assertEquals("a37E0000000DV1c", getRecordId(new URL("https://na1.lightning.force.com/one/one.app?id=a37E0000000DV1c#/foo?t=1473700726105"))); // support non-standard
  // Lightning Experience / Salesforce1
  assertEquals("001U0000004JEu4IAG", getRecordId(new URL("https://mydomain.lightning.force.com/lightning/r/Account/001U0000004JEu4IAG/view"))); // standard object record detail
  assertEquals("xxxU0000004JEu4IAG", getRecordId(new URL("https://mydomain.lightning.force.com/lightning/r/pack__Custom_Object1/xxxU0000004JEu4IAG/view"))); // custom object record detail
}
