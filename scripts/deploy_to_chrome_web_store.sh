#!/bin/bash         
     
# Two command line params expected: "CHROME_APP_ID ENVIRONMENT_TYPE (PROD|BETA)"
#
# The script is designed to run in CI context in the directory of the Salesforce Inspector project.
# Will package and upload BUT NOT RELEASE the addon to Chrome Web Store. 
#
# Version numbers will be set to the value defined in version.json
#
# CI service could be setup with the following command to only upload when commit message contains "#releaseit":
#    if [[ ${CI_MESSAGE^^} != *"#RELEASEIT"* ]]; then echo "Release tag (#releaseIt) not found in commit message. Stopping build for commit ID: $CI_COMMIT_ID"; else scripts/deploy_to_chrome_web_store.sh; fi;
#

CHROME_APP_ID=$1         # first URL parameter
ENVIRONMENT_TYPE=$2      # second URL parameter - PROD|BETA
#CHROME_CLIENT_ID=""     # Securely defined in environment
#CHROME_CLIENT_SECRET="" # Securely defined in environment
#CHROME_REFRESH_TOKEN="" # Securely defined in environment
#CI_COMMIT_ID=""         # Populated by environment
CHROME_ACCESS_TOKEN=""
export ZIP_FILE_NAME="target/chrome/salesforceInspectorForChrome-$CI_COMMIT_ID-$ENVIRONMENT_TYPE.zip"

log_message() {
     printf "** $1\n";
}
log_error() {
     printf "!! $1\n";
}
log_detail() {
     printf "   -------- \n$1\n   --------\n";
}

log_message "0) Should release?";

log_message "0.1) Auth with google (renew access token)"
CHROME_ACCESS_TOKEN=$( \
     curl "https://www.googleapis.com/oauth2/v3/token" \
          -s -d "client_id=$CHROME_CLIENT_ID&client_secret=$CHROME_CLIENT_SECRET&refresh_token=$CHROME_REFRESH_TOKEN&grant_type=refresh_token" \
     | jq '.access_token')
if [[ $CHROME_ACCESS_TOKEN == null ]]
then
     log_error "0.1.1) Login to google failed!";
     exit 1;
fi

log_message "0.2) Is source different"
SOURCE_VERSION_NUMBER=$(jq '.version' addon/manifest-template.json | tr -d '"');
ONLINE_VERSION_NUMBER=$(curl \
     -H "Authorization: Bearer $CHROME_ACCESS_TOKEN" \
     -H "x-goog-api-version: 2" \
     -X GET -L -s \
     https://chrome.google.com/webstore/detail/$CHROME_APP_ID|sed -n 's/.*<meta itemprop="version" content="\([^"]*\)" \/>.*/\1/p')

if [[ $SOURCE_VERSION_NUMBER == $ONLINE_VERSION_NUMBER ]]
then
     log_message "0.2) -> No - source version number is same as online version number ($SOURCE_VERSION_NUMBER)";
     exit 0
fi

log_message "0.2) -> Yes - source version \"$SOURCE_VERSION_NUMBER\" will be uploaded to replace online version \"$ONLINE_VERSION_NUMBER\"";

log_message "1) Prepare application app package";

. $NVM_DIR/nvm.sh
nvm install 7
npm install
# Uses ENVIRONMENT_TYPE and ZIP_FILE_NAME
npm run chrome-release-build

log_message "2) Push to chrome web store"

log_message "2.2) Upload application to chrome web store"
UPLOAD_RESULT=$(curl \
     -H "Authorization: Bearer $CHROME_ACCESS_TOKEN" \
     -H "x-goog-api-version: 2" \
     -X PUT -s \
     -T $ZIP_FILE_NAME https://www.googleapis.com/upload/chromewebstore/v1.1/items/$CHROME_APP_ID \
     | jq '.')

if [[ $(echo $UPLOAD_RESULT | jq '.uploadState') == '"SUCCESS"' ]]
     then
     log_message "2.2.1) Upload succesful!";
else
     log_error "2.2.1) Upload failed";
     log_detail "$UPLOAD_RESULT";
     exit 1;
fi

if [[ $ENVIRONMENT_TYPE == "BETA" ]]
then
     log_message "2.3) Publish new version to trusted testers"

     PUBLISH_RESULT=$(curl \
          -H "Authorization: Bearer $CHROME_ACCESS_TOKEN"  \
          -H "x-goog-api-version: 2" \
          -H "Content-Type: application/json" -d '{"target":"trustedTesters"}' \
          -X POST -v \
          https://www.googleapis.com/chromewebstore/v1.1/items/$CHROME_APP_ID/publish \
          | jq '.')

     if [[ $(echo $PUBLISH_RESULT | jq '.status[0]') == '"OK"' ]]
          then
          log_message "2.3.1) Publish succesful!";
     else
          log_error "2.3.1) Publish failed";
          log_detail "$PUBLISH_RESULT";
          exit 1;
     fi
fi

log_message "3) Release logic completed.";

exit 0;
