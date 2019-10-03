"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var requestHandler_1 = require("./requestHandler");
var ResourcePrototypeGenerator = (function () {
    function ResourcePrototypeGenerator() {
        this.requesthandler = new requestHandler_1.RequestHandler();
    }
    ;
    ResourcePrototypeGenerator.prototype.constructResource = function (apiDetailObject, authType, authentication) {
        var self = this;
        return function (params, payload) {
            params = params || apiDetailObject.params || "";
            var urlString = apiDetailObject.baseUrl + self.interpolateUrlWithParams(apiDetailObject.path, params);
            var requestObject = {
                uri: urlString,
                method: apiDetailObject.method || "GET"
            };
            if (apiDetailObject.method == "POST" || apiDetailObject.method == "PATCH" || apiDetailObject.method == "PUT") {
                requestObject["body"] = JSON.stringify(payload);
                requestObject["headers"] = {
                    "content-type": "application/json",
                    "cache-control": "no-cache"
                };
            }
            return self.requesthandler.makeRequest(requestObject, authType, authentication);
        };
    };
    ResourcePrototypeGenerator.prototype.interpolateUrlWithParams = function (path, params) {
        var regexObject;
        for (var param in params) {
            if (params.hasOwnProperty(param) && path.indexOf(":" + param + ":") >= 0) {
                regexObject = new RegExp(":" + param + ":", "g");
                path = path.replace(regexObject, this.convertParamsToStringObject(params[param]));
            }
            else {
                path += path.substr(path.length - 1) == "/" ? "?" : "";
                path += (path.substr(path.length - 1) == "&" || path.substr(path.length - 1) == "?") ?
                    param + "=" + this.convertParamsToStringObject(params[param]) :
                    "&" + param + "=" + this.convertParamsToStringObject(params[param]);
            }
        }
        return path;
    };
    ResourcePrototypeGenerator.prototype.convertParamsToStringObject = function (param) {
        return Array.isArray(param) ? JSON.stringify(param) : param;
    };
    return ResourcePrototypeGenerator;
}());
exports.ResourcePrototypeGenerator = ResourcePrototypeGenerator;
