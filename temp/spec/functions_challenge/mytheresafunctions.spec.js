"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function buildName(firstName, lastName) {
    return firstName + " " + lastName;
}
function algorithmChallenge(value) {
    let rules = {};
    rules["3"] = "my";
    rules["5"] = "theresa";
    rules["7"] = "clothes";
    var result = "";
    Object.keys(rules).forEach((key) => {
        var x = +key;
        if (value % x == 0) {
            result = result.concat(rules[key]);
        }
    });
    return (result == "") ? value : result;
}
let result = algorithmChallenge(1);
result = algorithmChallenge(3);
console.log(result);
result = algorithmChallenge(5);
console.log(result);
result = algorithmChallenge(15);
console.log(result);
result = algorithmChallenge(21);
console.log(result);
result = algorithmChallenge(105);
console.log(result);
/*
let result1 = buildName("Bob","Sinclair");
console.log(result1);
let myhash: IHash = {};

myhash["somestring"] = "value"; //set
myhash["other"] = "test"; //set

let value = myhash["somestring"]; //get
console.log(value)
Object.keys(myhash).forEach((key) => {console.log(myhash[key])});*/
/*
With the coding language you feel more comfortable write a method that passing a number as an
argument:
 Returns ‘’my” when the number is dividable by 3
 Returns “theresa” when the number is dividable by 5
 Returns “mytheresa” when the number is dividable by 3 and 5
 Returns the given number when the previous rules are not met.
Take into account when implementing the method that in a near future we would like to add more rules
in an easy way. For example:
 Return “clothes” when the number is dividable by 7
 Return “myclothes” when the number is dividable by 3 and 7 and so on.

f(number){
   dict: rules
   return = empty
   for each rule
      if apply
         return+=dict[rules]
    
}



*/ 
