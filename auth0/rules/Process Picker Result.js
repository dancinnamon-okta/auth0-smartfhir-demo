function (user, context, callback) {
  if(context.protocol !== 'redirect-callback') {
    //If we're not in the middle of our callback, do nothing.
    return callback(null, user, context);
  }
  
  var validatedPickerData;
  const returnToken = context.request.query.token;
  const jwtValidatorOptions = {
    'audience': configuration.ISSUER
  };
  try {
  	validatedPickerData = jwt.verify(returnToken, 
                                         configuration.PICKER_CLIENT_SECRET, 
                                         jwtValidatorOptions);
  }
  catch(error) {
    return (new Error('An invalid consent token was presented.'));
  }
  console.log('Picker Data:');
  console.log(validatedPickerData);
  const namespace = configuration.ISSUER;
  context.accessToken[namespace + 'launch_response_patient'] = validatedPickerData.patient;
  context.accessToken[namespace + 'valid_consent'] = 'true';
  context.accessToken.scope = validatedPickerData.scopes;

  return callback(null, user, context);
  
}
