'use strict';
const tokenLib = require('../lib/token')

//Token proxy - AWS implementation.
//See the token library for full documentation.
module.exports.tokenHandler = async (event, context) => {
	var handlerResponse = await tokenLib.tokenHandler(event.body, event.headers)

	console.log("this is the final handler Repsonse", JSON.stringify(handlerResponse.body)); 

	return {
		statusCode: handlerResponse.statusCode,
		body: JSON.stringify(handlerResponse.body),
		headers: {
			"Cache-Control": "no-store",
			"Pragma": "no-cache",
			'Access-Control-Allow-Origin': '*', // CORS
			'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
		}
	}
}
