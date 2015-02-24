

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
        var GeneManager = function() {

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
            self.process = function(data) {
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
        };

        function link(scope, element, attr, chrAPI) {

            var target, xscale, axis, statusBar, statusText, geneTip;
            var SD_1COL_HEIGHT = 20,
                GENES_YSHIFT = 34;

            var init = function() {
                var selectionModel = chrAPI.getActiveSelection();
                var chrConfigs = chrAPI.getAttrs();

                scope.display = true;
                scope.activeSelection = selectionModel.getSelectedBands();
                scope.boundFrom = selectionModel.selStart;
                scope.boundTo = selectionModel.selEnd;
                scope.width = chrConfigs.width;
                scope.chr = chrConfigs.chr;
                scope.height = 120;
                scope.showStatus = (scope.showStatus === true) ? true :(scope.showStatus === 'true');

                var divParent = d3.select(element[0]).select('.angular-geneview-vis')
                    .style('height', scope.height)
                    .style('width', chrConfigs.width + 'px');

                divParent.select('svg').remove();

                target = divParent.append('svg')
                    .attr('height', scope.height)
                    .attr('width', scope.width);

                geneTip = d3.tip()
                    .attr('class', 'd3-tip')
                    .direction('n')
                    .offset([-5,0])
                    .html(function(d) {
                        var tiptemp = '<span>' + d.gene.symbol + "</span> ";
                        return tiptemp;
                    }
                );

                target.call(geneTip);
            };

            function drawBands(bands) {
                console.log(bands);
                var band = target.append('g')
                    .classed('geneview-bands', true)
                    .attr('transform', 'translate(0,' + SD_1COL_HEIGHT + ")")
                    .selectAll('g')
                    .data(bands).enter()
                    .append('g');


                band.append('rect')
                    .attr('class', function(d) {
                        return d.type.replace(":", " ");
                    })
                    .attr('x', function(d){
                        return xscale(+d.start);
                    })
                    .attr('height', SD_1COL_HEIGHT)
                    .attr('width', function(d) {
                        return xscale(d.end) - xscale(d.start);
                    });

                band.append('text')
                    .attr('class', function(d) {
                        return d.type.substring(5) + '-text';
                    })
                    .attr('x', function(d) {

                        var sX = d.start < scope.boundFrom ? scope.boundFrom : d.start;
                        return xscale(sX) + 2;
                    })
                    .attr('y', 13)
                    .text(function(d){return d.id});


            }

            function updateStatusText(text) {
                if (scope.showStatus)
                {
                    statusText.text(text);
                }
            }

            function drawStatusBar() {

                if (scope.showStatus) {
                    statusBar = target.append('g')
                        .attr('transform', 'translate(0,' + (scope.height - SD_1COL_HEIGHT) + ")");

                    statusBar.append('rect')
                        .classed('geneview-statusbar', true)
                        .attr('width', scope.width)
                        .attr('height', SD_1COL_HEIGHT);

                    statusText = statusBar.append('text')
                        .attr('transform', 'translate(5,' + 14 + ")");
                }

            }

            function drawScale() {

                var zmAxis = d3.svg.axis()
                    .tickFormat(d3.format('s'))
                    .orient('top')
                    .scale(xscale);

                axis = target.append('g')
                    .classed('geneview-scale', true)
                    .attr('transform', 'translate(0,' + SD_1COL_HEIGHT + ")")
                    .call(zmAxis);

            }

            function drawGenes(geneDataSet) {
                var gene = target.append('g')
                    .attr('transform', 'translate(0,' + GENES_YSHIFT +")")
                    .selectAll('g')
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
                        return (+d.track +1) * (SD_1COL_HEIGHT);
                    });

                gene.append('title').text(function(d){return d.gene.symbol});

                gene.on('mouseover', geneTip.show)
                    .on('mouseout', geneTip.hide);
            }

            function adjustGeneViewHeight(trackCount) {
                var yShift = (trackCount + 1) * SD_1COL_HEIGHT + (SD_1COL_HEIGHT * 4);
                target.attr('height', yShift);

                if (scope.showStatus) {
                    statusBar.attr('transform', 'translate(0,' + (yShift - SD_1COL_HEIGHT) + ")");
                }


                var axisShiftExtra = scope.showStatus ? 0 : SD_1COL_HEIGHT;
                axis.selectAll('.tick line').attr('y2', yShift + axisShiftExtra - (SD_1COL_HEIGHT * 2));


            }

            scope.render = function() {
                init();
                drawStatusBar();

                if (scope.activeSelection.length > 0) {
                    updateStatusText('Requesting ...');

                    //Search extra %x both ways for sensitivity
                    var SENSITIVITY = Math.round((scope.boundTo - scope.boundFrom) * 0);

                    console.log(scope.boundFrom, scope.boundTo, SENSITIVITY);
                    geneLoader.getGenes(scope.chr, scope.boundFrom - SENSITIVITY, scope.boundTo + SENSITIVITY, function(data) {

                        if (typeof data.err ==='undefined') {
                            updateStatusText('Loaded: ' + scope.chr +' [' + scope.boundFrom + " : " + scope.boundFrom + ']');
                            var geneDataSet = new GeneManager().process(data);

                            var maxBP = d3.max(geneDataSet, function(d){ return +d.gene.end;});
                            var minBP = d3.min(geneDataSet, function(d){return +d.gene.start});

                            xscale = d3.scale.linear()
                                .range([0, +scope.width])
                                .domain([minBP, maxBP]);

                            drawScale();
                            var maxTrack = d3.max(geneDataSet, function(d) {return d.track});
                            adjustGeneViewHeight(maxTrack);

                            drawGenes(geneDataSet);
                            drawBands(scope.activeSelection);

                        } else {
                            updateStatusText(data.err);
                        }

                    });


                }
                else {
                    updateStatusText("No active selectors");
                }


            }

        }

        return {
            link: link,
            require : '^chromosome',
            restrict: 'AE',
            scope: {
                showStatus: '@'
            },
            templateUrl: 'src/geneview-template.html'
        };
    }]);
}());