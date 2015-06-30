
(function () {
  "use strict";
  angular
    .module('geneview', [])
    .value("geneview.version", "0.2.5")
    .provider("geneview.config", function() {

      this.setServer = function(newServer) {
        this.server = newServer;
      };

      this.setGeneClickAction = function(actionArg) {
        this.geneClickAction = actionArg;
      };

      this.setPhenotypeClickAction = function(actionArg) {
        this.phenotypeClickAction = actionArg;
      };

      this.$get = function() {
        return this;
      };

    });
}());
