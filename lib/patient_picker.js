'use strict';
//This is an example of a custom scope consent and patient picker to be used as part of an Okta authentication
//and authorization flow.
const axios = require('axios');
const nunjucks = require('nunjucks');
const njwt = require('njwt');
const querystring = require('querystring');
const ManagementClient = require('auth0').ManagementClient;

nunjucks.configure('views', {
    autoescape: true
});

//Step 3 - Display the patient/scope picker application, and solicit a response.
module.exports.getHandler = async (requestQueryString) => {
	var auth0Token = requestQueryString.token
  var auth0State = requestQueryString.state
	var verifiedAuth0Data, appInfo, scopeDefinitions, mockPatientResponse;

	console.log('User reached patient/consent picker app- validating token: ' + auth0Token);

	//First validate the token from Auth0 before even trying to render the screen.
  console.log(`Introspecting the patient picker token from Auth0: ${auth0Token}`)
  console.log('just checking if this log line ever makes it in'); 
	verifiedAuth0Data = njwt.verify(auth0Token,
	`-----BEGIN CERTIFICATE-----
	MIIDEzCCAfugAwIBAgIJGWSNUH/aQjAGMA0GCSqGSIb3DQEBCwUAMCcxJTAjBgNV
	BAMTHHNtYXJ0LW1veWFlLWRldi51cy5hdXRoMC5jb20wHhcNMjIwNzE0MTg0MzAx
	WhcNMzYwMzIyMTg0MzAxWjAnMSUwIwYDVQQDExxzbWFydC1tb3lhZS1kZXYudXMu
	YXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv+OQph0R
	lYje1tYbJS9XReA/wJapeM0Y+jylzy7ppdI1ZIUW2fT8lzWYzvPCqXdEPUfBWpBz
	JFRt6MebH8H45pR89MX4tjbPKUyNyzAyJJqIQSXVdKfDhh1/AbqPxcoF5idAU+Xv
	51lwHtmbNkWW6EoDcbbIRqimRfeXCvWqeLAVIwZ1L/CtxXJNCUfHRXATcQ4Q3CKi
	NfPgQQ6pCocuSTJeGK5ElK5o5ZpbAhbZiN2kGKdxvjJw4Wm8NQdEzFLbow0V+Sm3
	yZ0I9R6u95zZn88BSD7SVHQ6x7DV+Y7Pg/pS2w4HNWob8VwqAs9i9bQzQY9bQq/H
	CR9bZ9YI8cyymQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSP
	K3Ur+n6eKdh5MoolYnf2Y2ouezAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQEL
	BQADggEBAHxAyKvtw8Y129F9VP5SIIr+i3GbvZBEHNKXchQ/btc0nVY4rVZhMZ0w
	RJJ40Ddl1Ev1lriW3sRFKlhEPnsmnPh/ey2smOTRGC5kGFsnDAaRkcEMvn7i0SMb
	XAO6b3B39IQR1ozuf+VRibvyr0rP367Y4sjrK5lzrE0WVX6OBYj4vFoE17iJ8huS
	pMc2W9hdyIxXpfmKH5vraTgyqlUf8ClNgiSg19YqtrsA6xQg0ED6JqGxYkWawjJo
	Ey9Pqsi1oSN4f2zgiNESeUIDg/QFzXCF5WnNt/iJCr2B7lAG396Dyf2SXZWnRNTK
	hR43Gu9vmf8Zc/A0aqIi7/7iaTrVUpU=
	-----END CERTIFICATE-----`, 'RS256', (err, verifiedJwt) => {
	if(err){
		console.log(error)
		return {
				statusCode: 403,
				body: 'A valid auth0 token was not provided.'
		}
		}else{
		console.log(verifiedJwt); // Will contain the header and body

		}
	})
  console.log('Token Passed from Auth0:')
  console.log(verifiedAuth0Data)

	//Get our consent data from Auth0.
	try {
		appInfo = await get_application_data(verifiedAuth0Data.body.requested_client_id)
		scopeDefinitions = await get_scope_data(verifiedAuth0Data.body.requested_scopes)
	}
	catch(error) {
		console.log(error)
		return {
			statusCode: 500,
			body: 'Unable to retrieve requested scope definitions and client info from the authorization server.'
		}
	}

	if(verifiedAuth0Data.body.requested_scopes.includes('launch/patient')) {
		try {
			mockPatientResponse = await get_mock_patients()
			return {
				statusCode: 200,
				body: nunjucks.render('patient_authorization.html', {
					patients: mockPatientResponse,
					scopes: scopeDefinitions,
					show_patient_picker: true,
					app_name: appInfo.applicationName,
					app_icon: appInfo.applicationLogo,
					gateway_url: process.env.GATEWAY_URL,
          auth0_token: auth0Token,
          auth0_state: auth0State
				})
			}
		}
		catch(error) {
			console.log(error);
			return {
				statusCode: 500,
				body: 'Unable to retrieve the patient list from the patient access service.'
			}
		}
	}
	else {
		return {
			statusCode: 200,
			body: nunjucks.render('patient_authorization.html', {
				patients: null,
				scopes: scopeDefinitions,
				show_patient_picker: false,
				app_name: appInfo.applicationName,
				app_icon: appInfo.applicationLogo,
				gateway_url: process.env.GATEWAY_URL,
        auth0_token: auth0Token,
        auth0_state: auth0State
			})
		}
	}
}

