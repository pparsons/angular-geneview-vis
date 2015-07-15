
(function () {
  "use strict";
  angular
    .module('geneview', [])
    .provider("geneview", function() {
      this.version = "0.2.5";

      this.setServer = function(newServer) {
        this.server = newServer;
      };

      this.setGeneClickAction = function(actionArg) {
        this.geneClickAction = actionArg;
      };

      this.setGeneContextMenu = function(actionArg) {
        this.geneContextMenu = actionArg;
      };

      this.setPhenotypeClickAction = function(actionArg) {
        this.phenotypeClickAction = actionArg;
      };

      this.setPhenotypeContextMenu = function(actionArg) {
        this.phenotypeContextMenu = actionArg;
      };

      this.$get = function() {
        return this;
      };

    });
}());
