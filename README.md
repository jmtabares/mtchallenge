# mytheresa protractor_jasmine challenge


## Challenge 1
1. Page should be accesible 
2. All fields shall be present
3. Tab key allow to navigate the fields 
4. Happy path (complete all fields with correct data and submit)
5. Use enter instead of submit button submits the form
4. Test each field in isolation with
    1. Verify text field follows bussiness requirements for special characters
    2. Verify text field follows bussiness requirements for lenght
    3. Verify email field supports email formats
    4. Verify password follows bussiness requirements for lenght
    5. Verify password follows bussiness requirements for password strenght
    6. verify that system shall generate a validation message when submit the form with  no valid values on each invalid field
    7. Verify case insensivity on text fields
5. verify blanck spaces at the beggining and end of value are trimmed from the registration record once saved
6. verify field labes are correct and are in place
7. verify form is readable and work on diferent screeen sizes
8. verify blank spaces as value for fields throws error message
9. verify password is not readable when entered
10. verify password and password confirm shall be the same
11. verify password and password confirm shall throws an error when are not the same
12. verify cannot register twice with same email

## Challenge 2
To automate:
### GUI Level
 1. happy path
 2. Validation on user already exist 
 3. All Invalid messages
### API Level
 4. API valid registration: response message and 200 response code   
 5. API Invalid registration: response message and error response code   
### E2E Test
  6. DB validation for registration    

# Challenge 2
Pre requisites: Node.js should be instaled
1. Create a new directory  `mkdir protractor_test`
2. Enter to the created dir `cd protractor_test`
3. Init the npm withou question `npm init -y`
4. install protractor, typescript and types as a dev dependency `npm install --save protractor typescript @types/jasmine @types/node`
5. run `/node_modules/protractor/bin/webdriver-manager update` for local webdriver update
6. install protractor-beautifull.reporter `npm install protractor-beautiful-reporter --save-dev`
7. Now, typescript needs a basic configuration file of name tsconfig.json. Create this file and add the json below to it
```javascript
    {
        "compilerOptions": {
            "target": "es6",
            "module": "commonjs",
            "outDir": "temp",
            "types": ["jasmine", "node"]
        },
        "exclude": ["node_modules"],
    }
```
6. Follow on by creating a config.ts , which is a configuration file for protractor. Most basic config below:
```
import { Config } from "protractor";
var HtmlReporter = require('protractor-beautiful-reporter');
export let config: Config = {    
    directConnect: true,
    capabilities: {
        browserName: 'chrome',
      
        chromeOptions: {
           args: [ "--headless", "--disable-gpu", "--window-size=1600,700" ]
         }
      },
    specs: [
        "spec/**/*.spec.js"
    ],
    onPrepare: function() {
        // Add a screenshot reporter and store screenshots to `/Reports/screenshots`:
        jasmine.getEnv().addReporter(new HtmlReporter({
                baseDirectory: 'Reports/screenshots'
             }).getJasmine2Reporter());
          },
}
```
7. to run the test
    * npm run test
8. if you dont want toi run headless, remove `--headless` from chromeOptions on  config.ts capabilities

## Challenge 3
1. install protractor api resource `npm install protractor-api-resource`
2. run all test 

## Challenge 4

1. create interface for dictionaty to store rules
2. apply each rule 
3. return based on  if any rulke has been applied


## Run Challenges
All challenges run togheter on `npm run test`