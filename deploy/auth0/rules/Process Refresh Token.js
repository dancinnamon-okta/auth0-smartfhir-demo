function (user, context, callback) {
  //We only want to run this rule if we're in the middle of a token refresh.
  if(context.protocol !== 'oauth2-refresh-token') {
    return callback(null, user, context);
  }

  //TODO: Ensure we're only processing for the SMART audience.
  console.log(context);
  const crypto = require('crypto');
 	const secret = configuration.REFRESH_TOKEN_HASH_SECRET;
  const hash = crypto.createHmac('sha256', secret)
                   .update(context.request.body.refresh_token)
                   .digest('hex');

  //Take the refresh token we've been passed, hash it, and then look for the hash on the appUser profile.
  //We'll look up any custom consent details from there.
  //TODO: should store the consent details JWT vs. just the patient id to prevent tampering. Could also just store it externally like I do with Okta CIS.
  if(user.app_metadata.refreshTokenData) {
     const refreshTokenData = user.app_metadata.refreshTokenData.find(o => o.refreshToken === hash);
     if(refreshTokenData && refreshTokenData.launch_response_patient) {
       console.log('Found refresh token data');
       console.log(refreshTokenData);
     	 context.accessToken['launch_response_patient'] = refreshTokenData.launch_response_patient;
       context.accessToken['scope'] = refreshTokenData.scope;
     }
  }
  else {
    console.log('No cached data found. Skipping...');
  }
  return callback(null, user, context);
}
