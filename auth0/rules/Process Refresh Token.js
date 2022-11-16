function (user, context, callback) {
  //We only want to run this rule if we're in the middle of a token refresh.
  if(context.protocol !== 'oauth2-refresh-token') {
    return callback(null, user, context);
  }

  console.log(context);
  const crypto = require('crypto');
 	const secret = configuration.REFRESH_TOKEN_HASH_SECRET;
  const hash = crypto.createHmac('sha256', secret)
                   .update(context.request.body.refresh_token)
                   .digest('hex');

  if(user.app_metadata.refreshTokenData) {
     const refreshTokenData = user.app_metadata.refreshTokenData.find(o => o.refreshToken === hash);
     if(refreshTokenData && refreshTokenData.launch_response_patient) {
       console.log('Found refresh token data');
       console.log(refreshTokenData);
     	 context.accessToken.launch_response_patient = refreshTokenData.launch_response_patient;
     }
  }
  else {
    console.log('No cached data found. Skipping...');
  }
  return callback(null, user, context);
}
