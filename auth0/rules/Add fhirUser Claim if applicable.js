function addfhirUserClaim(user, context, callback) {
	const req = context.request;
  const requestedScopeString = (req.query && req.query.scope) || (req.body && req.body.scope);
  const requestedScopes = requestedScopeString ? requestedScopeString.split(' ') : [];
	if(requestedScopes.includes('fhirUser')) 	{
    console.log("Application requested fhirUser scope- including in id_token.", requestedScopes, user.app_metadata);
    context.idToken.fhirUser = user.app_metadata.fhirUser;
    context.accessToken.fhirUser = user.app_metadata.fhirUser;
  }
  
  context.idToken.tenant = user.user_metadata.tenant; 
  context.accessToken.tenant = user.user_metadata.tenant; 
  
  return callback(null, user, context);
}
