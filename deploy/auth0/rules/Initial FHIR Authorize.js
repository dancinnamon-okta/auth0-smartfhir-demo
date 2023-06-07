function (user, context, callback) {
  if(context.protocol !== 'oidc-basic-profile') {
    //If we're not on the first /authorize call, then we should skip.
    //If we're on a token refresh, or a callback from the patient picker we don't need this rule.
    return callback(null, user, context);
  }

  console.log('Requested aud:' + context.request.query.aud);
  console.log('Audience for SMART launch:' + configuration.SMART_AUD);

  //We need to ensure the aud value passed in matches our API.
  if(!context.request.query.aud || context.request.query.aud !== configuration.SMART_AUD) {
    console.log('This request is not a SMART launch request. Falling back to normal behavior.');
    return callback(null, user, context);
  }
  else {
    console.log('SMART launch requested. Redirecting to consent...');
    //Calculate JWT to send user context to the picker app
    const token = createToken(
      configuration.CONSENT_URL,
      configuration.CONSENT_REDIRECT_SECRET,
      configuration.CUSTOM_AUTH0_DOMAIN_URL,
      {
        sub: user.user_id,
        requested_client_id: context.clientID,
        requested_scopes: context.request.query.scope
      }
    );

    //Redirect to the consent page w/ patient picker.
    context.redirect = {
      url: configuration.CONSENT_URL + '?token=' + token
    };

    return callback(null, user, context);
  }
  function createToken(audience, signingKey, issuer, consentData) {
    const options = {
      expiresIn: 300,
      audience: audience,
      issuer: issuer
    };
    const jwt = require('jsonwebtoken');
    return jwt.sign(consentData, signingKey, options);
  }
}
