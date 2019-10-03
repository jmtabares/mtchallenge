"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MainPage_1 = require("../../pages/MainPage");
const ResultPage_1 = require("../../pages/ResultPage");
describe("Search for cookie monster cupckakes", () => {
    it("Verify proper results on result page", () => {
        var mainPage = new MainPage_1.MainPage();
        var resultPage = new ResultPage_1.ResultPage();
        mainPage.OpenBrowser("http://www.food2fork.com");
        mainPage.Search("cookie monster cupcakes");
        resultPage.VerifyResultItems(1);
        resultPage.VerifyExpectedResult("cookie monster cupcakes", 0);
    });
});
