function (user, context, callback) {
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
        requested_scopes: context.request.query.scope
      }
    );
    //Redirect to the patient picker.
    context.redirect = {
      url: configuration.PICKER_URL + '?token=' + token
    };
    return callback(null, user, context);
  
  function createToken(clientId, clientSecret, issuer, user) {
    const options = {
      expiresIn: '15m',
      audience: clientId,
      issuer: issuer
    };
    return jwt.sign(user, clientSecret, options);
  }
}