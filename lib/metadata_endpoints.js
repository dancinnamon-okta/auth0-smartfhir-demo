'use strict';

//These endpoints are essentially static endpoints that advertise key information about the SMART authorization server.
//They are dyanamic endpoints in this reference implementation purely for ease of deployment.
module.exports.smartConfigHandler = async () => {
	return {
		"authorization_endpoint": 'https://' + process.env.AUTHZ_SERVICE + '/authorize',
		"token_endpoint": 'https://' + process.env.AUTHZ_SERVICE + '/token',
		"token_endpoint_auth_methods_supported": ["client_secret_basic"],
		"registration_endpoint": 'https://' + process.env.AUTHZ_SERVICE + '/oidc/register',
		"scopes_supported": [
			"openid", 
			"profile", 
			"launch", 
			"launch/patient", 
			"patient/*.*", 
			"user/*.*", 
			"offline_access", 
			'patient/Medication.read', 
			'patient/AllergyIntolerance.read', 
			'patient/CarePlan.read', 
			'patient/CareTeam.read', 
			'patient/Condition.read', 
			'patient/Device.read', 
			'patient/DiagnosticReport.read', 
			'patient/DocumentReference.read', 
			'patient/Encounter.read', 
			'patient/Goal.read', 
			'patient/Immunization.read', 
			'patient/Location.read', 
			'patient/MedicationRequest.read', 
			'patient/Observation.read', 
			'patient/Organization.read', 
			'patient/Patient.read', 
			'patient/Practitioner.read', 
			'patient/Procedure.read', 
			'patient/Provenance.read', 
			'patient/PractitionerRole.read'
		],
		"response_types_supported": ["code", "code id_token", "id_token", "refresh_token"],
		"introspection_endpoint": '',
		"revocation_endpoint": 'https://' + process.env.AUTHZ_SERVICE + '/oauth/revoke',
		"capabilities": [
			"launch-ehr", 
			"client-public", 
			"client-confidential-symmetric", 
			"context-ehr-patient", 
			"sso-openid-connect", 
			"context-banner", 
			"context-style"
		],
		"code_challenge_methods_supported": ["S256"]
	}
}

module.exports.metadataHandler = async () => {
	var d = new Date();
	return {
		"resourceType" : "CapabilityStatement",
		"id" : "auth0_smart-app-launch-example",
		"name" : "SMART App Launch Capability Statement Example w/Auth0 as OAuth2 AS",
		"status" : "active",
		"experimental" : true,
		"date" : d.toISOString(),
		"publisher" : "Okta",
		"contact" : [
		{
		  "telecom" : [
			{
			  "system" : "url",
			  "value" : "https://okta.com"
			}
		  ]
		}
		],
		"description" : "This is an example implementation of the SMART launch framework using auth0 as the identity and authorization platform.",
		"kind" : "capability",
		"software" : {
			"name" : "Auth0 SMART FHIR Demo"
		},
		"fhirVersion" : "4.0.1",
		"format" : [
			"xml",
			"json"
		],
		"rest" : [
		{
		  "mode" : "server",
		  "documentation" : "This is a demo using Auth0 as the IDP",
		  "security" : {
			"extension" : [
			  {
				"extension" : [
				  {
					"url" : "token",
					"valueUri" : 'https://' + process.env.AUTHZ_SERVICE + '/token'
				  },
				  {
					"url" : "authorize",
					"valueUri" : 'https://' + process.env.AUTHZ_SERVICE + '/authorize'
				  },

				  {
					"url" : "introspect",
					"valueUri" : ''
				  },
				  {
					"url" : "revoke",
					"valueUri" : 'https://' + process.env.AUTHZ_SERVICE + '/oauth/revoke'
				  },
				  {
					"url" : "register",
					"valueUri" : 'https://' + process.env.AUTHZ_SERVICE + '/oidc/register'
				  }
				],
				"url" : "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris"
			  }
			],
			"service" : [
			  {
				"coding" : [
				  {
					"system" : "http://hl7.org/fhir/restful-security-service",
					"code" : "SMART-on-FHIR"
				  }
				],
				"text" : "OAuth2 using SMART-on-FHIR profile (see http://docs.smarthealthit.org)"
			  }
			]
		  }
		}
		]
	}
}
