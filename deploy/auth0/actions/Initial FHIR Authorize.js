/**
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {
    if(event.transaction && event.transaction.protocol !== 'oidc-basic-profile') {
      return;
    }
  
    console.log('Requested aud:' + event.request.query.aud);
    console.log('Audience for SMART launch:' + event.secrets.SMART_AUD);
  
    //We need to ensure the aud value passed in matches our API.
    //If it doesn't- that's OK, but it's not a SMART launch request.
    if(!event.request.query.aud || event.request.query.aud !== event.secrets.SMART_AUD) {
      console.log('This request is not a SMART launch request. Falling back to normal behavior.');
      return;
    }
    else {
      console.log('SMART launch requested. Redirecting to consent...');
  
      //Calculate JWT to send user context to the picker app
      const token = api.redirect.encodeToken({
        secret: event.secrets.CONSENT_REDIRECT_SECRET,
        expiresInSeconds: 60, 
        payload: {
          audience: event.secrets.CONSENT_URL,
          requested_client_id: event.client.client_id,
          requested_scopes: event.request.query.scope
        }
      });
  
      //Redirect to the consent page w/ patient picker.
      api.redirect.sendUserTo(event.secrets.CONSENT_URL, {
        query: { token: token }
      });
    };
}
  
  
/**
 * Handler that will be invoked when this action is resuming after an external redirect. If your
 * onExecutePostLogin function does not perform a redirect, this function can be safely ignored.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
exports.onContinuePostLogin = async (event, api) => {
    try {
      const validatedPickerData = api.redirect.validateToken({
        secret: event.secrets.CONSENT_REDIRECT_SECRET,
        tokenParameterName: 'token'
      });
      console.log('Picker Data:');
      console.log(validatedPickerData);
  
      //Selected patient claim handling.
      api.accessToken.setCustomClaim('launch_response_patient', validatedPickerData.patient);
  
      //fhirUser claim handling.
      if(validatedPickerData.scopes.includes('fhirUser')) {
        api.idToken.setCustomClaim('fhirUser', event.user.app_metadata.fhirUser);
      }
  
      //Remove any scopes the user may have rejected.
      if(event.transaction) {
        const scopesToRemove = event.transaction.requested_scopes.filter((scope) => !validatedPickerData.scopes.includes(scope))
        console.log('Scopes to remove');
        console.log(scopesToRemove);
        for (var i = 0; i < scopesToRemove.length; i++) {
          api.accessToken.removeScope(scopesToRemove[i]);
        } 
      }
    }
    catch(error) {
      console.log("Error - unable to validate inbound consent JWT.");
      console.log(error);
      api.access.deny('An invalid consent token was presented.');
    }
};