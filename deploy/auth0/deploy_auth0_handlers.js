const utils = require('../deploy_utils')
const ManagementClient = require('auth0').ManagementClient;
const models = require('./auth0_object_models')
const formModel = require('./forms/smart_consent_form_model')
const fs = require('fs')
const crypto = require('crypto')
const axios = require('axios')

module.exports.handlers = {
    handle_deploy_auth0: async (rl, state) => {
        var auth0 = new ManagementClient({
            domain: state.auth0Domain,
            clientId: state.auth0DeployMgmtClientId,
            clientSecret: state.auth0DeployMgmtClientSecret,
            scope: 'read:clients create:clients read:resource_servers create:resource_servers read:rules create:rules update:rules_configs read:users create:users read:forms create:forms'
        });

        //Deploy our resource server and applications
        await createApi(state, auth0)
        const appDetails = await createApps(state, auth0)
        const formId = await createForm(state, auth0)

        if(!state.refreshTokenHashSecret) {
            console.log('Generating strong value for signing our refresh tokens...')
            state.refreshTokenHashSecret = crypto.randomBytes(64).toString('hex')
        }

        //Deploy our actions
        //Our refresh token action.
        const refreshSecrets = []
        await createAction(state, auth0, 'Process Refresh Token', './auth0/actions/Process Refresh Token.js', refreshSecrets)

        //Our consent form action.
        const consentSecrets = [
            {"name": "FORM_ID", "value": formId},
            {"name": "DEFAULT_APP_LOGO_URL", "value": state.defaultAppLogo},
        ]
        await createAction(state, auth0, 'SMART Consent - Local Patient List', './auth0/actions/SMART Consent - Local Patient List.js', consentSecrets)

        //Output of detail to go into the platform deployment process.
        console.log('auth0 objects created!')
        console.log('If you are following the manual, unguided process- please configure the following in your serverless.yml:')
        console.log('--------------------------------------------------------------------------')
        console.log(`Refresh Token Signing Key (REFRESH_TOKEN_SIGNING_KEY): ${state.refreshTokenHashSecret}`)
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
    var sampleConfidentialModel = models.sampleConfidentialApp
    sampleConfidentialModel.name += '-' + state.deploymentName

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

async function createAction(state, auth0, actionName, actionSourceCodeFilename, secretsArray) {
    const deployedActionName = actionName += '-' + state.deploymentName

    console.log(`Creating action: ${deployedActionName}`)

    const foundAction = await auth0.actions.getAll({"actionName": deployedActionName})

    console.debug('Existing action found:')
    console.debug(foundAction)

    if(foundAction.actions.length == 0) {
        console.log('Creating action: ' + deployedActionName)
        const actionCode = fs.readFileSync(actionSourceCodeFilename, 'utf-8')
    
        const actionModel = {
            "name": deployedActionName,
            "runtime": "node18",
            "supported_triggers": [{
                "id": "post-login",
            }],
            "code": actionCode,
            "secrets": secretsArray
        }
        var createdAction = await auth0.actions.create(actionModel)
        const createdActionId = createdAction.id
        console.log('Action Created.')

        var retryCount = 0
        while(createdAction.status != 'built' && retryCount < 5) {
            createdAction = await auth0.actions.get({"id": createdActionId})
            retryCount++
        }

        console.log('Deploying action...')
        await auth0.actions.deploy({"id": createdActionId})

        console.log('Adding action to the beginning of the post login flow...')
        const existingBindings = await auth0.actions.triggerBindings.getAll({"trigger_id": "post-login"})
        console.log(existingBindings)
        var newBindings = [{
            "ref": {
                "type": "action_id",
                "value": createdActionId
            },
            "display_name": deployedActionName
        }]
        //Add the existing bindings after this one
        for(var i=0; i < existingBindings.total; i++) {
            newBindings.push({
                "ref": {
                    "type": "binding_id",
                    "value": existingBindings.bindings[i].id
                }
            })
        }

        await auth0.actions.triggerBindings.patch({"trigger_id": "post-login"},{"bindings": newBindings})

    }
    else {
        console.log(`The rule: ${deployedActionName} already exists. Skipping create. Please manually delete it first and try again.`)
    }
}

//Temporarily need to call the API directly - I need to update my SDK version for this.
async function createForm(state, auth0) {
    console.log('Creating sample form.')
    const url = `https://${state.auth0Domain}/api/v2/forms`
    const model = formModel.smartConsentFormModel
    const deployedFormName = model.name += '-' + state.deploymentName
    model.name = deployedFormName

    const accessToken = await auth0.tokenProvider.getAccessToken()
    const forms = await axios.request({
        "url": url,
        "method": "get",
        "headers": {
            "Authorization": `Bearer ${accessToken}`
        }
    })
    const foundForm = forms.data.filter(form => form.name == deployedFormName)
    if(foundForm.length == 0) {
        console.log('Creating Form: ' + deployedFormName)
        const newForm = await axios.request({
            "url": url,
            "method": "post",
            "headers": {
                "Authorization": `Bearer ${accessToken}`
            },
            "data": model
        })
        console.log(`Created new form with id: ${newForm.data.id}`)
        return newForm.data.id
    }
    else {
        console.log(`The form: ${deployedFormName} already exists. Skipping create. Please manually delete it first and try again.`)
        return foundForm.id
    }
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