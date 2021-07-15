'use strict';
const axios = require('axios');
const njwt = require('njwt');
const fs = require('fs');
const querystring = require('querystring');
const cors = require('cors');

//Token Proxy will take out the patient_id value in the token, and return it alongside the token instead.
//This is also where we handle public applications that need tokens.
module.exports.tokenHandler = async (tokenRequestBody, tokenRequestHeaders) => {
	const tokenEndpoint = 'https://' + process.env.AUTH0_ORG + '/oauth/token';

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
				'headers': {'Content-Type': 'application/x-www-form-urlencoded'},
				'data': formData
			})
			console.log('Response from Auth0:')
			console.log(auth0Response.data)
			var accessTokenPayload = get_access_token_payload(auth0Response.data.access_token)
			update_return_claims(accessTokenPayload, auth0Response.data)

			return {
				statusCode: 200,
				body: auth0Response.data
			}
		}
		catch(error) {
			console.log("Error while calling Auth0:")
			console.log(error)
			if(error.isAxiosError) { //Error from Auth0, or while calling Auth0.
				return {
					statusCode: error.response.status,
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
function update_return_claims(jwt_payload, response_body) {
	for (var claim in jwt_payload) {
		if (jwt_payload.hasOwnProperty(claim)) {
			console.log(claim + " -> " + jwt_payload[claim]);
			if(claim.startsWith(process.env.GATEWAY_URL + '/launch_response')) {
				//We need to include this in our body.
				response_body[claim.replace(process.env.GATEWAY_URL + '/launch_response_','')] = jwt_payload[claim];
			}
		}
	}
}

function get_auth0_token_request(requestBody, requestHeaders, tokenEndpoint) {
  //5 valid scenarios:
  //1- Public client, access code request
	//2- Public client WITH PKCE, access code request
  //3- Confidential client, access code request
	//4- Confidential client WITH PKCE, access code request
  //5- Confidential client, refresh token request

	var clientId = ''
	var clientSecret = ''
	var confidentialClient = false
	var pkce = false
	var authorizationHeader = requestHeaders[Object.keys(requestHeaders).find(key => key.toLowerCase() === 'authorization')];

	//Handle the multiple ways the client id/secret can come in.
	if(authorizationHeader){
		var regex = /\s*basic\s*(.+)/i;
		var credentials = authorizationHeader.match(regex)[1];
		var buff = Buffer.from(credentials, 'base64')
		var authString = buff.toString('utf-8')
		clientId = authString.split(':')[0]
		clientSecret = authString.split(':')[1]
		confidentialClient = true
	}
	if(requestBody.client_secret) {
		clientSecret = requestBody.client_secret
		confidentialClient = true
	}
	if(requestBody.client_id) {
		clientId = requestBody.client_id
	}
	if(requestBody.code_verifier) {
		pkce = true
	}

	//Scenario 1 - public client, no PKCE, initial authz.
	if(requestBody.grant_type == 'authorization_code' && !confidentialClient && !pkce) {
			return 'client_id=' +
			clientId +
			'&client_secret=' + process.env.PUBLIC_CLIENT_SECRET +
			'&grant_type=authorization_code&redirect_uri=' +
			requestBody.redirect_uri +
			'&audience=' + process.env.GATEWAY_URL +
			'&code=' +
			requestBody.code;

	}
	//Scenario 2 - public client WITH PKCE, initial authz
	else if(requestBody.grant_type == 'authorization_code' && !confidentialClient && pkce) {
		return 'client_id=' +
			clientId +
			'&code_verifier=' +
			requestBody.code_verifier +
			'&grant_type=authorization_code&redirect_uri=' +
			requestBody.redirect_uri +
			'&audience=' + process.env.GATEWAY_URL +
			'&code=' +
			requestBody.code;
	}
	//Scenario 3 - confidential client, initial authz.
	else if(requestBody.grant_type == 'authorization_code' && confidentialClient && !pkce) {
		return 'client_id=' +
			clientId +
			'&client_secret=' +
			clientSecret +
			'&grant_type=authorization_code&redirect_uri=' +
			requestBody.redirect_uri +
			'&audience=' + process.env.GATEWAY_URL +
			'&code=' +
			requestBody.code;
	}
	//Scenario 4 - confidential client WITH PKCE, initial authz.
	else if(requestBody.grant_type == 'authorization_code' && confidentialClient && pkce) {
		return 'client_id=' +
			clientId +
			'&client_secret=' +
			clientSecret +
			'&code_verifier=' +
			requestBody.code_verifier +
			'&grant_type=authorization_code&redirect_uri=' +
			requestBody.redirect_uri +
			'&audience=' + process.env.GATEWAY_URL +
			'&code=' +
			requestBody.code;
	}
	//Scenario 5 - refresh token.
	//Note that Auth0 will reject this if the client wasn't using PKCE.
	else if(requestBody.grant_type == 'refresh_token') {
		var formData = 'client_id=' +
			clientId +
			'&grant_type=refresh_token&refresh_token=' +
			requestBody.refresh_token

		if(requestBody.scope) {
			formData += '&scope=' + requestBody.scope
		}
		if(clientSecret) {
			formData += '&client_secret=' + clientSecret
		}

		return formData
	}
	else {
		return false
	}
}
