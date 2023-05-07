function (user, context, callback) {
  
  console.log("what is user app_metadata", user.app_metadata); 
  console.log("what is user user_metadata", user.user_metadata); 
  
  const jwt = require('jsonwebtoken');
  if(context.protocol !== 'oidc-basic-profile') {
    //If we're not on the first /authorize call, then we should skip.
    //If we're on a token refresh, or a callback from the patient picker we don't need this rule.
    return callback(null, user, context);
  }
    //Calculate JWT to send user context to the picker app
    const token = createToken(
      configuration.PICKER_CLIENT_ID,
      configuration.PICKER_CLIENT_SECRET,
      configuration.CUSTOM_AUTH0_DOMAIN_URL,
      {
        sub: user.user_id,
        requested_client_id: context.clientID,
        requested_scopes: context.request.query.scope, 
        tenant: user.user_metadata.tenant
      }
    );
    //Redirect to the patient picker. this is the GET CALL. 
    context.redirect = {
      url: configuration.PICKER_URL + `?token=${token}`
    };
    return callback(null, user, context);
  
  function createToken(clientId, clientSecret, issuer, user) {
    const options = {
      expiresIn: '15m',
      audience: clientId,
      issuer: issuer
    };
    
    console.log("what is the context here", context); 
    
    return jwt.sign({...user, tenant: user.tenant}, clientSecret, options);
  }
}