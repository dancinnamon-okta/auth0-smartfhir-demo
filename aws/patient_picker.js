'use strict';
const patientPickerLib = require('../lib/patient_picker')

module.exports.patientPickerGetHandler = async (event, context) => {
	var getResult = await patientPickerLib.getHandler(event.queryStringParameters)
	return {
		statusCode: getResult.statusCode,
		body: getResult.body,
		headers: {
			'content-type': 'text/html'
		}
	}
}

module.exports.patientPickerPostHandler = async (event, context) => {
	console.log('got into patientPickerPost Handler', JSON.stringify(event)); 
	var postResult = await patientPickerLib.postHandler(event.body)
	return {
		statusCode: postResult.statusCode,
		body: JSON.stringify(postResult.body),
		headers: {
			Location: postResult.location
		}
	}
}
