import { element,by } from "protractor";

export class ResultPage{
    VerifyResultItems(expected: number){
        var resultItems = element.all(by.css('.recipe-name'));
        //var resultItems = element.all(by.class('item masonry-brick'));
        //const resultsArray = cy.get("[class='item masonry-brick']");
        expect<any>(resultItems.count()).toEqual(expected);
        
    }
    VerifyExpectedResult(expected: string, index:number){
        var resultItems = element.all(by.css('.recipe-name'));
        //const resultsArray = cy.get("[class='item masonry-brick']").eq(index);                
        //resultsArray.should('have.text',"expected")
        var testElem = resultItems.get(index);
        testElem.getText().then(function(text){ 
            expect<any>(text.toLowerCase()).toEqual(expected);
        })        
    }
}