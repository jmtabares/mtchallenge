import { browser, element, by, ElementFinder, protractor } from "protractor";
export class MainPage{

    searchField = element(by.id("typeahead"));
    OpenBrowser(url: string){
        browser.waitForAngularEnabled(false);
        browser.get(url);
        browser.driver.manage().window().maximize()     
    }
    Search(term: string){
        this.searchField.clear();
        this.searchField.sendKeys(term);
        browser.actions().sendKeys(protractor.Key.ENTER).perform();                
        
    }
   
}