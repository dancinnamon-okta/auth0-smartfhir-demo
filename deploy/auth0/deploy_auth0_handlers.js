const utils = require('../deploy_utils')
const ManagementClient = require('auth0').ManagementClient;
const models = require('./auth0_object_models')
const fs = require('fs')
const crypto = require('crypto')

module.exports.handlers = {
    handle_deploy_auth0: async (rl, state) => {
        var auth0 = new ManagementClient({
            domain: state.auth0Domain,
            clientId: state.auth0DeployMgmtClientId,
            clientSecret: state.auth0DeployMgmtClientSecret,
            scope: 'read:clients create:clients read:resource_servers create:resource_servers read:rules create:rules update:rules_configs read:users create:users'
        });

        //Deploy our resource server and applications
        const resourceServerId = await createApi(state, auth0)
        const appDetails = await createApps(state, auth0)

        if(!state.consentRedirectSecret) {
            console.log('Generating strong value for the consent redirect secret...')
            state.consentRedirectSecret = crypto.randomBytes(64).toString('hex')
        }

        if(!state.refreshTokenHashSecret) {
            console.log('Generating strong value for the consent redirect secret...')
            state.refreshTokenHashSecret = crypto.randomBytes(64).toString('hex')
        }

        //Deploy our rules and rule configs
        await createRule(state, auth0, 'Initial FHIR Authorize', './auth0/rules/Initial FHIR Authorize.js')
        await createRule(state, auth0, 'Process Consent Result', './auth0/rules/Process Consent Result.js')
        await createRule(state, auth0, 'Process Refresh Token', './auth0/rules/Process Refresh Token.js')
        await createRule(state, auth0, 'Add fhirUser Claim', './auth0/rules/Add fhirUser Claim.js')
        await overwriteRuleConfig(auth0, 'SMART_AUD', state.fhirBaseUrl)
        await overwriteRuleConfig(auth0, 'CONSENT_REDIRECT_SECRET', state.consentRedirectSecret)
        await overwriteRuleConfig(auth0, 'REFRESH_TOKEN_HASH_SECRET', state.refreshTokenHashSecret)
        await overwriteRuleConfig(auth0, 'CUSTOM_AUTH0_DOMAIN_URL', `https://${state.baseDomain}`)
        await overwriteRuleConfig(auth0, 'CONSENT_URL', `https://${state.baseDomain}/patient_authorization`)

        //Output of detail to go into the platform deployment process.
        console.log('auth0 objects created!')
        console.log('If you are following the manual, unguided process- please configure the following in your serverless.yml:')
        console.log('--------------------------------------------------------------------------')
        console.log(`Resource Server ID (FHIR_RESOURCE_SERVER_ID): ${resourceServerId}`)
        console.log(`Refresh Token Hash Secret (REFRESH_TOKEN_HASH_SECRET): ${state.refreshTokenHashSecret}`)
        console.log(`Consent Redirect Secret(CONSENT_REDIRECT_SECRET): ${state.consentRedirectSecret}`)
        console.log('--------------------------------------------------------------------------')
        console.log('Patient Picker M2M App Details:')
        console.log(`Patient Picker M2M App Client ID (AUTH0_API_CLIENTID): ${appDetails.apiM2MClientId}`)
        console.log(`Patient Picker M2M App Client Secret (AUTH0_API_CLIENTSECRET): ${appDetails.apiM2MClientSecret}`)
        console.log('--------------------------------------------------------------------------')
        console.log('--------------------------------------------------------------------------')
        console.log('A sample confidential client application has been created for your convenience.  You may use this with the ONC Inferno test suite:')
        console.log(`Client ID: ${appDetails.sampleAppId}`)
        console.log(`Client Secret: ${appDetails.sampleAppSecret}`)
        console.log('--------------------------------------------------------------------------')
    
        if(state.sampleUserName) {
            console.log('Creating sample user...')
            await createSampleUser(state, auth0)
            console.log('Sample user created!')
        }

        state.auth0ApiClientId = appDetails.apiM2MClientId ? appDetails.apiM2MClientId : state.auth0ApiClientId
        state.auth0ApiClientSecret = appDetails.apiM2MClientSecret ? appDetails.apiM2MClientSecret : state.auth0ApiClientSecret
        state.fhirResourceServerId = resourceServerId ? resourceServerId : state.fhirResourceServerId
    },
    
    handle_auth0_create_custom_domain: async (rl, state) => {
        console.log('Creating custom domain in auth0...')
        var auth0 = new ManagementClient({
            domain: state.auth0Domain,
            clientId: state.auth0DeployMgmtClientId,
            clientSecret: state.auth0DeployMgmtClientSecret,
            scope: 'create:custom_domains'
        });
        const domainModel = models.customDomain
        domainModel.domain = state.baseDomain
        const addDomainOutput = await auth0.createCustomDomain(domainModel)
        console.log(`Domain created in auth0 - domain id: ${addDomainOutput.custom_domain_id}`)

        console.log('In order to verify the domain in the next step, please configure the following DNS record.')
        console.log('--------------------------------------------------------------------------')
        console.log('Record Type: TXT')
        console.log('Record Domain Name: ' + addDomainOutput.verification.methods[0].domain)
        console.log('Record value: ' + addDomainOutput.verification.methods[0].record)
        console.log('--------------------------------------------------------------------------')

        state.auth0CustomDomainId = addDomainOutput.custom_domain_id
    },

    handle_auth0_verify_custom_domain: async (rl, state) => {
        console.log('Verifying custom domain in auth0...')
        var auth0 = new ManagementClient({
            domain: state.auth0Domain,
            clientId: state.auth0DeployMgmtClientId,
            clientSecret: state.auth0DeployMgmtClientSecret,
            scope: 'create:custom_domains'
        });

        var verifyDomainOutput = await auth0.verifyCustomDomain({"id": state.auth0CustomDomainId})
        while(verifyDomainOutput.status != "ready") {
            console.log('Verification is not yet complete- please configure the following DNS record.')
            console.log('--------------------------------------------------------------------------')
            console.log('Record Type: TXT')
            console.log(`Record Domain Name: ${verifyDomainOutput.verification.methods[0].domain}`)
            console.log(`Record value: ${verifyDomainOutput.verification.methods[0].record}`)
            console.log('--------------------------------------------------------------------------')
            await utils.askSpecific(rl, 'Domain verification is not yet complete- ensure your DNS records are setup as specified. Press "y" to retry, or ctrl+c to exit and revisit later.', ['y'])

            verifyDomainOutput = await auth0.verifyCustomDomain({"id": state.auth0CustomDomainId})
        }
        console.log('Domain has been verified!')
        state.auth0CustomDomainApiKey = verifyDomainOutput.cname_api_key
        state.auth0CustomDomainBackendDomain = verifyDomainOutput.origin_domain_name

        console.log('If you are following the manual, unguided process- please configure the following in your serverless.yml:')
        console.log('--------------------------------------------------------------------------')
        console.log(`Auth0 Custom Domain Name Backend Hostname (AUTH0_CUSTOM_DOMAIN_NAME_BACKEND): ${verifyDomainOutput.origin_domain_name}`)
        console.log(`Auth0 Custom Domain Name API Key (AUTH0_CUSTOM_DOMAIN_NAME_APIKEY): ${verifyDomainOutput.cname_api_key}`)
        console.log('--------------------------------------------------------------------------')
    }
}

