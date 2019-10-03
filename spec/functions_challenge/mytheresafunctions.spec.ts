export interface IHash {
    [details: string] : string;
} 
function buildName(firstName: string, lastName: string) {
    return firstName + " " + lastName;
}
 function algorithmChallenge(value: number){
    let rules: IHash = {};   
    rules["3"] = "my";
    rules["5"] = "theresa";
    rules["7"] = "clothes";
    var result = "";
    Object.keys(rules).forEach((key) => {
        var x=+key;
        if (value%x==0){
            result = result.concat(rules[key]);
        }

    });
    return (result=="")?value:result;
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