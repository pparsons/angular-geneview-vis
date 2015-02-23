

(function(){

	var angularGeneviewVis = angular.module('angularGeneviewVis', []);

    angularGeneviewVis.factory('geneLoader', ['$http', '$rootScope', function($http, $rootScope) {

        //hard code
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

    angularGeneviewVis.directive('geneview', ['geneLoader', function(geneLoader) {

        /**
         * Manage gene data response
         *  - Calculate track to display display location
         * @constructor
         */
        var GeneManager = (function() {
            var gm = function() {
                var self = this;

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
                    for (var i = 0; i < geneDB.length; i++ ) {
                        for(var j = 0; j < geneDB[i].length; j++) {
                            var gene = geneDB[i][j];
                            if (gene.stop >= start && gene.start <= stop) {
                                trackNo ++;
                                break;
                            }else {
                                return trackNo;
                            }
                        }
                    }
                    return trackNo;
                }

                // Register a gene location
                // Return its available track to display
                self.register = function(gene) {
                    var trackNo = findFreeTrack(gene.start, gene.stop);

                    if(typeof geneDB[trackNo] === 'undefined') {
                        geneDB[trackNo] = [];
                    }
                    geneDB[trackNo].push(gene);

                    return trackNo;
                };

                // Process a data set
                // Return sanitized, wrapped data
                self.process = function(data, handler) {
                    var sanData = [];

                    function isBadVar(res) {
                        return ((res == null) || (typeof res === 'undefined') || (res == ''));
                    }

                    for(var i = data.length -1; i >= 0; i--) {
                        if(isBadVar(data[i].start) || isBadVar(data[i].end)) {
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
                        nModel.track = self.register({
                            start:+data[i].start,
                            stop:+data[i].end
                        });
                        sanData.push(nModel);
                    }

                    return sanData;
                }
            }

            return gm;
        }());

        function link(scope, element, attr) {

            /**
             * Directive variables, drawing functions
             *
             */
            var appID = 'angular-geneview-app';
            var target, xscale, statusText;

            var SD_1COL_HEIGHT = 20,
                STATUS_TEXT_YSHIFT = 15,
                GENES_YSHIFT = 34;

            function drawScale() {

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

            target = d3.select(element[0]).append("div")
                .classed(appID, true)
                .style('width', scope.width+'px')
                .style('height', scope.height+'px')
                .append('svg')
                .attr('height', scope.height);

            target.attr({width: scope.width});
            drawStatusBar(scope.height, scope.width);
            statusText.text('Requesting: ' + scope.chr +' : ' + scope.start + " : " + scope.stop);
            drawBand("q14.11", "gpos66");


            geneLoader.getGenes(scope.chr, scope.start, scope.stop, function(data){

                if (typeof data.err ==='undefined') {
                    statusText.text('Done');
                    function isBadVar(res) {
                        return ((res == null) || (typeof res === 'undefined') || (res == ''));
                    }


                    var geneDataSet = new GeneManager().process(data);
                    console.log(geneDataSet);
                    var maxBP = d3.max(geneDataSet, function(d){ return +d.gene.end;});
                    var minBP = d3.min(geneDataSet, function(d){return +d.gene.start});

                    var SENSITIVITY_PADDING = (maxBP - minBP) * 0.025;
                    xscale = d3.scale.linear()
                        .range([0, +scope.width])
                        .domain([minBP - SENSITIVITY_PADDING, maxBP + SENSITIVITY_PADDING]);

                    drawScale();

                    var genes = target.append('g')
                        .attr('transform', 'translate(0,' + GENES_YSHIFT +")");

                    var gene = genes.selectAll('g')
                        .data(geneDataSet).enter().append('g');

                    gene.append('rect')
                        .classed('gene', true)
                        .attr('x', function(d) {
                            return d3.min([xscale(+d.gene.start), xscale(+d.gene.end)]);
                        })
                        .attr('width', function(d) {
                            var a = xscale(+d.gene.start) - xscale(+d.gene.end);
                            var b = xscale(+d.gene.end) - xscale(+d.gene.start);

                            var w = d3.max([a,b]);
                            return w < 1 ? 2: w;
                        })
                        .attr('height', SD_1COL_HEIGHT / 2)
                        .attr('y', function(d) {
                            var t = (+d.track +1) * (SD_1COL_HEIGHT);
                            console.log(t);
                            return (+d.track +1) * (SD_1COL_HEIGHT);
                        });


                    gene.append('title').text(function(d){return d.gene.symbol});

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
                selectedBands: '=',
                stop: '@',
                height: '@',
                width:'@'
            }

        };
    }]);
}());