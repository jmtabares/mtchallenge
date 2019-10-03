"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var url = require('url');
var prototypeBuilder_1 = require("./prototypeBuilder");
var AUTHENTICATION_TYPES;
(function (AUTHENTICATION_TYPES) {
    AUTHENTICATION_TYPES[AUTHENTICATION_TYPES["NO"] = 0] = "NO";
    AUTHENTICATION_TYPES[AUTHENTICATION_TYPES["BASIC"] = 1] = "BASIC";
    AUTHENTICATION_TYPES[AUTHENTICATION_TYPES["TOKEN"] = 2] = "TOKEN";
    AUTHENTICATION_TYPES[AUTHENTICATION_TYPES["COOKIE"] = 3] = "COOKIE";
})(AUTHENTICATION_TYPES || (AUTHENTICATION_TYPES = {}));
;
var ProtractorApiResource = (function () {
    function ProtractorApiResource(host, port) {
        this.AUTH_TYPE = AUTHENTICATION_TYPES.NO;
        this.authentication = {
            username: "",
            password: "",
            token: "",
            cookie: []
        };
        this.apiDetails = {};
        this.parseBaseUrl(host, port);
        this.resourcePrototypeGenerator = new prototypeBuilder_1.ResourcePrototypeGenerator();
    }
    ProtractorApiResource.prototype.registerService = function (apiDetailObject) {
        var self = this;
        this.apiDetails = apiDetailObject;
        Object.keys(apiDetailObject).map(function (apiDetails) {
            apiDetailObject[apiDetails].baseUrl = self.baseUrl;
            ProtractorApiResource.prototype[apiDetails] = self.resourcePrototypeGenerator.constructResource(apiDetailObject[apiDetails], self.AUTH_TYPE, self.authentication);
        });
        return this;
    };
    ProtractorApiResource.prototype.withBasicAuth = function (username, password) {
        this.AUTH_TYPE = AUTHENTICATION_TYPES.BASIC;
        this.authentication.username = username;
        this.authentication.password = password;
        return this;
    };
    ProtractorApiResource.prototype.withTokenAuthentication = function (token) {
        this.AUTH_TYPE = AUTHENTICATION_TYPES.BASIC;
        this.authentication.token = token;
        return this;
    };
    ProtractorApiResource.prototype.withCookieAuthentication = function (cookieNames) {
        this.AUTH_TYPE = AUTHENTICATION_TYPES.BASIC;
        this.authentication.cookie = cookieNames;
        return this;
    };
    ProtractorApiResource.prototype.reConstructResource = function () {
        this.registerService(this.apiDetails);
        return this;
    };
    ProtractorApiResource.prototype.parseBaseUrl = function (host, port) {
        try {
            this.host = host;
            this.port = port || null;
            this.baseUrl = url.parse(host + (port || "")).href.replace(/\/$/, '');
        }
        catch (err) {
            throw new Error(err);
        }
    };
    return ProtractorApiResource;
}());
exports.ProtractorApiResource = ProtractorApiResource;
