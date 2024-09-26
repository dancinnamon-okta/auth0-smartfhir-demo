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
  
    //Get our passed in launch context if it exists.
    var launchContext = (event.request.body && event.request.body.launch_context) ? JSON.parse(event.request.body.launch_context) : null
    const requestedScopes = (event.request.body && event.request.body.scope) ? event.request.body.scope.split(' ') : null
    const originalScopes = (launchContext && launchContext.scope) ? launchContext.scope : null
    delete launchContext.scope
  
    //If we have our launch context, decorate the token with that context.
    if(launchContext) {
      for (var claim in launchContext) {
          api.accessToken.setCustomClaim(`launch_response_${claim}`, launchContext[claim])
      }
    }
    else {
      console.log('No launch context found. Skipping...');
    }
  
    //Let's add the fhirUser claim if it's requested and granted.
    if(requestedScopes && requestedScopes.includes('fhirUser')) {
      api.idToken.setCustomClaim('fhirUser', event.user.app_metadata.fhirUser);
    }
    //Let's add the fhirUser claim if the scope was originally granted, and we didn't request any scopes this time.
    else if(!requestedScopes && originalScopes && originalScopes.includes('fhirUser')) {
      api.idToken.setCustomClaim('fhirUser', event.user.app_metadata.fhirUser);
    }
  };