//Create Necessary Authz Server
async function createApi(state, auth0) {
    var authzServerModel = models.authzServer

    authzServerModel.name += '-' + state.deploymentName

    authzServerModel.identifier = state.fhirBaseUrl

    var grantedScopes = []
    if(state.smartVersions === 'v1') {
        grantedScopes = models.authzScopes.concat(models.smartv1Scopes)
    }
    else if(state.smartVersions === 'v2') {
        grantedScopes = models.authzScopes.concat(models.smartv2Scopes)
    }
    else {
        grantedScopes = models.authzScopes.concat(models.smartv1Scopes.concat(models.smartv2Scopes))
    }

    authzServerModel.scopes = grantedScopes

    console.log(`Creating authorization server: ${authzServerModel.name}`)
    console.log(`With scopes: ${authzServerModel.scopes}`)

    const resourceServers = await auth0.getResourceServers()
    const foundAuthzServer = resourceServers.filter(server => server.name == authzServerModel.name)

    console.log(resourceServers)
    console.log(foundAuthzServer)

    console.debug("Existing authorization server found:")
    console.debug(foundAuthzServer)

    if(foundAuthzServer.length == 0) {
        console.log('Creating authorization server: ' + authzServerModel.name)
        console.debug('Server object:')
        console.debug(authzServerModel)
    
        const createdAuthzServer = await auth0.createResourceServer(authzServerModel)
        console.log('Authorization Server Created.')
        return createdAuthzServer.id
    }
    else {
        console.log(`The authorization server: ${authzServerModel.name} already exists. Skipping create. Please manually delete it first and try again.`)
        return foundAuthzServer[0].id
    }
}

