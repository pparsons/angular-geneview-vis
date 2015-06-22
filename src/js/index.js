/*global angular, d3*/

(function () {
  "use strict";
  angular
    .module('geneview', [])
    .value("geneview.version", "0.2.3")
    .provider("geneview.config", function() {

      this.setServer = function(newServer) {
        this.server = newServer;
      };

      this.$get = function() {
        return this;
      };

    });
}());