//Step 4 - A patient and scope(s) have been selected by the user.
//We need to take the scope(s) requested, plus the patient_id selected, and we need to build a new authz request with it.
//In order to provide some trust in the process, we'll use a signed JWT as part of the authorize request back to Okta for the real app.
//The signed JWT will be validated in the token hook.  That will prevent someone from circumventing the picker by doing an
//authorize directly against Okta.
module.exports.postHandler = async (requestBodyString) => {
  //Here is our selections from the user.
	const consentBody = querystring.parse(requestBodyString)

	//We also won't proceed unless they prove that they're actually logged into the patient picker app.
  var auth0Token = consentBody.auth0_token
  var auth0State = consentBody.auth0_state
	var verifiedAuth0Data

	console.log('POST patient/consent picker app- validating token: ' + auth0Token);

	//First validate the token from Auth0 before even trying to render the screen.
	//Could move this to a JWT validator on the APIGW too.
  console.log('Introspecting the patient picker token from Auth0.')
  try {
    verifiedAuth0Data = njwt.verify(auth0Token,
	`-----BEGIN CERTIFICATE-----
MIIDEzCCAfugAwIBAgIJGWSNUH/aQjAGMA0GCSqGSIb3DQEBCwUAMCcxJTAjBgNV
BAMTHHNtYXJ0LW1veWFlLWRldi51cy5hdXRoMC5jb20wHhcNMjIwNzE0MTg0MzAx
WhcNMzYwMzIyMTg0MzAxWjAnMSUwIwYDVQQDExxzbWFydC1tb3lhZS1kZXYudXMu
YXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv+OQph0R
lYje1tYbJS9XReA/wJapeM0Y+jylzy7ppdI1ZIUW2fT8lzWYzvPCqXdEPUfBWpBz
JFRt6MebH8H45pR89MX4tjbPKUyNyzAyJJqIQSXVdKfDhh1/AbqPxcoF5idAU+Xv
51lwHtmbNkWW6EoDcbbIRqimRfeXCvWqeLAVIwZ1L/CtxXJNCUfHRXATcQ4Q3CKi
NfPgQQ6pCocuSTJeGK5ElK5o5ZpbAhbZiN2kGKdxvjJw4Wm8NQdEzFLbow0V+Sm3
yZ0I9R6u95zZn88BSD7SVHQ6x7DV+Y7Pg/pS2w4HNWob8VwqAs9i9bQzQY9bQq/H
CR9bZ9YI8cyymQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSP
K3Ur+n6eKdh5MoolYnf2Y2ouezAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQEL
BQADggEBAHxAyKvtw8Y129F9VP5SIIr+i3GbvZBEHNKXchQ/btc0nVY4rVZhMZ0w
RJJ40Ddl1Ev1lriW3sRFKlhEPnsmnPh/ey2smOTRGC5kGFsnDAaRkcEMvn7i0SMb
XAO6b3B39IQR1ozuf+VRibvyr0rP367Y4sjrK5lzrE0WVX6OBYj4vFoE17iJ8huS
pMc2W9hdyIxXpfmKH5vraTgyqlUf8ClNgiSg19YqtrsA6xQg0ED6JqGxYkWawjJo
Ey9Pqsi1oSN4f2zgiNESeUIDg/QFzXCF5WnNt/iJCr2B7lAG396Dyf2SXZWnRNTK
hR43Gu9vmf8Zc/A0aqIi7/7iaTrVUpU=
-----END CERTIFICATE-----`, 'RS256');
    if(!verifiedAuth0Data) {
      console.log('Introspection complete- token is not valid.')
      throw 'Token not valid'
    }
  }
  catch(error) {
      console.log(error)
	  	return {
			   statusCode: 403,
			   body: 'A valid auth0 token was not provided.'
		}
  }
  console.log('Token Passed from Auth0:')
  console.log(verifiedAuth0Data)


	console.log('Compiling a response back to Auth0...')

	console.log('User selections from the patient/scope picker: ')
	console.log(consentBody)

	const pickerClientId = process.env.PICKER_CLIENT_ID
	const pickerSecret = process.env.PICKER_CLIENT_SECRET

	const now = Math.floor( new Date().getTime() / 1000 );
	const plus5Minutes = new Date( ( now + (5*60) ) * 1000);
	var scopes = ''

	//Build the picker context- this is going to be used to provide the consent information in a secure way to Auth0.
	//Note that request.body.patient may be null if the user isn't using the patient picker.
	const claims = {
		client_id: verifiedAuth0Data.body.requested_client_id,
		patient: consentBody.patient,
		scopes: consentBody.scopes,
    aud: process.env.GATEWAY_URL
	}

	const jwt = njwt.create(claims, pickerSecret)
		.setIssuedAt(now)
		.setExpiration(plus5Minutes)
		.setIssuer(pickerClientId)
		.setSubject(pickerClientId)
		.compact();

	console.log('JWT claims to be used to specify picker context state:')
	console.log(claims)

	console.log('JWT to be used to specify picker context state:')
	console.log(jwt)

  const returnUrl = process.env.GATEWAY_URL + '/continue?' +
                    'state=' + auth0State +
                    '&token=' + jwt

	return {
		statusCode: 302,
		location: returnUrl,
		body: null
	}
}

