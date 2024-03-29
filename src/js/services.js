/*global angular, d3*/
(function () {
  "use strict";
  angular
    .module('geneview')
    //Load genes based on chromosome start and end location
    .factory('geneLoader', ['$http', "geneview", function ($http, config) {

      return {
        getGenes: function (chr, start, stop, callID, cb) {
          var params = {
            chr: chr,
            start: start,
            stop: stop
          };

          return $http({
            method: 'GET',
            url: '//' + config.server + '/getgenes.php',
            params: params,
            responseType: 'json',
            cache: true
          })
            .success(function (data, status, headers, config) {
              cb(data, callID.id);
            })

            .error(function (data, status, headers, config) {
              //handle error here
              cb({err: "Failed to load genes. Connection failed."});
            });
        }
      };
    }])

    //Mange gene results; calculate their track to draw
    .factory('geneManager', [function () {
      /**
       * 2D array to hold current genes
       * genDB[i] = ith track
       * geneDB[i][j] = jth gene on track i
       * @type {Array}
       */
      var geneDB = [];

      //Get the next available track to display the gene without overlapping others
      function findFreeTrack(start, stop) {
        var trackNo = 0;
        var collide;
        for (var i = 0; i < geneDB.length; i++) {
          collide = false;
          for (var j = 0; j < geneDB[i].length; j++) {
            var gene = geneDB[i][j];
            if (gene.stop >= start && gene.start <= stop) {
              trackNo++;
              collide = true;
              break;
            }
          }
          if(!collide) {
            return trackNo;
          }
        }
        return trackNo;
      }

      // Register a gene location
      // Return its available track to display
      function register(gene) {
        var trackNo = findFreeTrack(gene.start, gene.stop);

        if (typeof geneDB[trackNo] === 'undefined') {
          geneDB[trackNo] = [];
        }
        geneDB[trackNo].push(gene);

        return trackNo;
      }

      // Process a data set
      // Return sanitized, wrapped data
      function process(data, boundFrom, boundTo) {

        //reset cache from previous calls
        if(geneDB.length !== 0) { geneDB.length = 0; }

        var sanData = [];

        function isBadVar(res) {
          //console.log(boundTo, boundFrom);
          return ((res === null) || (typeof res === 'undefined') || (res === ''));
        }

        for (var i = data.length - 1; i >= 0; i--) {
          var start = data[i].start;
          var end = data[i].end;

          //remove bad data, and data slightly out of entire search range
          if (isBadVar(start) || isBadVar(end) || start >= boundTo || end <= boundFrom) {
            //data.splice(i, 1);
            continue;
          }

          if (parseInt(data[i].end) < parseInt(data[i].start)) {
            var ts = data[i].start;
            data[i].start = data[i].end;
            data[i].end = ts;
          }

          var nModel = {};
          nModel.gene = data[i];
          nModel.track = register({
            start: +data[i].start,
            stop: +data[i].end
          });
          sanData.push(nModel);
        }

        return sanData;
      }

      return {
        process: process
      };
    }])

    //return array of promisses containing phenotype info
    .factory('phenotypeLoader', ['$q', '$http', "geneview", function ($q, $http, config) {
      var http = {
        omim: function (gene) {
          return $http({
            method: 'get',
            url: '//' + config.server + '/gen2phen.php',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            params: {'gene': gene}
          });
        }
      };

      function loadPhenotypes(data) {

        var promises = [];

        //loop through each result
        for (var i = 0; i < data.length; i++) {
          (function () {
            var defer = $q.defer();

            // get associated phenotypes for each
            var promise = http.omim(data[i].gene.symbol)
              .then(function (res) {

                //resolve bad data to null
                var data = null;

                try {
                  //if there is a result
                  if (res.data.omim.searchResponse.endIndex !== -1) {
                    var gene = res.data.omim.searchResponse.entryList[0].entry;
                    //if there is a related phenotype(s)

                    if (typeof gene.geneMap !== 'undefined' && typeof gene.geneMap.phenotypeMapList !== 'undefined') {
                      var symbol = gene.matches;
                      var phenotypes = gene.geneMap.phenotypeMapList;
                      var geneStart = gene.geneMap.chromosomeLocationStart;
                      //scope.g2pO.push({'symbol': symbol, 'phenotypes': phenotypes, 'start':geneStart});
                      data = {'symbol': symbol, 'phenotypes': phenotypes, 'start': geneStart};
                    }

                  }
                }
                catch (e) {
                  defer.resolve(null);
                }

                defer.resolve(data);
                return defer.promise;
              });
            promises.push(promise);

          })(i);
        }//end for
        return $q.all(promises);

      }

      return {
        load: loadPhenotypes
      };
    }])

    //Load article statistics for an array of genes
    .factory('articleStatLoader', ['$http', 'geneview', function ($http, geneviewconfig) {

      return {
        getArticleCount: function (genes, cb) {
          return $http.get('//' + geneviewconfig.server + '/genearticlestats.php?genes=' + genes)
            .success(function (d) {
              cb(d);
            });
        }

      };
    }]);
})();
