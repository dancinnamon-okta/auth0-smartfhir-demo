function (user, context, callback) {
  if(context.protocol !== 'oidc-basic-profile') {
    //If we're not on the first /authorize call, then we should skip.
    //If we're on a token refresh, or a callback from the patient picker we don't need this rule.
    return callback(null, user, context);
  }

  console.log('Requested aud:' + context.request.query.aud);
  console.log('Expected aud:' + configuration.EXPECTED_AUD);

  //We need to ensure the aud value passed in matches our API.
  if(!context.request.query.aud || context.request.query.aud !== configuration.EXPECTED_AUD) {
    console.log('An invalid audience was specified on the authorize request.');
    console.log('Required aud:' + configuration.EXPECTED_AUD);
    console.log('Actual Aud:' + context.request.query.aud);
    return callback(new Error('An invalid audience was specified on the authorize request.'));
  }
  else {
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
  }
  function createToken(clientId, clientSecret, issuer, user) {
    const options = {
      expiresInMinutes: 5,
      audience: clientId,
      issuer: issuer
    };
    return jwt.sign(user, clientSecret, options);
  }
}