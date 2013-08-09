var async   = require('async'),
    Q       = require("q"),
    request = require("request");

    api = function (config, url, method, data) {
      var deferred = Q.defer(), auth = config.auth;
      request({
        method: method,
        uri: ["https://", auth.username, ":", auth.accessKey, "@saucelabs.com/rest", url].join(""),
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
      }, function (error, response, body) {
        deferred.resolve(response.body);
      });
      return deferred.promise;
    },

    waitUntilResultsAreAvailable = function(config, js_script, timeout, start, callback) {
      var now     = new Date(),
          browser = config.browser,
          start   = start || now;

      if (now - start > timeout) {
        callback( new Error("Timeout: Element not there") );
      } else {
        browser.eval(js_script, function(err, jsValue) {
          if (jsValue !== null) callback(null, {resultScript: jsValue});
          else waitUntilResultsAreAvailable(config, js_script, timeout, start, callback);
        });
      }
    };

module.exports = function(config, script_for_sauce_data_schemas, callback) {
  var browser = config.browser,
      auth    = config.auth;

  async.waterfall([

    function(callback) {
      waitUntilResultsAreAvailable(config, script_for_sauce_data_schemas, 15000, null, callback);
    },

    function(obj, callback) {
      var data = obj.resultScript = obj.resultScript || {},
          url  = ["/v1/", auth.username, "/jobs/", browser.sessionID].join("");
      data.passed = data.passed || data.failedCount === 0;

      api(config, url, "PUT", data).then( function(body) {
        obj.body = body;
        console.warn("Check out test results at http://saucelabs.com/jobs/" + browser.sessionID + "\n");
        if (obj.resultScript.passed) {
          console.error( browser.sessionID + " FAILED" );
        }
        callback(null, obj);
      });
    }
  ], function(err, result) {
    callback(err, result);
  });
};