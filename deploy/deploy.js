//This script is intended to be a guided process for deploying all of the required configurations and infrastructue for supporting SMART/FHIR with Okta.
const readline = require('readline');
const fs = require('fs');

//Non platform specific deploy helpers.
const utils = require('./deploy_utils')
const STATE_FILE = './work/state'
const STATE_FINISHED = 'finished'
const STATE_QUESTIONNAIRE = 'deploy_questionnaire'
const auth0DeployHandlers = require('./auth0/deploy_auth0_handlers').handlers

//Platform specific deploy helpers.
const additionalStates = require('./aws/deploy_states').specificStateVariables
const states = require('./aws/deploy_states.js').states
const platformDeployHandlers = require('./aws/deploy_aws_handlers').handlers

const handlers = {
    ...auth0DeployHandlers,
    ...platformDeployHandlers
}

var state = {}

main()

async function main() {
    const rl = readline.createInterface(process.stdin, process.stdout);
    try {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        if(state.currentStep == STATE_FINISHED) {
            const newDeploy = await utils.askSpecific(rl, 'An existing finished deployment was found. Start a new deployment?', ['y','n'])
            if(newDeploy == 'n') {
                await handlers['handle_finished'](rl, state)
            }
            else {
                console.log('Starting new deployment.')
                state = initState()
            }
        }
        else {
            const continueDeploy = await utils.askSpecific(rl, `An existing in-process deployment was found. Continue that deployment (Next step is ${state.currentStep})?`, ['y','n'])
            if(continueDeploy == 'n') {
                state = initState()
            }
        }
    }
    catch(err) {
        console.log('No in-process deployment found. Starting with a new deployment!')
        state = initState()
    }

    console.log('Starting deployment tasks...')
    console.log('Current task: ' + state.currentStep)
    while(state.currentStep != STATE_FINISHED) {
        console.log('Processing deployment task: ' + state.currentStep)
        await handlers[`handle_${state.currentStep}`](rl, state)

        console.log('Deployment task complete. Saving state...')
        state.currentStep = states[states.indexOf(state.currentStep) + 1]
        saveState(state)

        const continueNext = await utils.askSpecific(rl, `Would you like to continue on to the next step (${state.currentStep})?`, ['y','n'])
        if(continueNext == 'n') {
            break
        }
    }
    if(state.currentStep == STATE_FINISHED) {
        await handlers['handle_finished'](rl, state)
    }
    rl.close()
    return
}

function initState() {
    return {
        currentStep: STATE_QUESTIONNAIRE,
        deploymentName: '',
        smartVersions: '',
        baseDomain: '',
        fhirBaseUrl: '',
        auth0Domain: '',
        auth0CustomDomainId: '',
        auth0CustomDomainApiKey: '',
        auth0CustomDomainBackendDomain: '',
        auth0DeployMgmtClientId: '',
        auth0DeployMgmtClientSecret: '',
        sampleUserName: '',
        sampleUserPassword: '',
        sampleUserType: '',
        sampleUserFhirId: '',
        refreshTokenHashSecret: '',
        defaultAppLogo: '',
        ...additionalStates
    }
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8');
}