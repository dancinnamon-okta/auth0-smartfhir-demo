# auth0-smartfhir-demo
Example of using Auth0 as an authorization server as part of a SMART on FHIR deployment.

## High Level Onboarding Steps
A more complete onboarding guide is a work in progress- however here are some general guidelines for deploying this reference implementation of SMART/FHIR with auth0!

### Pre-Steps
 - Determine what domain name you'll be using for your FHIR service
 - Determine what domain name you'll be using for your SMART service
 - Ensure that your top level domain(s) used for your services are managed by AWS Route 53 for automatic deployment
 - Install and configure the [serverless framework](https://www.serverless.com/framework/docs/getting-started) for your AWS tenant
 
*Note: The steps outlined in this guide are for the most fully automated onboarding process possible- if other DNS services are used, or other FHIR services are used- applicable existing services may be substituted in (but you're more "on your own")*

### Step 1- Deploy the reference FHIR Service (if you're using it)
- Copy serverless-fhir.example.yml to serverless-fhir.yml
- Fill out the FHIR_BASE_DOMAIN, FHIR_BASE_TLD, and AUTHZ_BASE_DOMAIN parameters.
- Create the certificate in ACM: `sls create-cert --verbose -c serverless-fhir.yml`
- Create the domain configuration in AWS Route 53: `sls create_domain --verbose -c serverless-fhir.yml`
- Deploy the FHIR service: `sls deploy --verbose -c serverless-fhir.yml`
- Test the FHIR service by visiting: https://fhir.yourdomain.tld/.well-known/smart-configuration

### Step 2- Deploy the auth0 resources
- Setup the auth0 [deploy CLI](https://auth0.com/docs/deploy-monitor/deploy-cli-tool/install-and-configure-the-deploy-cli-tool)
- Copy /auth0/config.json.example to /auth0/config.json (you can edit this file as a part of the deploy CLI setup too)
- Navigate to auth0 subfolder `cd /auth0`
- Deploy the resources to auth0: `a0deploy import --config_file config.json --input_file tenant.yaml`
- In the auth0 console, in the applications menu, open up the "Patient Picker Client Credentials" application, and copy the client_id, and client_secret values into "PICKER_CLIENT_ID and PICKER_CLIENT_SECRET" in config.json.
- Redeploy the resources to auth0: `a0deploy import --config_file config.json --input_file tenant.yaml`
- [Configure the authz domain name](https://auth0.com/docs/customize/custom-domains/self-managed-certificates#provide-your-domain-name-to-auth0) you've chosen as a custom domain in auth0 (this cannot be automatically done)  
- When presented with an "origin domain name", and a "cname-api-key" save these values for step 3.
*Note: After you verify the domain name, you may stop.  Reverse proxy configuration will automatically occur in step 3.*

### Step 3- Deploy the SMART proxy resources
- Copy serverless-smart.example.yml to serverless-smart.yml
- Fill out the BASE_DOMAIN, BASE_URL_TLD parameters.
- Create the certificate in ACM: `sls create-cert --verbose -c serverless-smart.yml`
- Create the domain configuration; also creates custom domain in api-gateway: `sls create_domain --verbose -c serverless-smart.yml`
- Fill out the remaining parameters in serverless-smart.yml
- Deploy the authz service: `sls deploy --verbose -c serverless-smart.yml`
- After deployment is complete, go into AWS cloudfront, and bring up the new distribution that was just created.  Take note of the "distribution domain name".
- Go into AWS route 53, and add a CNAME for your authz service domain -> CF distribution domain name.

### Step 4- Test the standalone launch flow
For a quick test, you can use the ONC inferno test suite.  It has been pre-registered with your auth0 tenant.

