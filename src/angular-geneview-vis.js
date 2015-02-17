

(function(){

	var angularGeneviewVis = angular.module('angularGeneviewVis', ["angularChromosomeVis"]);

    angularGeneviewVis.controller('MainCtrl', ['$scope', function (sc) {

	}]);

    angularGeneviewVis.factory('geneLoader', ['$http', '$rootScope', function($http, $rootScope) {

        //hard code for dev
        $rootScope.server = 'http://localhost:9090';

        var serverScriptAddr = $rootScope.server + '/api/getgenes.php?';
        return {
            getGenes : function (chr, start, stop, cb) {
                var url = serverScriptAddr + 'chr=' + chr + '&start=' + start + '&stop=' + stop;
                $http.get(url).success(function(data, status, headers, config){
                    cb(data);

                }).error(function(data, status, headers, config){
                    //handle error here
                    cb({err:"Failed to load genes. Connection failed."});
                });
            }
        };
    }]);

    angularGeneviewVis.directive('geneview', ['geneLoader', function(geneLoader){

        function link(scope, element, attr) {
            var appID = '#angular-geneview-app';
            var target, xscale, statusText;

            var SD_1COL_HEIGHT = 20,
                STATUS_TEXT_YSHIFT = 15,
                GENES_YSHIFT = SD_1COL_HEIGHT + 2;


            function drawScale(){

                var zmAxis = d3.svg.axis()
                    .tickFormat(d3.format('s'))
                    .orient('top')
                    .scale(xscale);

                var axis = target.append('g')
                    .classed('geneview-scale', true)
                    .attr('transform', 'translate(0,' + SD_1COL_HEIGHT + ")")
                    .call(zmAxis);

                var ticks = axis.selectAll('.tick line')
                    .attr('y2', scope.height - SD_1COL_HEIGHT);

            }

            function drawStatusBar (height, width) {
                var statusBar = target.append('g')
                    .attr('transform', 'translate(0,' + (height - SD_1COL_HEIGHT) + ")");

                statusBar.append('rect')
                    .classed('geneview-statusbar', true)
                    .attr('width', width)
                    .attr('height', SD_1COL_HEIGHT);

                statusText = statusBar.append('text')
                    .attr('transform', 'translate(5,' + STATUS_TEXT_YSHIFT + ")");

            }

            function drawBand(bandID, type) {
                var chrBand = target.append('g')
                    .attr('transform', 'translate(0,' + SD_1COL_HEIGHT + ")");

                chrBand.append('rect')
                    .attr('height', SD_1COL_HEIGHT)
                    .attr('width', scope.width)
                    .classed(type, true);

                chrBand.append('text')
                    .classed(type + '-text', true)
                    .attr('transform', 'translate(' + scope.width / 2 +',' + ((SD_1COL_HEIGHT / 2) + 2) + ")")
                    .text(bandID);
            }

            scope.link = function () {
                target = d3.select(appID)
                    .style('width', scope.width+'px')
                    .style('height', scope.height+'px')
                    .append('svg')
                    .attr('height', scope.height);

                target.attr({width: scope.width});
                drawStatusBar(scope.height, scope.width);
                //hardcode for dev
                drawBand("q14.11", "gpos66");
            }();

            statusText.text('Requesting: ' + scope.chr +' : ' + scope.start + " : " + scope.stop);
            geneLoader.getGenes(scope.chr, scope.start, scope.stop, function(data){
                statusText.text('Done');
                if (typeof data.err ==='undefined') {

                    function isBadVar(res) {
                        return ((res == null) || (typeof res === 'undefined') || (res == ''));
                    }

                    console.log(data);

                    for(var i = data.length -1; i >= 0; i--) {
                        if(isBadVar(data[i].start) || isBadVar(data[i].end)) {
                            console.log(data[i].symbol + " removed");
                            data.splice(i, 1);
                        }

                    }

                    for(var i = data.length -1; i >= 0; i--) {

                        if (parseInt(data[i].end) < parseInt(data[i].start)) {
                            var ts = data[i].start;
                            data[i].start = data[i].end;
                            data[i].end = ts;
                        }
                    }


                    console.log(data);

                    var maxBP = d3.max(data, function(d){ return +d.end;});
                    var minBP = d3.min(data, function(d){return +d.start});

                    var SENSITIVITY_PADDING = (maxBP - minBP) * 0.025;
                    xscale = d3.scale.linear()
                        .range([0, +scope.width])
                        .domain([minBP - SENSITIVITY_PADDING, maxBP + SENSITIVITY_PADDING]);

                    drawScale();

                    console.log(minBP + ' ' + maxBP);

                    var genes = target.append('g')
                        .attr('transform', 'translate(0,' + SD_1COL_HEIGHT * 3+ ")");

                    var gene = genes.selectAll('g')
                        .data(data).enter().append('g');


                    gene.append('rect')
                        .classed('gene', true)
                        .attr('x', function(d){
                            return d3.min([xscale(+d.start), xscale(+d.end)]);
                        })
                        .attr('width', function(d){
                            var a = xscale(+d.start) - xscale(+d.end);
                            var b = xscale(+d.end) - xscale(+d.start);

                            var w = d3.max([a, b]);

                            if (w < 1) w = 1;
                            return w;
                        })
                        .attr('height', SD_1COL_HEIGHT);

                    gene.append('title').text(function(d){return d.symbol});


                } else {
                    statusText.text(data.err);
                }

            });
        }

        return {
            link: link,
            restrict: 'AE',
            scope: {
                chr : '@',
                start: '@',
                stop: '@',
                height: '@',
                width:'@'
            },
            templateUrl: "src/geneview-template.html"

        };
    }]);


}());