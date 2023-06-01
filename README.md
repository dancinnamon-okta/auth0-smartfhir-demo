# auth0-smartfhir-demo
This repository contains all of the components necessary to provide a SMART-launch compatible authorization platform leveraging auth0 as the core identity authentication and authorization service.

# Features
The following features of the [SMART launch framework v1](http://hl7.org/fhir/smart-app-launch/1.0.0/) and [SMART launch framework v2](http://hl7.org/fhir/smart-app-launch) are supported:
- Standalone launch sequence
- Launch parameters- including a patient picker for selecting the in-scope patient
- Public and Confidential client applications
- Support for partial consent (OAuth2 downscoping)
- Asymmetric client authentication for both B2B and B2C use cases

# Components
This entire project is managed by the [serverless framework](https://www.serverless.com/) - which is an easy way to manage numerous cloud resources as a single unit. The codebase was developed for, and has been primarily tested with AWS technologies.
This repository includes the following high level endpoints:

- **Patient Selection Screen + Consent:** The patient picker is a small application that enables the end user to select which patient they wish to consent and authorize for. Ultimately the patient picker will be updating the original application's /authorize request to remove the unapproved scopes, and to include the patient id.

- **Token endpoint:** The token endpoint is a lightweight proxy in front of auth0's  /token endpoint, and handles launch responses like launch/patient.

- **All necessary actions/rules within auth0 to support the deployment:** A redirect rule is used within auth0 to bounce the user out to the custom consent screen included in the solution.

## High Level Onboarding Steps
An automated deployment process has been created to help you deploy the solution. All of the steps may be performed manually- however this automated solution helps guide you through the process.  

### Pre-Steps
 - Determine what FHIR service you'd like to secure. This FHIR service must be available already. An example secured fhir proxy may be found [here](https://github.com/dancinnamon-okta/secured-fhir-proxy)
 - Determine what domain name you'll be using for your SMART authorization service
 - Install and configure the [serverless framework](https://www.serverless.com/framework/docs/getting-started) for your AWS tenant
 
 ## Automated/Guided Deployment
To assist with the deployment of the overall solution, a guided deployment process has been created! The automated process performs the following high level tasks.
* Uses a questionnaire to collect pre-requisite information from you
* Generates configuration files for automatically deploying auth0 resources as well as AWS resources
* Automatically deploying auth0 configuration
* Automatically deploying AWS configuration
* Assists with any manual steps that are necessary, such as any DNS updates that need to be made

Overall the process is managed in a step-by-step, wizard-like manner with the ability to start/stop the overall process at any point. After each step in the process, the user has the ability to continue, or pause and continue at a later time.

Files managed with the deploy script:
* deploy/work/state - This is a file created by the deploy script that determines what step in the process you're in, is used to start/stop the process, and finally is used to carry configuration information between the steps.

* /serverless.'deploymentname'.yml - This file will be generated as a copy of /deploy/aws/serverless.example.yml, with proper configuration obtained during the deployment process.  This may be used for future updates to AWS.

### Step 1- Install deployment dependencies
```bash
cd deploy
npm install
```

### Step 2- Run the deployment script
```bash
node deploy.js
```
Follow the guided process to finish your deployment!

### Post Deployment Management
The automated process was created with the intent of easily creating a SMART capable authorization server. It was not intended for ongoing maintenance. For ongoing maintenance, it is recommended to use proper CI/CD pipeline processes and/or other officially released maintenance tools.

**For updates to AWS**

To make updates to AWS resources, the serverless.yaml file generated during initial deployment may be used:
```bash
serverless deploy --verbose -c serverless.'deploymentname'.yaml
```

**For updates to auth0**

To update and maintain auth0 resources, it is recommended to use the [auth0 deploy CLI](https://auth0.com/docs/deploy-monitor/deploy-cli-tool/install-and-configure-the-deploy-cli-tool)