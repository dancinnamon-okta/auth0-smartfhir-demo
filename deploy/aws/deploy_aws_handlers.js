const utils = require('../deploy_utils')
const YAML = require('yaml')
const fs = require('fs')
const execSync = require('child_process').execSync;

const SERVERLESS_AWS_EXAMPLE_CONFIG = './aws/serverless-smart.example.yml'

module.exports.handlers = {
    handle_deploy_questionnaire: async (rl, state) => {
        console.log('Collecting initial configuration information...')
        state.deploymentName = await utils.askPattern(rl, 'What would you like to name your deployment? This name is appended to all objects in auth0, and is also appended to all objects in AWS for easy association (Example: SMARTv1)', /.+/)
        state.smartVersions = await utils.askSpecific(rl, 'What SMART versions would you like to support? (v1, v2, both)', ['v1','v2','both'])
        state.awsRegion = await utils.askPattern(rl, 'What AWS region are you deploying in? (Example: us-east-1)', /.+/)
        state.baseDomain = await utils.askPattern(rl, 'What will the base domain of your authorization service be? (Example: smartauthz.your.tld)', /.+/)
        state.fhirBaseUrl = await utils.askPattern(rl, 'What is the base URL of the FHIR server you are securing? (Example: https://fhir.your.tld/r4)', /.+/)
      
        state.auth0Domain = await utils.askPattern(rl, 'What auth0 tenant will you use to secure this FHIR server? (Example: yourtenant.region.auth0.com)', /.+/)
        state.auth0DeployMgmtClientId = await utils.askPattern(rl, 'Please create a machine to machine application in your tenant for use by the deploy script to create required objects.  Enter the client ID for this M2M app here', /.+/)
        state.auth0DeployMgmtClientSecret = await utils.askPattern(rl, 'Enter the client secret for this M2M app here', /.+/)
        state.defaultAppLogo = await utils.askPattern(rl, 'For client applications that do not register an application logo, a default logo shall be shown instead at consent time. What default logo URL do you wish to use? (Example: https://logo.clearbit.com/okta.com)', /.+/)

        const createUser = await utils.askSpecific(rl, 'Would you like to create a sample user account on your auth0 tenant?', ['y','n'])
        if(createUser == 'y') {
            state.sampleUserName = await utils.askPattern(rl, 'What username, in email format, would you like to use for your sample user? (Example: testuser@atko.email)', /.+/)
            state.sampleUserPassword = await utils.askPattern(rl, 'What password would you like to use for your sample user? (At least 8 chars with upper/lower/number/special character)', /.+/)
            state.sampleUserType = await utils.askSpecific(rl, 'What FHIR resource type is your user? (Patient or Practitioner)', ['Patient', 'Practitioner'])
            state.sampleUserFhirId = await utils.askPattern(rl, 'What is the FHIR resource ID for this user? (Example: enter 1234 here if the sample user is a Patient, and has a patient ID of 1234)', /.+/)
        }
        console.log('All set! Deploying with the following configuration:')
        console.log(state)
    },

    handle_generate_serverless_config: async (rl, state) => {
        const serverlessConfigFile= `./work/serverless.${state.deploymentName}.yml`
        console.log(`Reading example serverless config at: ${SERVERLESS_AWS_EXAMPLE_CONFIG}`)
        var serverlessConfig = YAML.parse(fs.readFileSync(SERVERLESS_AWS_EXAMPLE_CONFIG, 'utf-8'));
        
        serverlessConfig.service = `smart-ref-${state.deploymentName}`
        serverlessConfig.params.default.AWS_REGION = state.awsRegion
        serverlessConfig.params.default.BASE_DOMAIN = state.baseDomain
        const domainParts = state.baseDomain.split('.')
        serverlessConfig.params.default.BASE_URL_TLD = `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}.`
    
        serverlessConfig.params.default.AUTH0_CUSTOM_DOMAIN_NAME_BACKEND = state.auth0CustomDomainBackendDomain
        serverlessConfig.params.default.AUTH0_CUSTOM_DOMAIN_NAME_APIKEY = state.auth0CustomDomainApiKey
        serverlessConfig.params.default.API_GATEWAY_DOMAIN_NAME_BACKEND = state.apiGatewayBackendDomain

        serverlessConfig.params.default.REFRESH_TOKEN_SIGNING_KEY = state.refreshTokenHashSecret

        console.log(`Writing new config file at: ${serverlessConfigFile}`)
        fs.writeFileSync(serverlessConfigFile, YAML.stringify(serverlessConfig), 'utf-8');
    },

    handle_aws_certs: async (rl, state) => {
        const usingRoute53 = await utils.askSpecific(rl, 'Are you using route53 to handle DNS for your base domain?', ['y','n'])
        if(usingRoute53 == 'y') {
            console.log('Requesting and deploying TLS certs in AWS...')
            console.log('Ensuring pre-requisite software is installed...')
            execSync('npm install', {cwd: '../', stdio: 'inherit'})

            console.log(`Requesting a cert in ${state.awsRegion}`)
            const certDeployServerlessConfigFile = `./work/serverless.${state.deploymentName}.cert.yml`
            const domainParts = state.baseDomain.split('.')

            const certServerlessConfig = {
                service: `cert-deploy-${state.awsRegion}`,
                plugins: ['serverless-certificate-creator'],
                provider: {name: 'aws', region: state.awsRegion},
                custom: {
                    customCertificate: {
                        certificateName: state.baseDomain,
                        region: state.awsRegion,
                        hostedZoneNames: `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}.`,
                        subjectAlternativeNames: [state.baseDomain]
                    }
                }
            } 
            fs.writeFileSync(certDeployServerlessConfigFile, YAML.stringify(certServerlessConfig), 'utf-8');
            
            execSync(`serverless create-cert --verbose -c ${certDeployServerlessConfigFile.replace('./work/','')}`, {cwd: './work', stdio: 'inherit'})

            if(state.awsRegion != 'us-east-1') {
                console.log('Your service is being deployed outside of us-east-1. Cloudfront requires a certificate in us-east-1. Requesting the same cert in us-east-1')
                const usEastCertDeployServerlessConfigFile = `./work/serverless.${state.deploymentName}.useast1.cert.yml`
                const certUSEastServerlessConfig = {
                    service: `cert-deploy-us-east-1`,
                    plugins: ['serverless-certificate-creator'],
                    provider: {name: 'aws', region: 'us-east-1'},
                    custom: {
                        customCertificate: {
                            certificateName: state.baseDomain,
                            region: 'us-east-1',
                            hostedZoneNames: `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}.`,
                            subjectAlternativeNames: [state.baseDomain]
                        }
                    }
                } 
                fs.writeFileSync(usEastCertDeployServerlessConfigFile, YAML.stringify(certUSEastServerlessConfig), 'utf-8');
                execSync(`serverless create-cert --verbose -c ${usEastCertDeployServerlessConfigFile.replace('./work/','')}`, {cwd: './work', stdio: 'inherit'})
            }
        }
        else {
            console.log('If you are not using route 53, you will have to manually request your certificate within the ACM module of AWS.')
            console.log('Please see: https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html')
            console.log('You must request a certificate for: ' + state.BASE_DOMAIN + ' in AWS region: ' + state.awsRegion)
            if(state.awsRegion != 'us-east-1') {
                console.log('You must also request a certificate for: ' + state.BASE_DOMAIN + ' in AWS region us-east-1! This is required for our cloudfront setup.')
            }
            console.log('When completed with your certificate requests and completed domain validation- proceed to the next step.')
        }
    },

    handle_aws_custom_domain: async (rl, state) => {
        console.log('Setting up custom domain in AWS API Gateway...')

        const domainDeployServerlessConfigFile = `./work/serverless.${state.deploymentName}.domain.yml`

        const domainServerlessConfig = {
            service: `domain-deploy-${state.awsRegion}`,
            plugins: ['serverless-domain-manager'],
            provider: {name: 'aws', region: state.awsRegion},
            custom: {
                customDomain: {
                    domainName: state.baseDomain,
                    certificateName: state.baseDomain,
                    basePath: '',
                    createRoute53Record: false,
                    endpointType: 'regional'
                }
            }
        } 

        fs.writeFileSync(domainDeployServerlessConfigFile, YAML.stringify(domainServerlessConfig), 'utf-8');
            
        execSync(`serverless create_domain --verbose -c ${domainDeployServerlessConfigFile.replace('./work/','')}`, {cwd: './work', stdio: 'inherit'})
    },

    handle_collect_aws_api_gateway_domain: async (rl, state) => {
        console.log('Manual step to configure the custom domain in AWS API Gateway...')
        console.log('In order to finalize our AWS setup, we need the API gateway internal domain name for the custom domain we just created.')
        console.log('To get this value, visit the following URL:')
        console.log(`https://${state.awsRegion}.console.aws.amazon.com/apigateway/main/publish/domain-names?domain=${state.baseDomain}&region=${state.awsRegion}`)
        console.log(`Copy the "API Gateway domain name" field and be ready to provide it at the next prompt. The value will look simlar to: <uniqueid>.execute-api.${state.awsRegion}.amazonaws.com`)
        await utils.askSpecific(rl, 'Press "y" when you have this value, or ctrl+c to exit and revisit later.', ['y'])
        state.apiGatewayBackendDomain = await utils.askPattern(rl, 'API Gateway domain name', /.+/)
    },

    handle_aws_deploy: async (rl, state) => {
        console.log('Deploying resources to AWS...')
        console.log('Copying serverless config file to the root of the project...')
        console.log(`Copying ./work/serverless.${state.deploymentName}.yml to ../serverless.${state.deploymentName}.yml`)
        execSync(`cp ./work/serverless.${state.deploymentName}.yml ../serverless.${state.deploymentName}.yml`, {cwd: './', stdio: 'inherit'})

        await utils.askSpecific(rl, 'Press "y" when you are ready to finish AWS deployment (this will take 10-15 minutes), or ctrl+c to exit and revisit later.', ['y'])
        execSync(`serverless deploy --verbose -c serverless.${state.deploymentName}.yml`, {cwd: '../', stdio: 'inherit'})
    },

    handle_update_domain_cname: async (rl, state) => {
        console.log('Manual step to update DNS CNAME resolution for your custom domain...')
    
        
        console.log('Open the following URL in your brower to determine the new CNAME value:')
        console.log('Note- the goal here is to point your base authorization domain at the cloudfront distribution we\'ve created.')
        console.log(`https://${state.awsRegion}.console.aws.amazon.com/cloudfront/v3/home?region=${state.awsRegion}#/distributions`)
        console.log('Locate the "DomainName" field - it will be similar to: <uniqueid>.cloudfront.net.')
        console.log(`Please update your CNAME record for ${state.baseDomain} to this value.`)

        await utils.askSpecific(rl, `Press "y" when you have updated your DNS CNAME record or ctrl+c to exit and revisit later.`, ['y'])
    },
    handle_finished: async (rl, state) => {
        console.log('Your deployment is complete!')
        console.log('These are details you must provide to your FHIR implementation.')
        console.log('These values must be placed in the FHIR server\'s smart-configuration endpoint')

        console.log(`Issuer: https://${state.baseDomain}/`)
        console.log(`Authorize URL: https://${state.baseDomain}/authorize`)
        console.log(`Token URL: https://${state.baseDomain}/oauth/token`)
        console.log(`Keys URL: https://${state.baseDomain}/.well-known/jwks.json`)
    }
}