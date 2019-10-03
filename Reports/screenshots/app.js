var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "login functionality with valid credentials|Registration and Login functionality",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 28985,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239640,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239640,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239640,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239640,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239640,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239642,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239643,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239643,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239643,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239643,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239644,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239644,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239645,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239645,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239645,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239646,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239646,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239646,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239646,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239646,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239647,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239748,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239749,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239749,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239749,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239749,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239750,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239750,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239750,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239750,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239750,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239751,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239751,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239751,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239751,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239752,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239752,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239752,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239753,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239753,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239753,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239753,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239754,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239754,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239754,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239754,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239754,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239755,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239755,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239755,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040239755,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570040239848,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570040239806&_gfid=I0_1570040239806&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=11918330 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570040239959,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040242704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040242804,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570040242811,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570040242738&_gfid=I0_1570040242738&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=17414310 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570040242821,
                "type": ""
            }
        ],
        "screenShotFile": "002f009b-0005-00f3-0006-0057007d0015.png",
        "timestamp": 1570040238145,
        "duration": 4821
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 29074,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/22100331peepshiprimarydb4a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BDouble2BCheese2BBurger2BDip2B5002B3557cdaa745d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/scampibf5a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/2103577050_86a171d9e005ab.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/broccoli_pesto_quinoa4c75.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Cheesy2BBroccoli2BQuinoa2B5002B4620b7a2a308.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/fruitpizza9a19.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4005704623.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/JalapenoPopperDip5007f1380ca.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/roastchicken2feab.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/IMG_23033378.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4944642923_594e44ab22_o049c.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/gnocchirecipe_07d074.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/strawberrylemonadecopy77b6.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454581,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/205xNxchickenandspinachflautas2296f.jpg.pagespeed.ic.RNEW9wsRU.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454582,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/103167cea.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454583,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454583,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/kale_market_saladd20e.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454583,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454584,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/22100331peepshiprimarydb4a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454702,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454703,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BDouble2BCheese2BBurger2BDip2B5002B3557cdaa745d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/scampibf5a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454705,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/2103577050_86a171d9e005ab.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454706,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454706,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/broccoli_pesto_quinoa4c75.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454708,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454708,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Cheesy2BBroccoli2BQuinoa2B5002B4620b7a2a308.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454709,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/fruitpizza9a19.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454710,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454710,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4005704623.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454711,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454711,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/JalapenoPopperDip5007f1380ca.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454711,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454712,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/roastchicken2feab.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454712,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454713,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/IMG_23033378.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454713,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4944642923_594e44ab22_o049c.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454715,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/gnocchirecipe_07d074.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454716,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/strawberrylemonadecopy77b6.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454718,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454719,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/205xNxchickenandspinachflautas2296f.jpg.pagespeed.ic.RNEW9wsRU.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454720,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/103167cea.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454722,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454723,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/kale_market_saladd20e.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454723,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454724,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454724,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454725,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040454725,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570040454923,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040457244,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570040457265,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570040457449,
                "type": ""
            }
        ],
        "screenShotFile": "000a001f-004c-008c-005b-00c40020001c.png",
        "timestamp": 1570040452636,
        "duration": 5055
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48594,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": [
            "Failed: apiClient.getPosts is not a function"
        ],
        "trace": [
            "TypeError: apiClient.getPosts is not a function\n    at UserContext.<anonymous> (/Users/jairtabares/Documents/Dev/challenge/mytheresa/temp/spec/api_challenge/mytheresaapi.spec.js:14:19)\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasminewd2/index.js:108:15\n    at new ManagedPromise (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:85:5)\nFrom: Task: Run it(\"Verify proper results o from api search\") in control flow\n    at UserContext.<anonymous> (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:2599:53\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:2728:9\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:85:5)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/jairtabares/Documents/Dev/challenge/mytheresa/temp/spec/api_challenge/mytheresaapi.spec.js:12:5)\n    at addSpecsToSuite (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/jairtabares/Documents/Dev/challenge/mytheresa/temp/spec/api_challenge/mytheresaapi.spec.js:2:1)\n    at Module._compile (internal/modules/cjs/loader.js:868:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:879:10)\n    at Module.load (internal/modules/cjs/loader.js:731:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:644:12)\n    at Module.require (internal/modules/cjs/loader.js:771:19)\n    at require (internal/modules/cjs/helpers.js:68:18)\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine/lib/jasmine.js:93:5\n    at Array.forEach (<anonymous>)\n    at Jasmine.loadSpecs (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine/lib/jasmine.js:92:18)\n    at Jasmine.execute (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine/lib/jasmine.js:197:8)\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/protractor/built/frameworks/jasmine.js:132:15\n    at Function.promise (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/q/q.js:682:9)\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/protractor/built/frameworks/jasmine.js:104:14\n    at _fulfilled (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/q/q.js:834:54)\n    at /Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/q/q.js:863:30\n    at Promise.promise.promiseDispatch (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/q/q.js:796:13)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c20015-002c-006a-0011-00f300ca0063.png",
        "timestamp": 1570131182048,
        "duration": 7
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48594,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185298,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185301,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185301,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185301,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185301,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185301,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185301,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185302,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185302,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185302,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185302,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185302,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185302,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185303,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185303,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185303,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185390,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185391,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185392,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185392,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185392,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185393,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185394,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185394,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185394,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185394,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185394,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185395,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185395,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185395,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185396,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185396,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185396,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185396,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185397,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185397,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185397,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185397,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185398,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185398,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185398,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185398,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185399,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185399,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185399,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131185399,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131185519,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131185455&_gfid=I0_1570131185455&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=22400479 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131185573,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131188273,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131188290,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570131188397,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131188357&_gfid=I0_1570131188357&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=13080307 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131188428,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131188573,
                "type": ""
            }
        ],
        "screenShotFile": "00560024-008f-0036-0015-00a600b200f8.png",
        "timestamp": 1570131183261,
        "duration": 5481
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48594,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190254,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190254,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190254,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190254,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190254,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190256,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190256,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190256,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190256,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190256,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190257,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190257,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190294,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190294,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190294,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190296,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190296,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190296,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190296,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190296,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190297,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190297,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190297,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190298,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190298,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190298,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190298,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190299,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190300,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131190300,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131190399,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131190346&_gfid=I0_1570131190346&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=29440911 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131190427,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131191568,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131191579,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131191696,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131191610&_gfid=I0_1570131191610&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=77929703 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131191709,
                "type": ""
            }
        ],
        "screenShotFile": "00c00007-00dd-00ce-007e-00dd000a00ea.png",
        "timestamp": 1570131189643,
        "duration": 2211
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48626,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:531:17)\n    at processTimers (internal/timers.js:475:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:531:17)\n    at processTimers (internal/timers.js:475:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "00fd003a-00c0-0034-003e-004c009d005f.png",
        "timestamp": 1570131225246,
        "duration": 60014
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48626,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287526,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287527,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287528,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287688,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287689,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287689,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287689,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287689,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287690,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287690,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287690,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287690,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287691,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287691,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287691,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287691,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287692,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287692,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287692,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287692,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287692,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287693,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287693,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287693,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287693,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287694,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287694,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287694,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287694,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287695,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287695,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287695,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131287695,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131287762,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131287717&_gfid=I0_1570131287717&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=25111542 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131287837,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131289722,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131289740,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570131289850,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131289897,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131289807&_gfid=I0_1570131289807&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=40188951 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131289900,
                "type": ""
            }
        ],
        "screenShotFile": "00d9008d-0056-0085-00c8-00d60073005e.png",
        "timestamp": 1570131286159,
        "duration": 3897
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48626,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291425,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291425,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291425,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291425,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291426,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291426,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291426,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291426,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291426,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291426,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291426,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291427,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291427,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291427,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291427,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291427,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291427,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291428,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291428,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291465,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291466,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291466,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291467,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291467,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291498,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291498,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291499,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291499,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291501,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291504,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291504,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291505,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291505,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291505,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291505,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291505,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291505,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291505,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291505,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291506,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291506,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291506,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291506,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291506,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131291507,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131291519&_gfid=I0_1570131291519&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=24039778 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131291597,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131291600,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131292638,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131292648,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131292741,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131292689&_gfid=I0_1570131292689&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=35625520 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131292755,
                "type": ""
            }
        ],
        "screenShotFile": "00d00060-00b3-0011-0089-006a00ba001c.png",
        "timestamp": 1570131290781,
        "duration": 2068
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48712,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:531:17)\n    at processTimers (internal/timers.js:475:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:531:17)\n    at processTimers (internal/timers.js:475:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "007e000c-0000-0096-00e6-00af00eb00a8.png",
        "timestamp": 1570131535865,
        "duration": 60009
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48712,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598911,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598912,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598912,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598912,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598912,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598912,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598912,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598913,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598913,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598913,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598913,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598913,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598913,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598914,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598914,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598914,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598914,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598914,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598914,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598915,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598915,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598915,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598915,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598915,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598915,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598916,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598916,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598916,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598916,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131598917,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599028,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599028,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599028,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599029,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599029,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599029,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599029,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599030,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599030,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599030,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599032,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599032,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599033,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599033,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599033,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599033,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599034,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599034,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599034,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599036,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599036,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599036,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599036,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599037,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599037,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599037,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131599037,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131599228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131599137&_gfid=I0_1570131599137&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=41768127 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131599232,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131601288,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131601300,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131601382,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131601327&_gfid=I0_1570131601327&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=38019283 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131601407,
                "type": ""
            }
        ],
        "screenShotFile": "001700ea-005c-0096-00b3-009d0014001c.png",
        "timestamp": 1570131596971,
        "duration": 4589
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48712,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602986,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602986,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602986,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602986,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602986,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602986,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602986,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602987,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602987,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602987,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602987,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602987,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602987,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602988,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602988,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602988,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602988,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602988,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602989,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602989,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602989,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602989,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602989,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602990,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602990,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602990,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602990,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602990,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602990,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131602991,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603024,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603025,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603025,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603026,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603026,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603027,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603027,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603027,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603027,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603027,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603028,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603028,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603029,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603029,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603029,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603029,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603030,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603030,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603033,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603033,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603035,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603036,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131603036,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131603194,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131603121&_gfid=I0_1570131603121&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=24519297 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131603228,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131604560,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131604574,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131604691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131604629&_gfid=I0_1570131604629&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=24757855 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131604700,
                "type": ""
            }
        ],
        "screenShotFile": "00fe00e8-00bf-00cd-00d4-0080005300d4.png",
        "timestamp": 1570131602374,
        "duration": 2451
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48750,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:531:17)\n    at processTimers (internal/timers.js:475:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:531:17)\n    at processTimers (internal/timers.js:475:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "0061008f-0049-00c3-00bf-008600a300cf.png",
        "timestamp": 1570131622134,
        "duration": 60019
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48750,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684517,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684518,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684518,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684518,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684519,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684520,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684521,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684521,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684521,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684521,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684521,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684521,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684521,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131684680,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684700,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684700,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684700,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684701,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684701,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684701,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684701,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684702,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684702,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684702,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684702,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684703,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684703,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684703,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684703,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684705,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684705,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684705,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684705,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684706,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684706,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684706,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684706,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684707,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684707,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131684707,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131684732&_gfid=I0_1570131684732&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=40456862 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131684852,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131686755,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131686772,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570131686879,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131686884,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131686840&_gfid=I0_1570131686840&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=26072635 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131686947,
                "type": ""
            }
        ],
        "screenShotFile": "00640069-0018-0098-00b6-006000a500d3.png",
        "timestamp": 1570131683041,
        "duration": 4008
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48750,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688442,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688442,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688442,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688442,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688442,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688442,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688443,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688443,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688443,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688443,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688443,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688443,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688444,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688444,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688444,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688444,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688444,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688445,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688445,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688445,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688445,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688445,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688445,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688446,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688446,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688446,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688446,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688446,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688447,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688447,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688480,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688481,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688481,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688481,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688481,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688482,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688482,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688482,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688483,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688484,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688485,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688485,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688485,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688485,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688485,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688486,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688486,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688489,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688489,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688489,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688489,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688489,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688489,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131688489,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131688587,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131688531&_gfid=I0_1570131688531&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=38119259 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131688607,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131689654,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131689663,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131689733,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131689702&_gfid=I0_1570131689702&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=19544387 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131689778,
                "type": ""
            }
        ],
        "screenShotFile": "007f0098-00e9-0089-00eb-00dc0000005b.png",
        "timestamp": 1570131687773,
        "duration": 2120
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48911,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:531:17)\n    at processTimers (internal/timers.js:475:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (/Users/jairtabares/Documents/Dev/challenge/mytheresa/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:531:17)\n    at processTimers (internal/timers.js:475:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "004300ae-0037-00b0-0009-0001007400e9.png",
        "timestamp": 1570131738575,
        "duration": 60011
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48911,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800843,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800843,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800843,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800843,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800843,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800843,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800843,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800843,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800843,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800844,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800844,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800844,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800844,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800844,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800844,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800844,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800845,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800845,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800845,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800845,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800845,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800846,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800846,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800846,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800846,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800846,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800846,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800846,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800847,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800847,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800961,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800962,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800962,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800963,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800963,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800963,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800963,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800963,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800964,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800965,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800965,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800965,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800965,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800965,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800966,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800966,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800966,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800967,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800967,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800967,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800967,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800970,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131800970,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131801054,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131801043&_gfid=I0_1570131801043&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=18635333 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131801168,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131802895,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131802908,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131802989,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131802933&_gfid=I0_1570131802933&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=15546747 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131803050,
                "type": ""
            }
        ],
        "screenShotFile": "00b60096-0039-0065-0082-00c600770022.png",
        "timestamp": 1570131799335,
        "duration": 3789
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48911,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804523,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804523,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804523,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804523,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804523,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804523,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804523,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804523,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804529,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804530,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804531,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804532,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804558,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804558,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804558,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804561,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804561,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804562,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804563,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804564,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804564,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804564,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804564,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804564,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804564,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804564,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804564,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804565,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804565,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804565,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804565,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804565,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804565,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804565,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804565,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804567,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804567,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804567,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131804567,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570131804720,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131804724,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131804684&_gfid=I0_1570131804684&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=17573539 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131804757,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131807138,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131807149,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131807230,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131807205&_gfid=I0_1570131807205&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=10259045 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131807274,
                "type": ""
            }
        ],
        "screenShotFile": "004700d4-00ff-00ca-00e6-001a00930098.png",
        "timestamp": 1570131803833,
        "duration": 3552
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48985,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002e00c9-00ca-00b8-00fe-002400c60068.png",
        "timestamp": 1570131952671,
        "duration": 35
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48985,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955058,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955060,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955060,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955060,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955060,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955060,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955060,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955060,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955060,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955061,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955061,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955061,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955061,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955062,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955235,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955235,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955236,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955237,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955238,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955238,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955238,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955238,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955238,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955239,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955241,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955241,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955241,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955241,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955241,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955241,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955242,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955243,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955243,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955243,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131955243,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131955365,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131955275&_gfid=I0_1570131955275&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=22595362 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131955370,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131957014,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131957031,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570131957144,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131957100&_gfid=I0_1570131957100&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=24111224 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131957199,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131957202,
                "type": ""
            }
        ],
        "screenShotFile": "00fa00ed-009b-00bb-000c-00a9008700e6.png",
        "timestamp": 1570131953611,
        "duration": 3720
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 48985,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958876,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958877,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958877,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958877,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958877,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958877,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958878,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958878,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958878,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958878,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958879,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958879,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958879,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958879,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958879,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958880,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958880,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958880,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958880,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958880,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958880,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958881,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958881,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958881,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958881,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958881,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958882,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958882,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958882,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958882,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958919,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958919,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958920,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958920,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958920,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958921,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958921,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958921,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958922,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958922,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958922,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958923,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958923,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958923,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958923,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958924,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958924,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958925,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958925,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958925,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958926,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958926,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958926,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958926,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958926,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958926,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958926,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958927,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958927,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131958927,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131959026,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131958974&_gfid=I0_1570131958974&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=22906620 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131959057,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131960159,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570131960170,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570131960268,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570131960213&_gfid=I0_1570131960213&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=13583543 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570131960301,
                "type": ""
            }
        ],
        "screenShotFile": "006d006b-0069-009c-00b2-0098009a005e.png",
        "timestamp": 1570131958129,
        "duration": 2268
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 49509,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008d008e-00d5-00be-0061-005c00d2000d.png",
        "timestamp": 1570132359672,
        "duration": 43
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 49509,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362253,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362254,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362254,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362254,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362254,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362255,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362338,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362338,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362342,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362342,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362342,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362343,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362343,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362343,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362343,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362343,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362343,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362343,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362344,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362344,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362344,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362344,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362344,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362344,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362344,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362345,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362345,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362345,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362345,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362345,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362345,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362345,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132362345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570132362424,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570132362439&_gfid=I0_1570132362439&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=40582142 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570132362514,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132365466,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132365483,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570132365596,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570132365630,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570132365550&_gfid=I0_1570132365550&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=11183443 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570132365634,
                "type": ""
            }
        ],
        "screenShotFile": "00e900ce-00e1-000d-000c-005a008a00a8.png",
        "timestamp": 1570132360647,
        "duration": 5125
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 49509,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367246,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367246,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367246,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367247,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367247,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367247,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367247,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367247,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367247,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367248,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367248,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367248,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367248,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367249,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367249,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367249,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367249,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367249,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367250,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367250,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367250,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367250,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367250,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367251,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367252,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367286,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367287,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367287,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367287,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367287,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367288,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367288,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367288,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367289,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367289,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367289,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367294,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132367294,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570132367395,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570132367340&_gfid=I0_1570132367340&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=15306610 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570132367420,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132368537,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570132368553,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570132368660,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570132368616&_gfid=I0_1570132368616&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=87350252 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570132368690,
                "type": ""
            }
        ],
        "screenShotFile": "00470043-0058-0000-00d2-001a00dd0032.png",
        "timestamp": 1570132366525,
        "duration": 2279
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 1843,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006d000d-00f3-0014-00c1-009e000b0068.png",
        "timestamp": 1570133076930,
        "duration": 31
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 1843,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079653,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079654,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079654,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079654,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079654,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079654,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079655,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079655,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079655,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079655,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079655,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079655,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079655,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079655,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079656,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079656,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079656,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079656,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079656,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079658,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079658,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079658,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079659,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079659,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079659,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079659,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079660,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079660,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079660,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079660,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079764,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079764,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079764,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079764,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079764,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079765,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079765,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079765,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079766,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079766,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079766,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079766,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079767,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079767,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079767,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079768,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079768,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079768,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079769,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079769,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079771,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079772,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079773,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079774,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079775,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079775,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079775,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079776,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079776,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133079776,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133079930,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133079843&_gfid=I0_1570133079843&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=30255660 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133079985,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133082486,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133082503,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570133082591,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133082592,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133082545&_gfid=I0_1570133082545&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=27678879 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133082625,
                "type": ""
            }
        ],
        "screenShotFile": "00c00014-00ed-00b1-00e2-00eb00b00079.png",
        "timestamp": 1570133078194,
        "duration": 4575
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 1843,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084173,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084173,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084173,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084174,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084174,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084174,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084174,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084176,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084177,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084177,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084177,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084177,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084177,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084178,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084178,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084178,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084178,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084179,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084179,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084179,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084179,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084180,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084180,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084180,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084180,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084181,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084181,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084181,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084181,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084181,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084329,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084329,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084329,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084334,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084335,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084335,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084335,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084335,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133084335,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133084529,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133084415&_gfid=I0_1570133084415&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=37748818 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133084550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133085713,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133085726,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133085810,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133085770&_gfid=I0_1570133085770&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=22761543 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133085846,
                "type": ""
            }
        ],
        "screenShotFile": "00540017-002a-00f4-0066-0070006800a8.png",
        "timestamp": 1570133083537,
        "duration": 2433
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 1879,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d000e7-0002-0054-0022-0044002700ff.png",
        "timestamp": 1570133114330,
        "duration": 28
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 1879,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116867,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116868,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116868,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116868,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116869,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116869,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116869,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116869,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116869,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116870,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116870,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116870,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116870,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116871,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116871,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116871,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116871,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116872,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116872,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116872,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116872,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116873,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116873,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116873,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116874,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116874,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116874,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116874,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116874,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116875,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116966,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116967,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116967,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116968,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116969,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116970,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116970,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116970,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116971,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116971,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116971,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116972,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116972,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116972,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116972,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116973,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116973,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116973,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116974,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116974,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116974,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116974,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116975,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116975,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133116975,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133117079,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133117048&_gfid=I0_1570133117048&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=26682343 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133117153,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133118944,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133118961,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570133119068,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133119075,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133119028&_gfid=I0_1570133119028&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=31260070 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133119135,
                "type": ""
            }
        ],
        "screenShotFile": "006f00f1-003f-003e-00a0-00a000be0008.png",
        "timestamp": 1570133115140,
        "duration": 4097
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 1879,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120626,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120626,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120626,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120626,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120627,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120627,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120627,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120627,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120627,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120627,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120628,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120628,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120628,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120628,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120628,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120629,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120630,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120630,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120630,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120630,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120630,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120630,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120631,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120631,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120631,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120631,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120664,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120665,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120665,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120665,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120666,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120666,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120666,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120667,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120667,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120667,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120667,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120668,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120668,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120669,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120670,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120673,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120673,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120673,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120673,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120673,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120674,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120674,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120674,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120674,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120675,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120675,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120675,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120675,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120675,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133120675,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133120792,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133120745&_gfid=I0_1570133120745&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=33911230 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133120846,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133121947,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133121957,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133122034,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133121999&_gfid=I0_1570133121999&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=71976407 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133122083,
                "type": ""
            }
        ],
        "screenShotFile": "00f70043-007a-00df-005e-00ab000f0074.png",
        "timestamp": 1570133119998,
        "duration": 2195
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2386,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00520089-0033-0057-00da-00ac00df0004.png",
        "timestamp": 1570133825690,
        "duration": 34
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2386,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828276,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828277,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828278,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828279,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828279,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828279,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828279,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828279,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828279,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828281,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828379,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828379,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828380,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828380,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828380,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828380,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828381,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828381,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828381,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828382,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828382,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828383,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828383,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828383,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828384,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828384,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828384,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828384,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828384,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828385,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828385,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828385,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828385,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828386,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828386,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828386,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828387,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828387,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828387,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133828387,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570133828503,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133828563,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133828517&_gfid=I0_1570133828517&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=21675957 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133828578,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133830513,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133830530,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570133830635,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133830688,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133830607&_gfid=I0_1570133830607&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=16460735 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133830694,
                "type": ""
            }
        ],
        "screenShotFile": "0036006e-002b-0085-0038-00e000ad0065.png",
        "timestamp": 1570133826609,
        "duration": 4221
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2386,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832294,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832294,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832294,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832294,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832295,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832296,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832331,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832334,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832334,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832334,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832335,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832335,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832338,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832338,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832338,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133832338,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133832434,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133832383&_gfid=I0_1570133832383&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=25058529 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133832464,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133833571,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133833585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133833722,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133833644&_gfid=I0_1570133833644&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=26540529 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133833729,
                "type": ""
            }
        ],
        "screenShotFile": "0087005f-006f-0055-0033-00c40093005f.png",
        "timestamp": 1570133831560,
        "duration": 2349
    },
    {
        "description": "Verify proper results o from api search|Search for cookie monster cupckakes using API",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2420,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00340087-00ce-0091-00fc-0030009200f3.png",
        "timestamp": 1570133881382,
        "duration": 27
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2420,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883548,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883549,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883549,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883549,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883549,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883549,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883550,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883551,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883551,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883551,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883551,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883552,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883552,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883552,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883552,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883552,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883553,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883553,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883553,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883730,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883730,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883731,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883731,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883731,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883731,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883732,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883732,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883732,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883732,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883733,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883733,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883733,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883733,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883734,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883734,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883734,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883734,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883735,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883735,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883735,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883735,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883735,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883736,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883736,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883736,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883736,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883737,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883737,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133883737,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133883810,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133883769&_gfid=I0_1570133883769&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=12349687 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133883937,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133885512,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133885530,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://platform.stumbleupon.com/1/widgets.js 302 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://www.stumbleupon.com') does not match the recipient window's origin ('https://www.food2fork.com').",
                "timestamp": 1570133885637,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133885668,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133885595&_gfid=I0_1570133885595&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=11346226 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133885674,
                "type": ""
            }
        ],
        "screenShotFile": "006b0069-0003-0017-0025-0059008400a3.png",
        "timestamp": 1570133882229,
        "duration": 3576
    },
    {
        "description": "Verify proper results on result page|Search for cookie monster cupckakes",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2420,
        "browser": {
            "name": "chrome",
            "version": "77.0.3865.90"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 259 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887286,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 304 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887286,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 349 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887286,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 394 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887286,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 439 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887287,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 484 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887287,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 529 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887287,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 587 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887287,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 632 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887287,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 677 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887288,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 722 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887288,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 767 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887288,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 812 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887288,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 857 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887289,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 915 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887289,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 960 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887289,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1005 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887289,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1050 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887289,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1095 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1140 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1185 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1243 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1288 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1333 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1378 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1423 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887291,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1468 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1513 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1571 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/ 1616 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Jalapeno2BPopper2BGrilled2BCheese2BSandwich2B12B500fd186186.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887328,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/icedcoffee5766.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887328,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/CrashHotPotatoes5736.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887329,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/avocadomacandcheesedc99.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887329,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BGrilled2BCheese2BSandwich2B5002B4983f2702fe4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/333323997_04bd8d6c53da11.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/best_pizza_dough_recipe1b20.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887330,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/magic_sauce_recipeece9.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/5551711173_dc42f7fc4b_zbd8a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/ParmesanRoastedPotatoes11985a.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Bacon2BWrapped2BJalapeno2BPopper2BStuffed2BChicken2B5002B5909939b0e65.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/BlackMagicCakeSlice1of18c68.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/HotSpinachandArtichokeDip5007579cdf5.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887332,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/smashedchickpeaavocadosaladsandwich29c5b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4307514771_c089bbd71017f42.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/387114468_aafd1be3404a2f.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/MacandCheese1122b.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887333,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Guinness2BChocolate2BCheesecake2B12B5002af4b6b4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887335,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/banana_bread300x2000a14c8c5.jpeg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/9956913c10.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887336,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/GuacamoleGrilledCheese6019.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/bananapeanutbuttericecream5c16d.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/shepherdspie300x2003d240a98.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/Buffalo2BChicken2BChowder2B5002B0075c131caa8.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/720553ee26.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/19321150c4.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887338,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/124030cedd.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887338,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/254186ea50.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887338,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/healthy_cookies4ee3.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887338,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/4515542dbb.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133887338,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/ - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2F' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133887460,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2F&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133887401&_gfid=I0_1570133887401&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=39518786 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133887496,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes 259 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133888588,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.food2fork.com/F2F/static/js/jquery.masonry.min.js 9 Mixed Content: The page at 'https://www.food2fork.com/top?q=cookie+monster+cupcakes' was loaded over HTTPS, but requested an insecure image 'http://static.food2fork.com/604133_mediumd392.jpg'. This content should also be served over HTTPS.",
                "timestamp": 1570133888605,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://www.food2fork.com/top?q=cookie+monster+cupcakes - Refused to display 'https://www.stumbleupon.com/badge/embed/1/?url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes' in a frame because it set 'X-Frame-Options' to 'sameorigin'.",
                "timestamp": 1570133888709,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/se/0/_/+1/fastbutton?usegapi=1&size=medium&origin=https%3A%2F%2Fwww.food2fork.com&url=https%3A%2F%2Fwww.food2fork.com%2Ftop%3Fq%3Dcookie%2Bmonster%2Bcupcakes&gsrc=3p&ic=1&jsh=m%3B%2F_%2Fscs%2Fapps-static%2F_%2Fjs%2Fk%3Doz.gapi.en_US.ysvV9EtEi0w.O%2Fam%3DwQE%2Fd%3D1%2Frs%3DAGLTcCMcYZL5zQsWyujyfqZUWUukFuVxmQ%2Fm%3D__features__#_methods=onPlusOne%2C_ready%2C_close%2C_open%2C_resizeMe%2C_renderstart%2Concircled%2Cdrefresh%2Cerefresh%2Conload&id=I0_1570133888658&_gfid=I0_1570133888658&parent=https%3A%2F%2Fwww.food2fork.com&pfname=&rpctoken=13017681 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1570133888737,
                "type": ""
            }
        ],
        "screenShotFile": "00eb0043-0049-0003-003b-000f0009005a.png",
        "timestamp": 1570133886599,
        "duration": 2315
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
