"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const protractor_1 = require("protractor");
class ResultPage {
    VerifyResultItems(expected) {
        var resultItems = protractor_1.element.all(protractor_1.by.css('.recipe-name'));
        //var resultItems = element.all(by.class('item masonry-brick'));
        //const resultsArray = cy.get("[class='item masonry-brick']");
        expect(resultItems.count()).toEqual(expected);
    }
    VerifyExpectedResult(expected, index) {
        var resultItems = protractor_1.element.all(protractor_1.by.css('.recipe-name'));
        //const resultsArray = cy.get("[class='item masonry-brick']").eq(index);                
        //resultsArray.should('have.text',"expected")
        var testElem = resultItems.get(index);
        testElem.getText().then(function (text) {
            expect(text.toLowerCase()).toEqual(expected);
        });
    }
}
exports.ResultPage = ResultPage;
