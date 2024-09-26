module.exports.smartConsentFormModel = {
    "name": "SMART Launch Framework - Custom Consent",
    "languages": {
      "primary": "en"
    },
    "nodes": [
      {
        "id": "step_bey3",
        "type": "STEP",
        "coordinates": {
          "x": 1726,
          "y": -140
        },
        "alias": "Display Patient Selection",
        "config": {
          "components": [
            {
              "id": "custom_TgJc",
              "category": "FIELD",
              "type": "CUSTOM",
              "required": false,
              "sensitive": false,
              "config": {
                "schema": {},
                "code": "function ImageField(context) {\n  const img = document.createElement('img');\n  \n  function mountComponent() {\n    const config = context.custom.getParams();\n    img.src = config.clientLogo;\n    img.classList.add('center');\n  }\n  \n  return {\n    /** Invoked once when the field is created */\n    init() {\n      mountComponent();\n      return img;\n    }\n  };\n}",
                "params": {
                  "clientLogo": "{{vars.clientLogo}}"
                }
              }
            },
            {
              "id": "divider_wx21",
              "category": "BLOCK",
              "type": "DIVIDER"
            },
            {
              "id": "authorizedPatient",
              "category": "FIELD",
              "type": "CUSTOM",
              "label": "You have been authorized to access the following patients. Which patient are you accessing?",
              "required": false,
              "sensitive": false,
              "config": {
                "schema": {},
                "code": "function PatientPickerField(context) {\n  const container = document.createElement('div');\n  \n  function mountComponent() {\n    const config = context.custom.getParams();\n    populateRadio(config.patients)\n  }\n  \n  function buildOption(patient) {\n    const outerDiv = document.createElement('div');\n    const radioInput = document.createElement('input');\n    const radioLabel = document.createElement('label');\n    const radioText = document.createElement('span');\n    \n    outerDiv.classList.add('af-choiceField-option');\n    radioInput.classList.add('af-choiceFieldOption-radio');\n    radioInput.classList.add('af-choiceFieldOption-checkable');\n    radioLabel.classList.add('af-field-label');\n    radioLabel.classList.add('af-choiceFieldOption-label');\n    radioText.classList.add('af-choiceFieldOption-text');\n    \n    radioInput.type = \"radio\"\n    radioInput.id = patient.ID\n    radioInput.name = \"selected_patient\"\n    radioInput.value = patient.ID\n    \n    radioLabel.for = patient.ID;\n    radioText.innerText = patient.Name;\n    radioLabel.appendChild(radioText);\n    \n    outerDiv.appendChild(radioInput);\n    outerDiv.appendChild(radioLabel);\n    \n    \n    return outerDiv;\n  }\n  \n  function populateRadio(patients) {\n    patients.forEach((o) => {\n      const option = buildOption(o);\n      container.appendChild(option);\n    });\n  }\n\n  return {\n    /** Invoked once when the field is created */\n    init() {\n      mountComponent();\n      return container;\n    },\n    /** Invoked when field has to be blocked */\n    block() {\n      container.disabled = true;\n    },\n    /** Invoked when field has to be unblocked */\n    unblock() {\n      container.disabled = false;\n    },\n    /** Invoked when the SDK needs to get the value (possibly several times) */\n    getValue() {\n      const radioButtons = document.querySelectorAll('input[name=\"selected_patient\"]');\n\t\t\tlet selectedValue;\n\n      radioButtons.forEach(radioButton => {\n        if (radioButton.checked) {\n          selectedValue = radioButton.value;\n        }\n      });\n      return selectedValue;\n    },\n  };\n}",
                "params": {
                  "patients": "{{vars.authorizedPatients}}"
                }
              }
            },
            {
              "id": "next_button_0ok3",
              "category": "BLOCK",
              "type": "NEXT_BUTTON",
              "config": {
                "text": "Continue"
              }
            }
          ],
          "next_node": "$ending"
        }
      },
      {
        "id": "step_8iO8",
        "type": "STEP",
        "coordinates": {
          "x": 956,
          "y": -208
        },
        "alias": "Scope Approval",
        "config": {
          "components": [
            {
              "id": "custom_eZO1",
              "category": "FIELD",
              "type": "CUSTOM",
              "required": false,
              "sensitive": false,
              "config": {
                "schema": {},
                "code": "function ImageField(context) {\n  const img = document.createElement('img');\n  \n  function mountComponent() {\n    const config = context.custom.getParams();\n    img.src = config.clientLogo;\n    img.classList.add('center');\n  }\n  \n  return {\n    /** Invoked once when the field is created */\n    init() {\n      mountComponent();\n      return img;\n    }\n  };\n}",
                "css": ".center {\n  display: block;\n  margin-left: auto;\n  margin-right: auto;\n  height: 64px\n}",
                "params": {
                  "clientLogo": "{{vars.clientLogo}}"
                }
              }
            },
            {
              "id": "divider_4pXy",
              "category": "BLOCK",
              "type": "DIVIDER"
            },
            {
              "id": "rich_text_1CK8",
              "category": "BLOCK",
              "type": "RICH_TEXT",
              "config": {
                "content": "<p>The application: <strong>{{context.client.name}}</strong> has requested access to your healthcare information.  A description of the requested access is shown below. If you wish to deny the application any of this access, please <u><em>uncheck</em></u> the appropriate checkbox.</p>"
              }
            },
            {
              "id": "divider_MjPF",
              "category": "BLOCK",
              "type": "DIVIDER"
            },
            {
              "id": "authorizedScopes",
              "category": "FIELD",
              "type": "CUSTOM",
              "required": true,
              "sensitive": false,
              "config": {
                "schema": {},
                "code": "function PatientPickerField(context) {\n  const container = document.createElement('div');\n  \n  function mountComponent() {\n    const config = context.custom.getParams();\n    populateCheckBoxes(config.scopes)\n  }\n  \n  function buildOption(scope) {\n    const outerDiv = document.createElement('div');\n    const checkBoxInput = document.createElement('input');\n    const checkBoxLabel = document.createElement('label');\n    const checkBoxText = document.createElement('span');\n    \n    outerDiv.classList.add('af-choiceField-option');\n    checkBoxInput.classList.add('af-choiceFieldOption-checkbox');\n    checkBoxInput.classList.add('af-choiceFieldOption-checkable');\n    checkBoxLabel.classList.add('af-field-label');\n    checkBoxLabel.classList.add('af-choiceFieldOption-label');\n    checkBoxText.classList.add('af-choiceFieldOption-text');\n    \n    checkBoxInput.type = \"checkbox\";\n    checkBoxInput.id = scope;\n    checkBoxInput.name = \"selected_scope\";\n    checkBoxInput.value = scope;\n    checkBoxInput.checked = true;\n    \n    checkBoxLabel.for = scope;\n    checkBoxLabel.innerText = scope;\n    checkBoxLabel.appendChild(checkBoxText);\n    \n    outerDiv.appendChild(checkBoxInput);\n    outerDiv.appendChild(checkBoxLabel);\n\n    return outerDiv;\n  }\n  \n  function populateCheckBoxes(scopes) {\n    console.log(scopes)\n    console.log(context.custom.getParams())\n    scopes.forEach((o) => {\n      const option = buildOption(o);\n      container.appendChild(option);\n    });\n  }\n\n  return {\n    /** Invoked once when the field is created */\n    init() {\n      mountComponent();\n      return container;\n    },\n    /** Invoked when field has to be blocked */\n    block() {\n      container.disabled = true;\n    },\n    /** Invoked when field has to be unblocked */\n    unblock() {\n      container.disabled = false;\n    },\n    /** Invoked when the SDK needs to get the value (possibly several times) */\n    getValue() {\n      var allowedScopes = [];\n      const checkBoxButtons = document.querySelectorAll('input[name=\"selected_scope\"]');\n\n      checkBoxButtons.forEach(checkBoxButton => {\n        if (checkBoxButton.checked) {\n          allowedScopes.push(checkBoxButton.value);\n        }\n      });\n      return allowedScopes;\n    }\n  };\n}",
                "params": {
                  "scopes": "{{vars.requestedScopes}}"
                }
              }
            },
            {
              "id": "next_button_dJS9",
              "category": "BLOCK",
              "type": "NEXT_BUTTON",
              "config": {
                "text": "Continue"
              }
            }
          ],
          "next_node": "step_bey3"
        }
      },
      {
        "id": "router_tS3g",
        "type": "ROUTER",
        "coordinates": {
          "x": 547,
          "y": -46
        },
        "alias": "Empty Step",
        "config": {
          "fallback": "step_8iO8"
        }
      }
    ],
    "start": {
      "next_node": "router_tS3g",
      "coordinates": {
        "x": 245,
        "y": -65
      }
    },
    "ending": {
      "resume_flow": true,
      "coordinates": {
        "x": 2449,
        "y": -61
      }
    }
  }