//This is used by the patient picker to pull application information.
function get_application_data(client_id) {
  console.log('Retrieving Application data from Auth0.')
  var auth0 = new ManagementClient({
    domain: process.env.AUTH0_ORG,
    clientId: process.env.AUTH0_API_CLIENTID,
    clientSecret: process.env.AUTH0_API_CLIENTSECRET
  });

	let promise = new Promise(function(resolve, reject) {
    auth0.getClient({ client_id: client_id })
		.then((auth0Client) => {
			console.log('Response from Auth0:')
			console.log(auth0Client)
      const appInfo = {
        applicationName: auth0Client.name,
        applicationLogo: auth0Client.logo_uri
      }
			resolve(appInfo)
		})
		.catch((error) => {
			console.log(error);
			reject(error)
		})
	})
	return promise
}

//This is used by the patient picker to pull a list of SMART/FHIR scope definitions from Okta.
function get_scope_data(clientRequestedScopes) {
	console.log('Retrieving Scope data from Auth0.')
  const defaultScopes = [
    {
      name: 'openid',
      displayName: '[No Consent]'
    },
    {
      name: 'email',
      displayName: '[No Consent]'
    },
    {
      name: 'profile',
      displayName: '[No Consent]'
    },
    {
      name: 'offline_access',
      displayName: '[No Consent]'
    }
  ]
  var auth0 = new ManagementClient({
    domain: process.env.AUTH0_ORG,
    clientId: process.env.AUTH0_API_CLIENTID,
    clientSecret: process.env.AUTH0_API_CLIENTSECRET
  });

	let promise = new Promise(function(resolve, reject) {
		auth0.getResourceServer({ id: process.env.FHIR_RESOURCE_SERVER_ID })
		.then((auth0Response) => {
			console.log('Response from Auth0:')
			console.log(auth0Response)

      var returnScopes = []

      auth0Response.scopes.forEach(function(scope) {
        if(clientRequestedScopes.includes(scope.value)) {
          returnScopes.push({
            name: scope.value,
            displayName: scope.description
          })
        }
      });
      returnScopes.push.apply(returnScopes, defaultScopes)

      console.log('Scopes to send back to the client for approval:')
      console.log(returnScopes)
      resolve(returnScopes)
		})
		.catch((error) => {
			console.log(error);
			reject(error)
		})
	})
	return promise
}

function get_mock_patients() {
	console.log('Retrieving a list of demo patients.')
	let promise = new Promise(function(resolve, reject) {
		axios.request({
			url: process.env.GATEWAY_URL + '/patientMockService',
			method: "get"
		})
		.then((mockResponse) => {
				console.log('Mock patient call successful. Result:')
				console.log(mockResponse.data)
				resolve(mockResponse.data)
		})
		.catch((error) => {
			console.log(error);
			reject(error)
		});
	})
	return promise
}
