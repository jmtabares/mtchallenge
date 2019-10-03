"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var request = require('request-promise');
var q = require('q');
var protractor_1 = require("protractor");
var RequestHandler = (function () {
    function RequestHandler() {
        this.requestMethods = {
            "GET": request.get,
            "POST": request.post,
            "PATCH": request.patch,
            "DELETE": request.delete,
            "PUT": request.put
        };
    }
    RequestHandler.prototype.makeRequest = function (requestObject, authType, authentication) {
        switch (authType) {
            case 0:
                return new ResponseHandler(this.requestMethods[requestObject.method](requestObject));
            case 1:
                return new ResponseHandler(this.requestMethods[requestObject.method](requestObject).auth(authentication.username, authentication.password));
            case 2:
                return new ResponseHandler(this.requestMethods[requestObject.method](requestObject).auth(null, null, true, authentication.token));
            case 3:
                return new ResponseHandler(this.handleCookieAuthentication(requestObject, authentication.cookie));
        }
    };
    RequestHandler.prototype.handleCookieAuthentication = function (requestObject, cookieNames) {
        return this.getCookieObjectFromBrowser()
            .then(function (cookieObject) {
            !requestObject.hasOwnProperty("headers") && (requestObject["headers"] = {});
            var cookieString = '';
            cookieNames.forEach(function (cookie) {
                cookieString += cookie + "=" + cookieObject[cookie] + ";";
                requestObject["headers"][cookie] = cookieObject[cookie].toString();
            });
            requestObject["headers"]["cookie"] = cookieString;
            return new ResponseHandler(this.requestMethods[requestObject.method](requestObject));
        });
    };
    RequestHandler.prototype.getCookieObjectFromBrowser = function () {
        var cookiePromise = q.defer();
        protractor_1.browser.driver.manage().getCookies().then(function (cookies) {
            var cookie_obj = {};
            for (var i = 0; i < cookies.length; i++) {
                cookie_obj[cookies[i].name] = cookies[i].value;
            }
            cookiePromise.resolve(cookie_obj);
        });
        return cookiePromise.promise;
    };
    return RequestHandler;
}());
exports.RequestHandler = RequestHandler;
var ResponseHandler = (function () {
    function ResponseHandler(apiPromise) {
        this.requestPromise = apiPromise;
    }
    ResponseHandler.prototype.toJSON = function () {
        return this.getResponse()
            .then(function (response) {
            return JSON.parse(response);
        });
    };
    ResponseHandler.prototype.toString = function () {
        return this.requestPromise;
    };
    ResponseHandler.prototype.getResponse = function () {
        return this.requestPromise
            .then(function (response) {
            return response;
        });
    };
    return ResponseHandler;
}());
