'use strict';
const axios = require('axios');
const jwt = require('jsonwebtoken');
const querystring = require('querystring')

//Token Proxy will take out the patient_id value in the token, and return it alongside the token instead.
//This is also where we handle public applications that need tokens.
module.exports.tokenHandler = async (tokenRequestBody, tokenRequestHeaders) => {
	const tokenEndpoint = 'https://' + process.env.AUTH0_CUSTOM_DOMAIN_NAME_BACKEND + '/oauth/token';

	console.log('Token proxy called.')
	console.log('Calling real /token endpoint at Auth0.')

	tokenRequestHeaders['cname-api-key'] = process.env.AUTH0_CUSTOM_DOMAIN_NAME_APIKEY
	tokenRequestHeaders['Host'] = process.env.AUTH0_CUSTOM_DOMAIN_NAME_BACKEND

	//If they pass in a refresh token, we need to break apart the associated launch context from the actual refresh token.
	const updatedRequestBody = handleInboundRefreshTokens(tokenRequestBody)

	console.log(updatedRequestBody)
	try {
		const auth0Response = await axios.request({
			'url': tokenEndpoint,
			'method': 'post',
			'headers': tokenRequestHeaders,
			'data': updatedRequestBody
		})

		console.log('Response from Auth0:')
		console.log(auth0Response.data)

		//Handle fields selected in patient picker
		const launchContext = getLaunchContext(auth0Response.data.access_token)
		console.log("Launch Context")
		console.log(launchContext)
		for (var claim in launchContext) {
			auth0Response.data[claim] = launchContext[claim];
		}
		handleOutboundRefreshTokens(auth0Response.data, launchContext)

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

//Helper functions for the token proxy
function handleInboundRefreshTokens(tokenRequestBody) {
	var tokenBody = querystring.parse(tokenRequestBody)

	if(tokenBody.refresh_token) {
		console.log("Refresh token sent in. Parsing out launch context...")
		var launchContext = jwt.verify(tokenBody.refresh_token, process.env.REFRESH_TOKEN_SIGNING_KEY)
		tokenBody['refresh_token'] = launchContext.refresh_token
		delete launchContext.refresh_token
		delete launchContext.iat
		tokenBody['launch_context'] = JSON.stringify(launchContext)
		return querystring.stringify(tokenBody)
	}
	else {
		return tokenRequestBody
	}
}

function handleOutboundRefreshTokens(tokenResponse, launchContext) {
	//If we have a refresh token, we're going to embed that refresh token within a JWT that contains our launch context.

	if(tokenResponse.refresh_token) {
		console.log("Refresh token is to be sent. Including launch context...")
		launchContext['refresh_token'] = tokenResponse.refresh_token
		launchContext['scope'] = tokenResponse.scope
		tokenResponse.refresh_token = jwt.sign(launchContext, process.env.REFRESH_TOKEN_SIGNING_KEY)
	}
}

function getLaunchContext(access_token) {

	//Using this to store potential fields for refresh token caching in Auth0.
	var response = {}

	const accessTokenBody = jwt.decode(access_token)

	for (var claim in accessTokenBody) {
		if (accessTokenBody.hasOwnProperty(claim)) {
			if(claim.startsWith('launch_response')) {
				console.log(claim + " -> " + accessTokenBody[claim]);
				response[claim.replace('launch_response_','')] = accessTokenBody[claim];
			}
		}
	}
	return response
}