/*global angular, d3*/
(function () {
    "use strict";
    angular
        .module('angularGeneviewVis')
        .factory('geneLoader', ['$http', '$rootScope', function ($http, $rootScope) {
            //this way will work inside the cytoApp
            var serverScriptAddr = $rootScope.server + '/soscip/api/getgenes.php?';
            return {
                getGenes : function (chr, start, stop, cb) {
                    //var url = serverScriptAddr + 'chr=' + chr + '&start=' + start + '&stop=' + stop;

                    var params = {
                        chr: chr,
                        start: start,
                        stop: stop
                    };

                    return $http({
                        method  :   'GET',
                        url     :   '//' + $rootScope.server + '/soscip/api/getgenes.php',
                        params    :   params,
                        responseType : 'json',
                        cache: true
                    })
                        .success(function (data, status, headers, config) {
                            cb(data);
                        })

                        .error(function (data, status, headers, config) {
                            //handle error here
                            cb({err: "Failed to load genes. Connection failed."});
                        });
                }
            };
        }])
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
                for (var i = 0; i < geneDB.length; i++) {
                    for (var j = 0; j < geneDB[i].length; j++) {
                        var gene = geneDB[i][j];
                        if (gene.stop >= start && gene.start <= stop) {
                            trackNo++;
                            break;
                        }
                    }
                }
                return trackNo;
            }

            // Register a gene location
            // Return its available track to display
            function register (gene) {
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
        .factory('gen2Phen', ['$http', '$rootScope', function ($http, $rootScope) {
            return {
                omim: function (gene) {
                    return $http({
                        method: 'get',
                        url: '//' + $rootScope.server + '/soscip/api/gen2phen.php',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        params: {'gene': gene}
                    });
                },
                lit: function (gene) {
                    var searchParams = {
                        core: 'medline-citations',
                        handler: 'select',
                        searchFields: JSON.stringify(['genes']), //stringify the array so it is sent properly
                        query: gene,
                        years: {min: 1950, max: 2015},
                        start: 0,
                        rows: 100,
                        retFields: 'phenotypes'
                    };
                    return $http({
                        method: 'get',
                        url: '//' + $rootScope.server + '/soscip/api/search.php',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        params: searchParams
                    });
                }
            };
        }])
        .factory('articleStatLoader', ['$http', '$rootScope', function($http, $rootScope) {

            return {
                getArticleCount: function(genes, cb) {
                    return $http.get('//'+$rootScope.server + '/soscip/api/genearticlestats.php?genes=' + genes)
                        .success(function(d){
                            cb(d);
                        });
                }

            };
        }]);
})();
