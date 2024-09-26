/**
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {
    if(event.transaction && event.transaction.protocol !== 'oidc-basic-profile') {
      return; //We only want to run this if this is the initial /authorize.
    }
  
    if(event.user.app_metadata.authorizedPatients && event.user.app_metadata.authorizedPatients.length > 0) {
        api.prompt.render(event.secrets.FORM_ID, {
        "vars": {
          "requestedScopes": event.request.query.scope.split(' '),
          "authorizedPatients": event.user.app_metadata.authorizedPatients,
          "clientLogo": event.client.metadata.consentLogo ? event.client.metadata.consentLogo : event.secrets.DEFAULT_APP_LOGO_URL
        }
      });
    }
    else {
      api.access.deny('Your account has not been authorized for patient data access.');
    }
  }
  
  /**
  * @param {Event} event - Details about the user and the context in which they are logging in.
  * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
  */
  exports.onContinuePostLogin = async (event, api) => {
  try {
      //Selected patient claim handling.
      api.accessToken.setCustomClaim('launch_response_patient', event.prompt.fields.authorizedPatient);
  
      //fhirUser claim handling.
      if(event.prompt.fields.authorizedScopes.includes('fhirUser')) {
        api.idToken.setCustomClaim('fhirUser', event.user.app_metadata.fhirUser);
      }
  
      //Remove any scopes the user may have rejected.
      if(event.transaction) {
        const scopesToRemove = event.transaction.requested_scopes.filter((scope) => !event.prompt.fields.authorizedScopes.includes(scope))
  
        for (var i = 0; i < scopesToRemove.length; i++) {
          api.accessToken.removeScope(scopesToRemove[i]);
        } 
      }
    }
    catch(error) {
      console.log("Error - unable to validate inbound consent JWT.");
      console.log(error);
      api.access.deny('Unable to validate the user\'s consent.');
    }
  }