

(function() {

	var angularGeneviewVis = angular.module('angularGeneviewVis', []);

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

	angularGeneviewVis.directive('geneview', ['geneLoader','articleStatLoader', '$rootScope', '$state', '$q', 'gen2Phen', function(geneLoader, articleStatLoader, $rootScope, $state, $q, gen2Phen) {

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

			scope.selectorPhenotypes = []; //phenotypes related to a location that is selected

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
				scope.sensitivity = Math.round(selectionModel.getSelectedBands().sensitivity);
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

				//  Average band label width
				var LABEL_WIDTH = 26;

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
					.text(function(d) {
						var bandw = scope.xscale(d.end) - scope.xscale(d.start);
						if (bandw < LABEL_WIDTH) {
							return "";
						}

						return d.id
					})
					.attr('x', function(d) {

						var s = d.start < scope.boundFrom ? scope.boundFrom : d.start;
						var e = d.end < scope.boundTo ? d.end : scope.boundTo;
						var mid = s + ((e - s) / 2);
						return scope.xscale(mid) - (LABEL_WIDTH/2);
					})
					.attr('y', 13);
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
							$state.go("user.genomeBrowser");
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

				scope.gene = target.append('g')
					.attr('transform', 'translate(0,' + GENES_YSHIFT +")")
					.selectAll('g')
					.data(geneDataSet).enter().append('g');

				scope.gene.append('rect')
					.classed('gene', true)
					.attr('id', function(d) {
						return 'gene_' + d.gene.symbol;
					})
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

				scope.gene.append('title').text(function(d){return d.gene.symbol});

				scope.gene.on('mouseover', geneTip.show)
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
					.attr('height', yShift - (extraShiftInv));

			}

			function drawSensitivityBorders() {
				var borders = target.append('g');

				var styleObj = {
					'fill' : '#666666',
					'opacity': 0.2
				};

				var height = scope.showStatus
					? scope.height - SD_1COL_HEIGHT
					: scope.height;

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
					.attr('x', function(){
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

					var mid = (start + end) / 2;
					if (isNaN(mid)) continue;
					res.push({
						gene: geneSymbol,
						articleCount: count,
						midLocation: (start + end) / 2
					});
				}

				return res;
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

						if (data.length == 0) {
							console.log('no data');
							updateStatusText("No Data");
							return;
						}

						scope.g2pO = []; //for omim
						scope.g2pL = []; //for literature

						if (typeof data.err ==='undefined') {


							var results = function() {
								var promises = [];
								//loop through each result
								for (var i = 0; i < data.length; i++) {
									//create closure for promise
									(function () {
										var defer = $q.defer();

										// get associated phenotypes for each
										var promise = gen2Phen.omim(data[i].symbol)
											.then(function (res) {
												//if there is a result
												if (res.data.omim.searchResponse.endIndex !== -1) {
													var gene = res.data.omim.searchResponse.entryList[0].entry;
													//if there is a related phenotype(s)
													if (typeof gene.geneMap !== 'undefined' && typeof gene.geneMap.phenotypeMapList !== 'undefined') {
														var symbol = gene.matches;
														var phenotypes = gene.geneMap.phenotypeMapList;
														scope.g2pO.push({'symbol': symbol, 'phenotypes': phenotypes});
													}
												}
												defer.resolve();
												defer.promise.then(function () {
													var a;
												});
											});
										promises.push(promise);

										var p2 = gen2Phen.lit(data[i].symbol)
											.then(function (res) {
												if(res.data.response.docs.length > 0) {
													var symbol = res.config.params.query;
													var phenotypes = _.uniq(_.compact(_.flatten(_.pluck(res.data.response.docs,'phenotypes'))));
													scope.g2pL.push({'symbol': symbol, 'phenotypes': phenotypes});
												}
											});

										promises.push(p2);
									})(i);
								}//end for
								return $q.all(promises);
							}

							results().then(function() {
								//if there are any phenotypes from OMIM
								if (scope.g2pO.length > 0) {
									scope.mappingsO = _.map(scope.g2pO, function(a,key) { var b = {}; b.symbol= a.symbol;b.phenotypes= a.phenotypes; return b;  });

									//adjust svg size
									divParent.style('height', 400 + "px");

									target.transition()
										.attr('height', 400);

									//TODO calculate height dynamically

									var startHeight = 200;

									var margin = {top: 50, right: 10, bottom: 10, left: 10},
										width = 960 - margin.left - margin.right,
										height = 200 - margin.top - margin.bottom;

									var t = _.pluck(scope.g2pO, 'phenotypes');
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
												})
											})
											return lineFunction([{'x':(i*50+20),'y':startHeight},{'x':geneXVal,'y':geneYVal}])
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
							});

							var geneDataSet = new GeneManager().process(data);
							//console.log(geneDataSet);
							var maxTrack = d3.max(geneDataSet, function(d) {return d.track});

							drawGenes(geneDataSet);

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
			templateUrl: 'angular-geneview-vis/src/geneview-template.html'
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
				var margin = {top: 5, right: 20, bottom: 8, left: 20};

				var ylAxis = d3.svg.axis()
					.orient('right')
					.ticks(4);

				var target = d3.select(element[0]).append('svg')
					.classed('article-view', true)
					.attr('height', height);

				var g = target.append('g')
					.classed('article-scale', true)
					.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

				target.append('text')
					.text('Article Count')
					.attr("transform", "translate(" +10 + "," + (height - 3) + ") rotate(-90)");

				var line = d3.svg.line();

				var yscale = d3.scale.linear()
					.range([margin.top, height - margin.bottom]);

				//render updated data
				scope.$watch('data', function(data){
					if(typeof data !== 'undefined') {
						target.attr('width', scope.width);

						data.sort(function(a, b) {
							if(a.midLocation < b.midLocation) return -1;
							if(a.midLocation > b.midLocation) return 1;
							return 0;
						});

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

					}
				})
			}

		};
	}]);

})();