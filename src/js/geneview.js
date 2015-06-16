/*global angular, d3, _*/
(function () {
    "use strict";
    angular
        .module('angularGeneviewVis')
        .directive('geneview', ['geneLoader', 'phenotypeLoader','articleStatLoader', 'geneManager', '$rootScope' /*,'$state'*/, '$q', 'gen2Phen', function (geneLoader,phenotypeLoader, articleStatLoader, geneManager, $rootScope/*,$state*/, $q, gen2Phen) {

            function link(scope, element, attrs, chrAPI) {

                var target, axis, statusBar, statusText, geneTip, divParent,//,articleTarget;
                    SD_1COL_HEIGHT = 20,
                    GENES_YSHIFT = 34;

                scope.selectorPhenotypes = []; //phenotypes related to a location that is selected

                //when selector has a new location
                scope.$on("selector:newLoc", function (e, arg) {
                    scope.render();
                });


                var init = function () {
                    var selectionModel = chrAPI.getActiveSelection();
                    var chrConfigs = chrAPI.getAttrs();

                    scope.displayGeneview = true;
                    scope.articleStats = (scope.articleStats === true) ? true : (scope.articleStats === 'true');
                    scope.phenotypes = (scope.phenotypes === true) ? true : (scope.phenotypes === 'true');
                    scope.activeSelection = selectionModel.getSelectedBands().bands;
                    scope.sensitivity = Math.round(selectionModel.getSelectedBands().sensitivity);
                    scope.boundFrom = selectionModel.selStart - scope.sensitivity;
                    scope.boundTo = selectionModel.selEnd + scope.sensitivity;
                    scope.selectorStart = selectionModel.selStart;
                    scope.selectorEnd = selectionModel.selEnd;
                    scope.width = chrConfigs.width;
                    scope.chr = chrConfigs.chr;
                    scope.height = 120;
                    scope.showStatus = (scope.showStatus === true) ? true : (scope.showStatus === 'true');
                    scope.activeSelector = chrAPI.getActiveSelector();


                    scope.xscale = d3.scale.linear()
                        .range([0, +scope.width])
                        .domain([scope.boundFrom, scope.boundTo]);

                    divParent = d3.select(element[0]).select('.angular-geneview-vis')
                        .style('height', scope.height + 'px')
                        .style('width', chrConfigs.width + 'px');

                    divParent.select('svg').remove();

                    target = divParent.append('svg')
                        .attr('height', scope.height)
                        .attr('width', scope.width);

                    geneTip = d3.tip()
                        .attr('class', 'd3-tip')
                        .direction('n')
                        .offset([-5, 0])
                        .html(function (d) {
                            var tiptemp = '<div class="gene-tip"><span style="color:#ffb006">' + d.gene.symbol + "</span> <div>" + d.gene.desc + "</div></div> ";
                            return tiptemp;
                        });

                    target.call(geneTip);

                    drawStatusBar();
                    updateStatusText("Initialized");
                };

                function drawBands(bands) {

                    //  Average band label width
                    var LABEL_WIDTH = 26;

                    var band = target.append('g')
                        .classed('geneview-bands', true)
                        .attr('transform', 'translate(0,' + SD_1COL_HEIGHT + ")")
                        .selectAll('g')
                        .data(bands).enter()
                        .append('g');

                    band.append('rect')
                        .attr('class', function (d) {
                            return d.type.replace(":", " ");
                        })
                        .attr('x', function (d) {
                            return scope.xscale(+d.start);
                        })
                        .attr('height', SD_1COL_HEIGHT)
                        .attr('width', function (d) {
                            return scope.xscale(d.end) - scope.xscale(d.start);
                        });

                    band.append('text')
                        .attr('class', function(d) {
                            return d.type.substring(5) + '-text';
                        })
                        .text(function (d) {
                            var bandw = scope.xscale(d.end) - scope.xscale(d.start);
                            if (bandw < LABEL_WIDTH) {
                                return "";
                            }

                            return d.id;
                        })
                        .attr('x', function (d) {

                            var s = d.start < scope.boundFrom ? scope.boundFrom : d.start;
                            var e = d.end < scope.boundTo ? d.end : scope.boundTo;
                            var mid = s + ((e - s) / 2);
                            return scope.xscale(mid) - (LABEL_WIDTH / 2);
                        })
                        .attr('y', 13);
                }

                function updateStatusText(text) {
                    if (scope.showStatus) {
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
                        .scale(scope.xscale);

                    axis = target.append('g')
                        .classed('geneview-scale', true)
                        .attr('transform', 'translate(0,' + SD_1COL_HEIGHT + ")")
                        .call(zmAxis);

                }

                function drawGenes(geneDataSet) {

                    //var menu = [
                    //	{
                    //		title: 'View in genome browser',
                    //		action: function (elm, d, i) {
                    //			$state.go("user.genomeBrowser");
                    //			$rootScope.page = 3;
                    //			$rootScope.$apply();
                    //		}
                    //	},
                    //	{
                    //		title: 'Fetch related articles',
                    //		action: function (elm, d, i) {
                    //			$state.transitionTo('user.search', {'searchTerms': d.gene.symbol}, {
                    //				reload: false, inherit: false, notify: true, ignoreDsr: true
                    //			});
                    //		}
                    //	}
                    //];

                    scope.gene = target.append('g')
                        .attr('transform', 'translate(0,' + GENES_YSHIFT +")")
                        .selectAll('g')
                        .data(geneDataSet).enter().append('g');

                    scope.gene.append('rect')
                        .classed('gene', true)
                        .attr('id', function (d) {
                            return 'gene_' + d.gene.symbol;
                        })
                        .attr('height', SD_1COL_HEIGHT / 2)
                        .attr('x', function (d) {
                            return d3.min([scope.xscale(+d.gene.start), scope.xscale(+d.gene.end)]);
                        })
                        .attr('y', function (d) {
                            return (+d.track + 1) * SD_1COL_HEIGHT;
                        })
                        //Animate the gene width
                        .attr('width', 0)
                        .transition()
                        .delay(function (d, i) { return i * 10; })
                        .duration(300)
                        .attr('width', function (d) {
                            var a = scope.xscale(+d.gene.start) - scope.xscale(+d.gene.end);
                            var b = scope.xscale(+d.gene.end) - scope.xscale(+d.gene.start);

                            var w = d3.max([a, b]);
                            return w < 1 ? 2 : w;
                        });

                    scope.gene.append('title').text(function (d) {return d.gene.symbol; });

                    scope.gene.on('mouseover', geneTip.show)
                        .on('mouseout', geneTip.hide);
                    //.on('contextmenu', d3.contextMenu(menu))
                    //.on('mousedown', d3.contextMenu(menu));
                }

                function adjustGeneViewHeight(trackCount) {
                    var yShift = (trackCount + 1) * SD_1COL_HEIGHT + (SD_1COL_HEIGHT * 4);

                    divParent.style('height', yShift + "px");

                    target.transition()
                        .attr('height', yShift);

                    if (scope.showStatus) {
                        statusBar.attr('transform', 'translate(0,' + (yShift - SD_1COL_HEIGHT) + ")");
                    }

                    var extraShift = scope.showStatus ? 0 : SD_1COL_HEIGHT;
                    var extraShiftInv = scope.showStatus ? SD_1COL_HEIGHT : 0;
                    axis.selectAll('.tick line').attr('y2', yShift + extraShift - (SD_1COL_HEIGHT * 2));

                    target.selectAll('.sensitivityBorders')
                        .attr('height', yShift - extraShiftInv);

                }

                function drawSensitivityBorders() {
                    var borders = target.append('g');

                    var styleObj = {
                        'fill' : '#666666',
                        'opacity': 0.2
                    };

                    var height = scope.showStatus ? scope.height - SD_1COL_HEIGHT : scope.height;

                    var w = scope.xscale(scope.selectorStart) - scope.xscale(scope.boundFrom);

                    //left border
                    borders.append('rect')
                        .classed('sensitivityBorders', true)
                        .attr('x', scope.xscale(scope.boundFrom))
                        .attr('y', 0)
                        .attr('width', w)
                        .attr('height', height)
                        .style(styleObj);

                    borders.append('rect')
                        .classed('sensitivityBorders', true)
                        .attr('x', function () {
                            return (scope.xscale(scope.boundTo) - w);
                        })
                        .attr('y', 0)
                        .attr('width', w)
                        .attr('height', height)
                        .style(styleObj);
                }

                /**
                 * Extract gene names to ; delimited string
                 * Used for passing to PHP
                 * @param genes
                 * @returns {string} e.g ATL;BRCA;PARP8
                 */
                function extractGeneSymbol(genes) {
                    var r = "";
                    for (var i = 0; i < genes.length; i++) {
                        r = r.concat(genes[i].gene.symbol + ";");
                    }
                    r = r.substr(0, r.length - 1);
                    return r;
                }

                function processGeneArticleData(geneData, articleData) {

                    var count = 0, start, end, res = [];
                    for(var i = 0; i < geneData.length; i++) {
                        var geneSymbol = geneData[i].gene.symbol;
                        if (articleData.hasOwnProperty(geneSymbol)) {
                            count = articleData[geneSymbol];
                            start = +geneData[i].gene.start;
                            end = +geneData[i].gene.end;
                        }

                        var mid = (start + end) / 2;
                        if (isNaN(mid)) { continue; }
                        res.push({
                            gene: geneSymbol,
                            articleCount: count,
                            midLocation: (start + end) / 2
                        });
                    }

                    return res;
                }

                function drawPhenotypes(data) {
                    phenotypeLoader.load(data).then(function(response) {

                        var res = response.filter(function(e){
                           return typeof e === "object" ? true : false;
                        });

                        //if there are any phenotypes from OMIM
                        if (res.length > 0) {

                            res.sort(function(a,b){
                                if (a.start < b.start) { return -1; }
                                if (a.start > b.start) { return 1; }
                                return 0;
                            });

                            scope.mappingsO = _.map(res, function(a,key) { var b = {}; b.symbol= a.symbol;b.phenotypes= a.phenotypes; return b;  });

                            //adjust svg size
                            divParent.style('height', 400 + "px");

                            target.transition()
                                .attr('height', 400);

                            //TODO calculate height dynamically

                            var startHeight = 200;

                            var margin = {top: 50, right: 10, bottom: 10, left: 10},
                                width = 960 - margin.left - margin.right,
                                height = 200 - margin.top - margin.bottom;

                            var t = _.pluck(res, 'phenotypes');
                            var phenotypes = _.pluckDeep(_.flatten(t), 'phenotypeMap.phenotype'); //list of phenotypes

                            var svg = target;

                            //svg.append("g")
                            //	.attr("transform", "rotate(25)");

                            var names = svg.append("g")
                                .selectAll('text')
                                .data(phenotypes)
                                .enter()
                                //.append('g')
                                .append('text')
                                .attr("font-size", "12px")
                                .text(function(d) {
                                    return d;
                                })
                                .attr("transform", function(d, i) {
                                    return "translate(" + ((i * 50) + 30) + "," + (startHeight+10) + ")rotate(25)"
                                });

                            var lineFunction = d3.svg.line()
                                .x(function(d) { return d.x; })
                                .y(function(d) { return d.y; })
                                .interpolate("linear");

                            var currentPhen = "";
                            var currentMapping = "";

                            var linetest = svg.append("g")
                                .selectAll('path')
                                .data(phenotypes)
                                .enter()
                                .append("path")
                                .attr("d", function(d,i) {
                                    //get location of related gene
                                    var geneXVal, geneYVal;
                                    currentPhen = d;
                                    _.forEach(scope.mappingsO, function(b) {
                                        currentMapping = b;
                                        _.forEach(b.phenotypes, function(c) {
                                            if (c.phenotypeMap.phenotype === currentPhen) {
                                                //now we want to get location of gene
                                                var g = currentMapping.symbol; //gene we want
                                                //var se = scope.gene.filter(function(d) {
                                                //	return d.gene.symbol === g;
                                                //})
                                                var genes = d3.selectAll(".gene").filter(function(d) {
                                                    return d.gene.symbol.toUpperCase() === g.toUpperCase();
                                                }); //all the gene elements
                                                var geneWidth = genes[0][0].width.animVal.value;
                                                geneXVal = genes[0][0].x.animVal.value + geneWidth/2;
                                                geneYVal = genes[0][0].y.animVal.value + 45; //TODO calculate this properly
                                            }
                                        });
                                    })
                                    return lineFunction([{'x':(i*50+20),'y':startHeight},{'x':geneXVal,'y':geneYVal}]);
                                })
                                .attr("stroke", function(d) {
                                    return "steelblue";
                                    //TODO encode according to omim type?
                                })
                                .attr("stroke-width", 1)
                                .style("opacity", 0.3)
                                .attr("fill", "none")
                                .on('mouseover', function(d) {
                                    d3.select(this)
                                        .style("opacity", 1);
                                })
                                .on('mouseout', function(d) {
                                    d3.select(this)
                                        .style("opacity", 0.3);
                                });

                            var circles = svg.append("g")
                                .selectAll('circle')
                                .data(phenotypes)
                                .enter()
                                .append('circle');

                            circles.attr("cx", function(d, i) {
                                return (i * 50) + 20;
                            })
                                .attr("cy", startHeight)
                                .attr("r", 5)
                                .attr("fill", function(d) {
                                    //color according to
                                    if (d.charAt(0) === '{') { //susceptibility
                                        return "#CBBCDC";
                                    }
                                    else if (d.charAt(0) === '?') { //unconfirmed
                                        return "#C1DE77";
                                    }
                                    else if (d.charAt(0) === '[') { //nondisease
                                        return "#83DEC1";
                                    }
                                    else {
                                        return "#E6B273";
                                    }
                                });
                        }

                        //if there any phenotypes from the literature
                        if (scope.g2pL.length > 0) {
                            scope.mappingsL = _.map(scope.g2pL, function(a,key) { var b = {}; b.symbol= a.symbol;b.phenotypes= a.phenotypes; return b;  });
                            var a;
                        }
                    }).catch(function(e) {
                        console.log(e);
                    });

                }

                scope.render = function() {
                    scope.selectorPhenotypes = [];
                    init();
                    if (scope.activeSelection.length > 0) {
                        updateStatusText('Requesting ...');
                        drawScale();
                        drawBands(scope.activeSelection);
                        drawSensitivityBorders();
                        scope.geneLoadPromise = geneLoader.getGenes(scope.chr, scope.boundFrom , scope.boundTo, function(data) {

                            if (data.length === 0) {
                                //console.log('no data');
                                updateStatusText("No Data");
                                return;
                            }

                            scope.g2pO = []; //for omim
                            scope.g2pL = []; //for literature

                            if (typeof data.err ==='undefined') {

                                //var geneDataSet = new GeneManager(scope.boundFrom, scope.boundTo).process(data);
                                var geneDataSet = geneManager.process(data,scope.boundFrom,scope.boundTo);

                                var maxTrack = d3.max(geneDataSet, function(d) {return d.track; });

                                drawGenes(geneDataSet);

                                if(scope.phenotypes) {
                                    drawPhenotypes(geneDataSet);
                                }

                                adjustGeneViewHeight(maxTrack);
                                updateStatusText('Loaded: ' + scope.chr +' [' + scope.boundFrom + " : " + scope.boundTo + '] Results: ' + geneDataSet.length);

                                if (scope.articleStats) {
                                    articleStatLoader.getArticleCount(extractGeneSymbol(geneDataSet), function(aCount) {
                                        scope.articleData = processGeneArticleData(geneDataSet, aCount);
                                    });

                                }

                            } else {
                                updateStatusText(data.err);
                            }
                        });
                    }
                    else {
                        updateStatusText("No active selectors");
                    }
                };

            }

            function controller($scope) {
                this.getXscale = function() {
                    return $scope.xscale;
                };
            }

            return {
                controller: controller,
                link: link,
                require : '^chromosome',
                restrict: 'AE',
                transclude:true,
                scope: {
                    showStatus: '@',
                    articleStats: '@',
                    phenotypes: '@'
                },
                templateUrl: 'src/geneview-template.html'
            };
        }]);

})();