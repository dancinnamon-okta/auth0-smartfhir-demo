'use strict';
const axios = require('axios');
const njwt = require('njwt');
const fs = require('fs');
const querystring = require('querystring');
const cors = require('cors');
const crypto = require('crypto');
const auth0 = require('auth0');
const jwt = require('jsonwebtoken');
const get = require('lodash.get'); 


//Token Proxy will take out the patient_id value in the token, and return it alongside the token instead.
//This is also where we handle public applications that need tokens.
module.exports.tokenHandler = async (tokenRequestBody, tokenRequestHeaders) => {

	const tokenEndpoint = process.env.GATEWAY_URL + '/oauth/token';

	console.log('Token proxy called.')
	console.log('Calling real /token endpoint at Auth0.')

	//Get the proper Auth0 /token request based upon the situation.
	var formData = get_auth0_token_request(querystring.parse(tokenRequestBody), tokenRequestHeaders, tokenEndpoint)

	console.log("Body to send to Auth0:")
	console.log(formData)
	if(formData) {
		try {
			const auth0Response = await axios.request({
				'url': tokenEndpoint,
				'method': 'post',
				'headers': {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				'data': formData
			})
			console.log('Response from Auth0 BEFORE UPDATING ANYTHING', JSON.stringify(auth0Response.data))

			//Handle fields selected in patient picker
			var accessTokenPayload = get_access_token_payload(auth0Response.data.access_token)
			const results = await update_return_claims(accessTokenPayload, auth0Response.data)


			console.log('Response from Auth0 AFTER UPDATING UPDATE_RETURN_CLAIMS', JSON.stringify(auth0Response.data)); 

			console.log("this is results", results); 
			return {
				statusCode: 200,
				body: auth0Response.data
			}
		}
		catch(error) {
			console.log("Error while calling Auth0:")
			console.log(error)
			if(error.isAxiosError) { //Error from Auth0, or while calling Auth0.

				// hardcoding a 400, can be more elegant about errors in the future.
				return {
					statusCode: 400,
					body: error.response.data
				}
			}
			else {
				throw error
			}

		}
	}
	else {
		return{
			statusCode: 400,
			body: 'An invalid token request was made. This authorization server does not support public client refresh tokens without PKCE.'
		}
	}
}

//Helper functions for the token proxy
//Decode the access token so we can read out any of the launch_response parameters provided in the token.
function get_access_token_payload(jwt) {
	var base64Payload = jwt.split('.')[1];
	var buff = Buffer.from(base64Payload, 'base64');
	var payloadText = buff.toString('utf-8');
	var payloadObj = JSON.parse(payloadText)
	console.log("Parsed Access Token:")
	console.log(payloadObj)
	return payloadObj
}

//Read any claims that begin with "launch_response", and return them alongside the access token.
//Note that we're not modifying the token- the requested claim is still in the token.
async function update_return_claims(jwt_payload, response_body) {


	const getScopes = (scopes) => {
		if (Array.isArray(scopes)) {
			return scopes;
		}
		if (typeof scopes === 'string') {
			return scopes.split(' ');
		}
		return [];
	}
	//Using this to store potential fields for refresh token caching in Auth0.
	var userAppMetadata = {}

	for (var claim in jwt_payload) {
		console.log("this is a claim in jwt_payload", claim); 
		if (jwt_payload.hasOwnProperty(claim)) {
			console.log(claim + " -> " + jwt_payload[claim]);
			if(claim.startsWith('launch_response')) {
				console.log("HELLO! do we get into here"); 
				//We need to include this in our body.
				response_body[claim.replace('launch_response_','')] = jwt_payload[claim].split('/').pop();
				//If there is a refresh_token, we need to cache it in auth0.
				//Take the claim namespace off first.
				userAppMetadata[claim] = jwt_payload[claim];
			}

			if(claim === 'scope'){
				const scopeArray = getScopes(jwt_payload[claim]);

				if(scopeArray.includes("launch")){
					// if it is the demo launch claim then we should pass back a patientId for testing
					userAppMetadata['launch_response_patient'] = jwt_payload['launch_response_patient']
					response_body['patient'] = 'f48ca782-ab28-49ac-9303-00e50c33bf37'
					response_body['smart_style_url'] = 'https://inferno.healthit.gov/reference-server/app/smart-style-url'
					response_body['need_patient_banner'] = false
					response_body['encounter']= '9f7e7739-d56b-4e4f-9134-2bc91cd31132'
				}

				if(scopeArray.includes("patient/Patient.read") && !scopeArray.includes('launch_response_patient')){
					response_body['patient'] = 'f48ca782-ab28-49ac-9303-00e50c33bf37'
				}

			}
		}
	}
	//We need to
	userAppMetadata['scope'] = jwt_payload['scope']

	//If we have a refresh token, and also runtime data that we need to cache, let's do that.
	if(response_body.refresh_token && Object.keys(userAppMetadata).length > 0) {
  	const hash = crypto.createHmac('sha256', process.env.REFRESH_TOKEN_HASH_SECRET)
                   .update(response_body.refresh_token)
                   .digest('hex');

		userAppMetadata['refreshToken'] = hash

		await cacheDataInAuth0(jwt_payload.sub, userAppMetadata)
	}

	console.log("this is the responseBody we expect", response_body); 

	return response_body; 
}

async function cacheDataInAuth0(userId, metadata) {
	var client = new auth0.ManagementClient({
	  domain: process.env.AUTH0_ORG,
	  clientId: process.env.AUTH0_API_CLIENTID,
	  clientSecret: process.env.AUTH0_API_CLIENTSECRET,
	  scope: 'read:users create:users_app_metadata read:users_app_metadata update:users_app_metadata delete:users_app_metadata'
	});

	console.log('Updating metadata in Auth0. Data:')
	console.log(metadata)
	console.log('Getting existing metadata to update...')

	var existingData = await client.users.get({id: userId})
	console.log('Existing Metadata is:')
	console.log(existingData.app_metadata)

	var refreshTokenArray = []
	if(existingData.app_metadata && existingData.app_metadata.refreshTokenData) {
		console.log('Found existing refresh token data to append to...')
		refreshTokenArray = existingData.app_metadata.refreshTokenData
	}
	refreshTokenArray.push(metadata)
	var updateResult = await client.updateAppMetadata({id: userId}, {refreshTokenData: refreshTokenArray})
	console.log('Update metadata success. Result:')
	console.log(updateResult)
}

function get_auth0_token_request(requestBody, requestHeaders, tokenEndpoint) {
	//Pass the proper data to auth0 that has been sent to the token proxy.

	//These two variables can come either from the authorization header, or also from the request body.
	var clientId = process.env.PICKER_CLIENT_ID
	var clientSecret = process.env.PICKER_CLIENT_SECRET

	var authorizationHeader = requestHeaders[Object.keys(requestHeaders).find(key => key.toLowerCase() === 'authorization')];

	var formBody = ''

	console.log("these are requestBody", requestBody); 
	console.log("these are request headers", requestHeaders); 

	if(requestBody.grant_type === "client_credentials" && requestBody.client_assertion === "urn:ietf:params:oauth:client-assertion-type:jwt-bearer" && requestBody.scope === 'system/*.read'){
		// if this user is requesting system scopes, we shoudl check with the jwks. 
		// inferno jwks currently is here: https://inferno.healthit.gov/suites/custom/g10_certification/.well-known/jwks.json

		console.log("we got into the system bulk data request"); 

	}

	//Handle the multiple ways the client id/secret can come in.
	if(authorizationHeader){
		var regex = /\s*basic\s*(.+)/i;
		var credentials = authorizationHeader.match(regex)[1];
		var buff = Buffer.from(credentials, 'base64')
		var authString = buff.toString('utf-8')
		clientId = authString.split(':')[0]
		clientSecret = authString.split(':')[1]
	}
	if(requestBody.client_secret) {
		clientSecret = requestBody.client_secret
	}
	if(requestBody.client_id) {
		clientId = requestBody.client_id
	}

	//Start off by putting in our grant_type, common to all requests.
	formBody = 'grant_type=' + requestBody.grant_type

	//Add client authentication
	//Client Secret authentication


	function isValidJwt(clientAssertion){
		const decoded = jwt.decode(clientAssertion); 
		console.log("this is the decoded ", decoded)

		if(decoded.iss === clientId) return true
		else return false

	}


	if(get(requestBody, 'scope', '').indexOf('system') > -1){
		if(clientSecret && (requestBody.client_assertion_type !== "not_an_assertion_type") && isValidJwt(requestBody.client_assertion)) {
			console.log("setting the client_id and the client_secret")
			// this will always be set. 
			formBody += '&client_id=' +
				clientId +
				'&client_secret=' +
				clientSecret
		}
	}
	else{
		formBody += '&client_id=' +
		clientId +
		'&client_secret=' +
		clientSecret
	}

	// //Private Key JWT Authentication
	// formBody += '&client_id=' + clientId

	// //Temporary for SMARTV1 - hardcode a secret if one isn't given.
	// formBody += '&client_secret=' + process.env.PUBLIC_CLIENT_SECRET


	//If PKCE was used, pass that through.
	if(requestBody.code_verifier) {
		formBody += '&code_verifier=' + requestBody.code_verifier
	}

	//Add in the authz code and redirect_uri if that's the situation we're in.
	if(requestBody.code) {
		formBody += '&code=' + requestBody.code +
			'&redirect_uri=' + requestBody.redirect_uri
	}

	if(requestBody.scope) {
		formBody += '&scope=' + requestBody.scope
	}

	if(requestBody.refresh_token) {
		formBody += '&refresh_token=' + requestBody.refresh_token
	}

	return formBody
}