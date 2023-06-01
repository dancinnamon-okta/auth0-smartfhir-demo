'use strict';
const consentLib = require('../lib/consent')

module.exports.consentGetHandler = async (event, context) => {
	var getResult = await consentLib.getHandler(event.queryStringParameters)
	return {
		statusCode: getResult.statusCode,
		body: getResult.body,
		headers: {
			'content-type': 'text/html'
		}
	}
}

module.exports.consentPostHandler = async (event, context) => {
	var postResult = await consentLib.postHandler(event.body)
	return {
		statusCode: postResult.statusCode,
		body: JSON.stringify(postResult.body),
		headers: {
			Location: postResult.location
		}
	}
}