//Create Necessary Applications in auth0 for SMART FHIR Reference.
async function createApps(state, auth0) {
    //First, create the patient picker app.
    var apiM2MClientModel = models.apiM2MClient
    var sampleConfidentialModel = models.sampleConfidentialApp

    sampleConfidentialModel.name += '-' + state.deploymentName
    apiM2MClientModel.name += '-' + state.deploymentName

    const apiM2MDetails = await createApp(auth0, apiM2MClientModel)

    //If we created the app, go ahead and grant it access to the auth0 management API.
    if(apiM2MDetails.created) {
        console.log('API Access Client Created. Granting Okta management API scopes.')
        var apiM2MClientGrant = models.apiM2MClientGrant
        apiM2MClientGrant.client_id = apiM2MDetails.id
        apiM2MClientGrant.audience = `https://${state.auth0Domain}/api/v2/`
        await auth0.createClientGrant(apiM2MClientGrant)
    }

    const sampleAppDetails = await createApp(auth0, sampleConfidentialModel)
    if(sampleAppDetails.created) {
        console.log('Sample SMART/FHIR Client Created. Granting FHIR Scopes...')
        var sampleFHIRAppClientGrant = models.sampleFHIRAppClientGrant
        sampleFHIRAppClientGrant.client_id = sampleAppDetails.id
        sampleFHIRAppClientGrant.audience = state.fhirBaseUrl

        var grantedScopes = []
        if(state.smartVersions === 'v1') {
            grantedScopes = models.authzScopes.concat(models.smartv1Scopes)
        }
        else if(state.smartVersions === 'v2') {
            grantedScopes = models.authzScopes.concat(models.smartv2Scopes)
        }
        else {
            grantedScopes = models.authzScopes.concat(models.smartv1Scopes.concat(models.smartv2Scopes))
        }
        const scopeList = grantedScopes.map(scope => scope.value)
        sampleFHIRAppClientGrant.scope = scopeList

        await auth0.createClientGrant(sampleFHIRAppClientGrant)
    }

    return {
        "apiM2MClientId": apiM2MDetails.id,
        "apiM2MClientSecret": apiM2MDetails.created ? apiM2MDetails.secret : null,
        "sampleAppId": sampleAppDetails.id,
        "sampleAppSecret": sampleAppDetails.created ? sampleAppDetails.secret : null
    }
}

//Creates a single application, given the application JSON model.
async function createApp(auth0, appModel) {
    console.log(`Creating app: ${appModel.name}`)

    //See if we have this object already.  If we do, let's skip.
    const apps = await auth0.getClients()
    const foundApp = apps.filter(app => app.name == appModel.name)

    console.debug('Existing apps found:')
    console.debug(foundApp)

    if(foundApp.length == 0) {
        console.log('Creating app: ' + appModel.name)
        console.debug('App object:')
        console.debug(appModel)
    
       const createdApp = await auth0.createClient(appModel)
    
        console.log('App Created.')
        console.debug(createdApp)
        return {
            created: true,
            id: createdApp.client_id,
            secret: createdApp.client_secret
        }
    }
    else {
        console.log(`The app: ${appModel.name} already exists. Skipping create. Please manually delete it first and try again.`)
        return {
            created: false,
            id: foundApp.client_id,
            secret: null
        }
    }
}

async function createRule(state, auth0, ruleName, ruleSourceCodeFilename) {
    const deployedRuleName = ruleName += '-' + state.deploymentName

    console.log(`Creating rule: ${deployedRuleName}`)

    const rules = await auth0.getRules()
    const foundRule = rules.filter(rule => rule.name == deployedRuleName)

    console.debug('Existing rule found:')
    console.debug(foundRule)

    if(foundRule.length == 0) {
        console.log('Creating rule: ' + deployedRuleName)
        const ruleCode = fs.readFileSync(ruleSourceCodeFilename, 'utf-8')
    
       const ruleModel = {
        "name": deployedRuleName,
        "script": ruleCode
       }
       const createdRule = await auth0.createRule(ruleModel)
        console.log('Rule Created.')
        console.debug(createdRule)
    }
    else {
        console.log(`The rule: ${deployedRuleName} already exists. Skipping create. Please manually delete it first and try again.`)
    }
}

async function overwriteRuleConfig(auth0, name, value) {
    console.log(`Setting rule config value for ${name}`)
    await auth0.setRulesConfig({"key": name}, {"value": value})
}

async function createSampleUser(state, auth0) {
    console.log('Creating sample user.')

    const foundUser = await auth0.getUsersByEmail(state.sampleUserName)

    console.debug('Existing sample user found:')
    console.debug(foundUser)

    if(foundUser.length == 0) {
        console.log('Creating sample user: ' + state.sampleUserName)
        const userModel = models.sampleUser
        userModel.email = state.sampleUserName
        userModel.password = state.sampleUserPassword
        userModel.app_metadata.fhirUser = `${state.sampleUserType}/${state.sampleUserFhirId}`

        const createdUser = await auth0.createUser(userModel)
        console.log('Sample user Created.')
        console.debug(createdUser)
    }
    else {
        console.log(`The user: ${state.sampleUserName} already exists. Skipping create. Please manually delete it first and try again.`)
    }
}