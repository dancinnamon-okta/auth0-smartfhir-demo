'use strict';

// Mock patient access service.
// Just returns a list of sample patients for display in the custom consent patient picker.
// In a real implementation, this service would make an API call to an internal fine grained authorization service.
module.exports.mockPatientServiceHandler = async () => {
	return [
		//Auth0Fhir
		// {patient_id: '3758', patient_name: 'Abraham Murphy (32)'},
		// {patient_id: '35128', patient_name: 'Carlos Stehr (54)'},
		// {patient_id: '5050', patient_name: 'Albert Walter (Deceased)'}
		//HAPI
		//{patient_id: '1440422', patient_name: 'Samuel Ortiz (31)'},
		//{patient_id: '92e12467-e074-4349-a6d4-e88be191b39b', patient_name: 'Amberly Bahringer (65)'},
		//{patient_id: 'c769110f-4d4e-4375-a706-c5d78f729544', patient_name: 'Jann Ferry (63)'}
		//AWS FHIR
		{patient_id: 'https://fg93b2lt5i.execute-api.us-east-1.amazonaws.com/dev/tenant/sitetenant/Patient/21062c3a-53d6-43a8-bd1e-e2cd72d7f957', patient_name: 'Phoebe Nguyen'},
		{patient_id: 'Patient/81f65d61-8f91-4472-b668-0efc0aceb0f2', patient_name: 'Hane Doe'}
	]
}
