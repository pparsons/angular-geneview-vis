

(function(){

	var angularGeneviewVis = angular.module('angularGeneviewVis', []);

	angularGeneviewVis.factory('geneLoader', ['$http', '$rootScope', function($http, $rootScope) {

		//hard code
		//$rootScope.server = 'http://localhost:9090';

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
					responseType : 'json'
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

	angularGeneviewVis.directive('geneview', ['geneLoader', '$state', '$rootScope', function(geneLoader, $state, $rootScope) {

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

		function link(scope, element, attrs, controllerInstance) {

			var target, xscale, axis, statusBar, statusText, geneTip;
			var SD_1COL_HEIGHT = 20,
				GENES_YSHIFT = 34;

                scope.display = true;
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

                xscale = d3.scale.linear()
                    .range([0, +scope.width])
                    .domain([scope.boundFrom, scope.boundTo]);

				var divParent = d3.select(element[0]).select('.angular-geneview-vis')
					.style('height', scope.height)
					.style('width', chrConfigs.width + 'px');

				divParent.select('svg').remove();

                geneTip = d3.tip()
                    .attr('class', 'd3-tip')
                    .direction('n')
                    .offset([-5,0])
                    .html(function(d) {
                        var tiptemp = '<div class="gene-tip"><span style="color:#ffb006">' + d.gene.symbol + "</span> <div>"+ d.gene.desc + "</div></div> ";
                        return tiptemp;
                    }
                );

                geneTipDetailed = d3.tip()
                    .attr('class', 'd3-tip gene-tip-detailed')
                    .direction('n')
                    .offset([-5,0])
                    .html(function(d) {
                        var tiptemp = '<div class="gene-tip"><span style="color:#ffb006">' + d.gene.symbol + '</span> <div>' +
                            "<div><a href=\"#\">Link Desc 1" + '</div>' +
                            "<div><a href=\"#\">Link Desc 2" + '</div>' +
                            "</div></div> ";
                        return tiptemp;
                    }
                );

                target.call(geneTip);
                target.call(geneTipDetailed);

                drawStatusBar();
                updateStatusText("Initialized");
            };

            init();

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
                        var s = d.start < scope.boundFrom ? scope.boundFrom : d.start;
                        var e = d.end < scope.boundTo ? d.end : scope.boundTo;
                        var mid = s + ((e - s) / 2);
                        return xscale(mid) - 5;
                    })
                    .attr('y', 13)
                    .text(function(d){return d.id});
            }

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
					.on('mouseout', geneTip.hide)
					//.on('contextmenu', d3.contextMenu(menu))
					.on('mousedown', d3.contextMenu(menu));
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
function drawSensitivityBorders() {
                var borders = target.append('g');

                var styleObj = {
                    'fill' : '#666666',
                    'opacity': 0.2
                };

                var height = scope.showStatus ? scope.height - 2 * SD_1COL_HEIGHT : scope.height - SD_1COL_HEIGHT;

                var w = xscale(scope.selectorStart) - xscale(scope.boundFrom);

                //left border
                borders.append('rect')
                    .classed('sensitivityBorders', true)
                    .attr('x', xscale(scope.boundFrom))
                    .attr('y', SD_1COL_HEIGHT)
                    .attr('width', w)
                    .attr('height', height)
                    .style(styleObj);

                borders.append('rect')
                    .classed('sensitivityBorders', true)
                    .attr('x', function(){
                        return (xscale(scope.boundTo ) - w);
                    })
                    .attr('y', SD_1COL_HEIGHT)
                    .attr('width', w)
                    .attr('height', height)
                    .style(styleObj);
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

                            var maxTrack = d3.max(geneDataSet, function(d) {return d.track});

                            drawGenes(geneDataSet);

                            adjustGeneViewHeight(maxTrack);
                            updateStatusText('Loaded: ' + scope.chr +' [' + scope.boundFrom + " : " + scope.boundTo + '] Results: ' + geneDataSet.length);

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
			templateUrl: 'angular-geneview-vis/src/geneview-template.html'
		};
	}]);
})();