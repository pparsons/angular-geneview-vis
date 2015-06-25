
(function () {
  "use strict";
  angular
    .module('geneview', [])
    .value("geneview.version", "0.2.3")
    .provider("geneview.config", function() {

      this.setServer = function(newServer) {
        this.server = newServer;
      };

      this.setGeneAction = function(actionArg) {
        this.geneAction = actionArg;
      };

      this.$get = function() {
        return this;
      };

    });
}());
