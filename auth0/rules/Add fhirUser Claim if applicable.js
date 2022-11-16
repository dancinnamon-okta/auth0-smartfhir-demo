function addfhirUserClaim(user, context, callback) {
	const req = context.request;
  const requestedScopeString = (req.query && req.query.scope) || (req.body && req.body.scope);
  const requestedScopes = requestedScopeString ? requestedScopeString.split(' ') : [];

  console.log("Requested scopes:");
  console.log(requestedScopes);
	if(requestedScopes.includes('fhirUser')) 	{
    console.log("Application requested fhirUser scope- including in id_token.");
    context.idToken.fhirUser = user.app_metadata.fhirUser;
    context.accessToken.fhirUser = user.app_metadata.fhirUser;
  }
  return callback(null, user, context);
}
