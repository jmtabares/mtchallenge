import { browser, by } from "protractor";
import { MainPage } from "../../pages/MainPage"
import { ResultPage } from "../../pages/ResultPage"
describe("Search for cookie monster cupckakes", ()=>
    {
        it("Verify proper results on result page", () =>
        {
            var mainPage =  new MainPage();
            var resultPage = new ResultPage();
            mainPage.OpenBrowser("http://www.food2fork.com");
            mainPage.Search("cookie monster cupcakes");
            resultPage.VerifyResultItems(1);
            resultPage.VerifyExpectedResult("cookie monster cupcakes",0)            
        });

    });