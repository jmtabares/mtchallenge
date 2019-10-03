"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const protractor_1 = require("protractor");
class MainPage {
    constructor() {
        this.searchField = protractor_1.element(protractor_1.by.id("typeahead"));
    }
    OpenBrowser(url) {
        protractor_1.browser.waitForAngularEnabled(false);
        protractor_1.browser.get(url);
        protractor_1.browser.driver.manage().window().maximize();
    }
    Search(term) {
        this.searchField.clear();
        this.searchField.sendKeys(term);
        protractor_1.browser.actions().sendKeys(protractor_1.protractor.Key.ENTER).perform();
    }
}
exports.MainPage = MainPage;
