#!/bin/bash         
     
#
# The script is designed to run in CI context in the directory of the Salesforce Inspector project.
# Will package and upload BUT NOT RELEASE the addon to Chrome Web Store. 
#
# Version numbers will be set to the value defined in version.json
#
# CI service could be setup with the following command to only upload when commit message contains "#releaseit":
#    if [[ ${CI_MESSAGE^^} != *"#RELEASEIT"* ]]; then echo "Release tag (#releaseIt) not found in commit message. Stopping build for commit ID: $CI_COMMIT_ID"; else scripts/deploy_to_chrome_web_store.sh; fi;
#

CHROME_ACCESS_TOKEN=""
WORKING_DIR="temp"
ZIP_FILE_NAME="$WORKING_DIR/salesforceInspectorForChrome-$CI_COMMIT_ID.zip"

log_message() {
     printf "** $1\n";
}
log_error() {
     printf "!! $1\n";
}
log_detail() {
     printf "   -------- \n$1\n   --------\n";
}

mkdir -p $WORKING_DIR

log_message "0) Starting release logic...";

log_message "1) Prepare application app package";

VERSION_NUMBER=$(jq '.version' version.json | tr -d '"');

log_message "1.1) Set version number in app files (version $VERSION_NUMBER)"
sed -i .bak -e "s/<!--##VERSION##-->/${VERSION_NUMBER}/g" addon/manifest.json
sed -i .bak -e "s/<!--##VERSION##-->/${VERSION_NUMBER}/g" addon/data/chromePopup.js

log_message "1.2) Create ZIP file"
zip -r $ZIP_FILE_NAME . --exclude \*.git\* $WORKING_DIR\* log\* tmp\* scripts\* version.json docs\* test\* \*.md \*.bak

log_message "2) Push to chrome web store"

log_message "2.1) Auth with google (renew access token)"
CHROME_ACCESS_TOKEN=$( \
     curl "https://www.googleapis.com/oauth2/v3/token" \
          -s -d "client_id=$CHROME_CLIENT_ID&client_secret=$CHROME_CLIENT_SECRET&refresh_token=$CHROME_REFRESH_TOKEN&grant_type=refresh_token" \
     | jq '.access_token')
if [[ $CHROME_ACCESS_TOKEN == null ]]
then
     log_error "2.1.1) Login to google failed!";
     exit 1;
fi

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

log_message "3) Release logic completed.";

exit 0;
