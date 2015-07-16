
(function () {
  "use strict";
  angular
    .module('geneview')
    .directive('geneviewUI', [function(){

      function link(scope, ele, attr) {

        scope.articleStats = (scope.articleStats === true) ? true : (scope.articleStats === 'true');

        scope.selStart = 1;
        scope.selStop = 1;

        scope.chrSettings = {
          segment: scope.chr,
          resolution: "550",
          showAxis: true,
          relativeSize: false,
          showDetails: true,
          articleStats: false
        };

        var selinit = false;

        scope.name = scope.chr + "id";

        scope.$on('bandclick', function(e, d) {
          selinit = true;
          scope.selStart = +d.bp_start;
          scope.selStop = +d.bp_stop;
        });

        scope.$on('selectorchange', function(e, d) {
          scope.selStart = Math.round(d[0]);
          scope.selStop = Math.round(d[1]);
        });

        scope.$on('selectordelete', function(e,d){
          scope.selStart = 1;
          scope.selStop = 1;
        });

        scope.updateSelector = function() {

          var d = {
            start: scope.selStart,
            stop: scope.selStop
          };

          scope.$broadcast('geneview:updateselector', d);
        };

        scope.updateResolution = function (d) {
          scope.chrSettings.resolution = d;
          scope.render();
        };

        scope.render = function() {
          console.log('re', scope.chrSettings)
          scope.$broadcast('geneview:render', scope.chrSettings);
        }
      }
      return {
        link: link,
        restrict: 'E',
        scope: {
          chr: '@',
          articleStats: '@'
        },

        templateUrl: "src/geneviewUITemplate.html"
      };

    }]);
}());
