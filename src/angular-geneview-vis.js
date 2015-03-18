

(function() {

	var angularGeneviewVis = angular.module('angularGeneviewVis', []);

	angularGeneviewVis.factory('geneLoader', ['$http', '$rootScope', function($http, $rootScope) {

		//hard code
		//$rootScope.server = 'http://localhost:9090';

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

	angularGeneviewVis.directive('geneview', ['geneLoader','articleStatLoader', '$rootScope', /*'$state',*/ function(geneLoader, articleStatLoader, $rootScope/*, $state*/) {

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

		function link(scope, element, attrs, chrAPI) {

			var target, axis, statusBar, statusText, geneTip, divParent;//,articleTarget;
			var SD_1COL_HEIGHT = 20,
				GENES_YSHIFT = 34;

			//when selector has a new location
			scope.$on("selector:newLoc", function(e, arg) {
				scope.render();
			});


			var init = function() {
				var selectionModel = chrAPI.getActiveSelection();
				var chrConfigs = chrAPI.getAttrs();

				scope.displayGeneview = true;
                scope.articleStats = (scope.articleStats === true) ? true :(scope.articleStats === 'true');
				scope.activeSelection = selectionModel.getSelectedBands().bands;
				scope.sensitivity = selectionModel.getSelectedBands().sensitivity;
				scope.boundFrom = selectionModel.selStart - scope.sensitivity;
				scope.boundTo = selectionModel.selEnd + scope.sensitivity;
				scope.selectorStart = selectionModel.selStart;
				scope.selectorEnd = selectionModel.selEnd;
				scope.width = chrConfigs.width;
				scope.chr = chrConfigs.chr;
				scope.height = 120;
				scope.showStatus = (scope.showStatus === true) ? true :(scope.showStatus === 'true');
				scope.activeSelector = chrAPI.getActiveSelector();


				scope.xscale = d3.scale.linear()
					.range([0, +scope.width])
					.domain([scope.boundFrom, scope.boundTo]);

				divParent = d3.select(element[0]).select('.angular-geneview-vis')
					.style('height', scope.height + 'px')
					.style('width', chrConfigs.width + 'px');

                //if (scope.articleStats) {
                //    articleTarget = divParent.select('.angular-geneview-vis-article')
                //        .style('width', chrConfigs.width + 'px');
                //}

				divParent.select('svg').remove();

				target = divParent.append('svg')
					.attr('height', scope.height)
					.attr('width', scope.width);

				geneTip = d3.tip()
					.attr('class', 'd3-tip')
					.direction('n')
					.offset([-5,0])
					.html(function(d) {
						var tiptemp = '<div class="gene-tip"><span style="color:#ffb006">' + d.gene.symbol + "</span> <div>"+ d.gene.desc + "</div></div> ";
						return tiptemp;
					}
				);

				target.call(geneTip);

				drawStatusBar();
				updateStatusText("Initialized");
			};

			//init();

			function drawBands(bands) {
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
						return scope.xscale(+d.start);
					})
					.attr('height', SD_1COL_HEIGHT)
					.attr('width', function(d) {
						return scope.xscale(d.end) - scope.xscale(d.start);
					});
				band.append('text')
					.attr('class', function(d) {
						return d.type.substring(5) + '-text';
					})
					.attr('x', function(d) {
						var s = d.start < scope.boundFrom ? scope.boundFrom : d.start;
						var e = d.end < scope.boundTo ? d.end : scope.boundTo;
						var mid = s + ((e - s) / 2);
						return scope.xscale(mid) - 5;
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
					.scale(scope.xscale);

				axis = target.append('g')
					.classed('geneview-scale', true)
					.attr('transform', 'translate(0,' + SD_1COL_HEIGHT + ")")
					.call(zmAxis);

			}

			function drawGenes(geneDataSet) {

				var menu = [
					{
						title: 'View in genome browser',
						action: function(elm, d, i) {
							//$state.go("user.genomeBrowser");
							$rootScope.page=4;
							$rootScope.$apply();
						}
					},
					{
						title: 'Fetch related articles',
						action: function(elm, d, i) {
							scope.$parent.$parent.$parent.$parent.$parent.$parent.$parent.$parent.$parent.search.searchterms = d.gene.symbol;
							scope.$parent.$parent.$parent.$parent.$parent.$parent.$parent.$parent.$parent.litSubmit('term');
						}
					}
				]

				var gene = target.append('g')
					.attr('transform', 'translate(0,' + GENES_YSHIFT +")")
					.selectAll('g')
					.data(geneDataSet).enter().append('g');

                gene.append('rect')
                    .classed('gene', true)
                    .attr('height', SD_1COL_HEIGHT / 2)
                    .attr('x', function(d) {
                        return d3.min([scope.xscale(+d.gene.start), scope.xscale(+d.gene.end)]);
                    })
                    .attr('y', function(d) {
                        return (+d.track +1) * (SD_1COL_HEIGHT);
                    })
                    //Animate the gene width
                    .attr('width', 0)
                    .transition()
                    .delay(function (d, i) { return i*10; })
                    .duration(300)
                    .attr('width', function(d) {
                        var a = scope.xscale(+d.gene.start) - scope.xscale(+d.gene.end);
                        var b = scope.xscale(+d.gene.end) - scope.xscale(+d.gene.start);

                        var w = d3.max([a,b]);
                        return w < 1 ? 2: w;
                    });

				gene.append('title').text(function(d){return d.gene.symbol});

				gene.on('mouseover', geneTip.show)
					.on('mouseout', geneTip.hide)
					//.on('contextmenu', d3.contextMenu(menu))
					.on('mousedown', d3.contextMenu(menu));
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
                    .attr('height', yShift - (2 * extraShiftInv));

			}

			function drawSensitivityBorders() {
				var borders = target.append('g');

				var styleObj = {
					'fill' : '#666666',
					'opacity': 0.2
				};

				var height = scope.showStatus
                    ? scope.height - 2 * SD_1COL_HEIGHT
                    : scope.height - SD_1COL_HEIGHT;

				var w = scope.xscale(scope.selectorStart) - scope.xscale(scope.boundFrom);

				//left border
				borders.append('rect')
					.classed('sensitivityBorders', true)
					.attr('x', scope.xscale(scope.boundFrom))
					.attr('y', SD_1COL_HEIGHT)
					.attr('width', w)
					.attr('height', height)
					.style(styleObj);

				borders.append('rect')
					.classed('sensitivityBorders', true)
					.attr('x', function(){
						return (scope.xscale(scope.boundTo ) - w);
					})
					.attr('y', SD_1COL_HEIGHT)
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
            function extractGeneSymbol(genes){
                var r = "";
                for(var i = 0; i< genes.length; i++) {
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

                    //articleData[geneSymbol] = {
                    //    articleCount: count,
                    //    midLocation : (start + end) / 2
                    //}
                    res.push({
                        gene: geneSymbol,
                        articleCount: count,
                        midLocation: (start + end) / 2
                    });
                }

                return res;
            }

            scope.render = function() {
				init();
				if (scope.activeSelection.length > 0) {
					updateStatusText('Requesting ...');
					drawScale();
					drawBands(scope.activeSelection);
					drawSensitivityBorders();
					geneLoader.getGenes(scope.chr, scope.boundFrom , scope.boundTo, function(data) {

						if (data.length == 0) {
							console.log('no data');
							updateStatusText("No Data");
							return;
						}

						if (typeof data.err ==='undefined') {

							var geneDataSet = new GeneManager().process(data);
                            //console.log(geneDataSet);
							var maxTrack = d3.max(geneDataSet, function(d) {return d.track});

							drawGenes(geneDataSet);

							adjustGeneViewHeight(maxTrack);
							updateStatusText('Loaded: ' + scope.chr +' [' + scope.boundFrom + " : " + scope.boundTo + '] Results: ' + geneDataSet.length);

                            //if (scope.articleStats) {
                            //    var gs = extractGeneSymbol(geneDataSet);
                            //    console.log(gs);
                            //    renderArticleStats(gs);
                            //}

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
			}

		}

        function controller($scope) {
            this.getXscale = function() {
                return $scope.xscale;
            }
        }

		return {
            controller: controller,
			link: link,
			require : '^chromosome',
			restrict: 'AE',
            transclude:true,
			scope: {
				showStatus: '@',
                articleStats: '@'
			},
			templateUrl: 'src/geneview-template.html'
		};
	}]);

    angularGeneviewVis.directive('articleView', ['articleStatLoader', function(articleStatLoader) {
        return {
            restrict: 'AE',
            require: '^geneview',
            scope: {
                data: '=',
                width: '='
            },
            link : function(scope, element, attrs, geneviewAPI) {

                var xscale, height = 60;
                var margin = {top: 5, right: 20, bottom: 5, left: 0};

                var ylAxis = d3.svg.axis()
                    .orient('right')
                    .ticks(4);

                var target = d3.select(element[0]).append('svg')
                    .classed('article-view', true)
                    .attr('height', height);

                var g = target.append('g')
                    .classed('article-scale', true)
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


                var line = d3.svg.line();

                var yscale = d3.scale.linear()
                    .range([0, height - margin.bottom]);

                //render updated data
                scope.$watch('data', function(data){
                    if(typeof data !== 'undefined') {


                        target.attr('width', scope.width);

                        console.log(data);

                        data.sort(function(a, b) {
                           if(a.midLocation < b.midLocation) return -1;
                           if(a.midLocation > b.midLocation) return 1;
                           return 0;
                        });
                        console.log("sort:",data);
                        var maxArticleCount = d3.max(data, function(d){ return d.articleCount;});
                        yscale.domain([0, maxArticleCount]);
                        xscale = geneviewAPI.getXscale();

                        ylAxis.scale(yscale);

                        g.call(ylAxis);

                        line.x(function(d){ return xscale(d.midLocation)})
                            .y(function(d){ return yscale(d.articleCount)});

                        target.select('.line').remove();
                        target.append("path")
                            .datum(data)
                            .classed('line', true)
                            .attr('d', line);

                        console.log(maxArticleCount, yscale(772));



                    }
                })
            }

        };
    }]);

})();