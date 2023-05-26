
module.exports.apiM2MClient = {
    "name": "Patient Picker Client Credentials",
    "token_endpoint_auth_method": "client_secret_post",
    "app_type": "non_interactive",
    "grant_types": [
        "client_credentials"
    ]
}

module.exports.apiM2MClientGrant = {
    "client_id": "",
    "audience": "",
    "scope": [
    "read:clients",
    "read:connections",
    "read:resource_servers",
    "read:users_app_metadata",
    "update:users_app_metadata",
    "delete:users_app_metadata",
    "create:users_app_metadata",
    "read:users"
    ]
}

module.exports.sampleConfidentialApp = {
    "name": "Inferno FHIR Test Suite - Confidential",
    "callbacks": [
      "https://inferno.healthit.gov/community/oauth2/static/redirect",
      "https://inferno.healthit.gov/suites/custom/smart/redirect"
    ],
    "cross_origin_auth": false,
    "is_first_party": true,
    "logo_uri": "https://logo.clearbit.com/healthit.gov",
    "oidc_conformant": true,
    "refresh_token": {
      "expiration_type": "non-expiring",
      "leeway": 0,
      "infinite_token_lifetime": true,
      "infinite_idle_token_lifetime": true,
      "token_lifetime": 31557600,
      "idle_token_lifetime": 2592000,
      "rotation_type": "non-rotating"
    },
    "token_endpoint_auth_method": "client_secret_post",
    "app_type": "regular_web",
    "grant_types": [
      "authorization_code",
      "refresh_token"
    ]
  }

module.exports.sampleFHIRAppClientGrant = {
    "client_id": "",
    "audience": "",
    "scope": [
    ]
}

module.exports.authzServer = {
    "name": "SMART FHIR API",
    "identifier": "",
    "allow_offline_access": true,
    "skip_consent_for_verifiable_first_party_clients": true,
    "token_lifetime": 86400,
    "token_lifetime_for_web": 7200,
    "signing_alg": "RS256",
    "scopes": [
    ],
    "enforce_policies": true,
    "token_dialect": "access_token_authz"
  }

  module.exports.authzScopes = [
    {
        "value": "fhirUser",
        "description": "fhirUser"
    },
    {
        "value": "launch",
        "description": "launch"
    },
    {
        "value": "launch/patient",
        "description": "launch/patient"
    }
]
module.exports.smartv1Scopes = [
    {
        "value": "patient/Patient.read",
        "description": "Ability to read the selected patient's record"
    },
    {
        "value": "patient/Observation.read",
        "description": "Ability to read the selected patient's vital signs"
    }
]

module.exports.smartv2Scopes = [
    {
        "value": "patient/Patient.rs",
        "description": "Ability to read the selected patient's record"
    },
    {
        "value": "patient/Observation.rs",
        "description": "Ability to read the selected patient's vital signs"
    }
]

module.exports.sampleUser = {
    "email":"",
    "password":"",
    "connection":"Username-Password-Authentication",
    "app_metadata": {
        "fhirUser":""
    }
}

module.exports.customDomain = {
    "domain": "",
    "type": "self_managed_certs",
    "verification_method": "txt"
}