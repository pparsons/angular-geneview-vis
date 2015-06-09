
angularGeneviewVis.factory('geneLoader', ['$http', '$rootScope', function($http, $rootScope) {

    //this way will work inside the cytoApp
    var serverScriptAddr = $rootScope.server + '/soscip/api/getgenes.php?';
    return {
        getGenes : function (chr, start, stop, cb) {
            //var url = serverScriptAddr + 'chr=' + chr + '&start=' + start + '&stop=' + stop;

            var params = {
                chr: chr,
                start: start,
                stop: stop
            }

            return $http({
                method  :   'GET',
                url     :   '//' + $rootScope.server + '/soscip/api/getgenes.php',
                params    :   params,
                responseType : 'json',
                cache: true
            })
                .success(function(data, status, headers, config) {
                    "use strict";
                    cb(data);
                })

                .error(function(data, status, headers, config){
                    //handle error here
                    cb({err:"Failed to load genes. Connection failed."});
                });
        }
    };
}])

angularGeneviewVis.factory('gen2Phen', ['$http', '$rootScope', function($http, $rootScope) {
    return {
        omim: function(gene) {
            return $http({
                method: 'get',
                url: '//' + $rootScope.server + '/soscip/api/gen2phen.php',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                params: {'gene': gene}
            });
        },
        lit: function(gene) {
            var searchParams = {
                core: 'medline-citations',
                handler: 'select',
                searchFields: JSON.stringify(['genes']), //stringify the array so it is sent properly
                query: gene,
                years: {min:1950, max:2015},
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
    }
}]);

angularGeneviewVis.factory('articleStatLoader', ['$http', '$rootScope', function($http, $rootScope) {

    return {
        getArticleCount: function(genes, cb) {
            return $http.get('//'+$rootScope.server + '/soscip/api/genearticlestats.php?genes=' + genes)
                .success(function(d){
                    cb(d);
                });
        }

    };
}]);
