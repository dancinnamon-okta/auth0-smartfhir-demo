/**
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {
    //We only want to run this action if we're in the middle of a token refresh.
    if(event.transaction && event.transaction.protocol !== 'oauth2-refresh-token') {
      return;
    }
  
    const crypto = require('crypto');
    const secret = event.secrets.REFRESH_TOKEN_HASH_SECRET;
    const hash = crypto.createHmac('sha256', secret)
                    .update(event.request.body.refresh_token)
                    .digest('hex');
  
    //Take the refresh token we've been passed, hash it, and then look for the hash on the appUser profile.
    //We'll look up any custom consent details from there.
    //TODO: should store the consent details JWT vs. just the patient id to prevent tampering by admins. 
    //Could also just store it externally like I do with Okta CIS.
    if(event.user.app_metadata.refreshTokenData) {
        const refreshTokenData = event.user.app_metadata.refreshTokenData.find(o => o.refreshToken === hash);
        if(refreshTokenData && refreshTokenData.launch_response_patient) {
            console.log('Found refresh token data');
            console.log(refreshTokenData);
            //Selected Patient claim handling.
            api.accessToken.setCustomClaim('launch_response_patient', refreshTokenData.launch_response_patient);
    
            //fhirUser claim handling.
            //If requested_scopes exists- it means that on refresh the client is trying to narrow the scopes.
            //This should take precedence, and if the client removes fhirUser from their list on the request, 
            //we should account for that and no longer include the claim.
            //Otherwise if the client doesn't send any scopes in at refresh time, we'll load it from cache based upon initial selections.
            if(event.transaction && event.transaction.requested_scopes) {
                if(event.transaction.requested_scopes.includes('fhirUser')) {
                    api.idToken.setCustomClaim('fhirUser', event.user.app_metadata.fhirUser);
                }
            }
            else if(refreshTokenData.scope.includes('fhirUser')) {
                api.idToken.setCustomClaim('fhirUser', event.user.app_metadata.fhirUser);
            }
        }
    }
    else {
      console.log('No cached data found. Skipping...');
    }
};