/*global angular, d3, _*/
(function () {
  "use strict";
  angular
    .module('angularGeneviewVis')
    .directive('geneview', ['geneLoader', 'phenotypeLoader', 'articleStatLoader', 'geneManager', '$rootScope' /*,'$state'*/, '$q', 'gen2Phen', function (geneLoader, phenotypeLoader, articleStatLoader, geneManager, $rootScope/*,$state*/, $q, gen2Phen) {

      function link(scope, element, attrs, chrAPI) {

        var
          svgTarget,

          axis,
          statusBar,
          statusText,
          geneTip,

          // Immediate div containing target svg
          divParent,

          //Active dom heights, updated by updateContainerHeights()
          currentHeights,

          geneDB = {};

        var
        // Fixed one unit of height in px
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

          svgTarget = divParent.append('svg')
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

          svgTarget.call(geneTip);

          drawStatusBar();
          updateStatusText("Initialized");
        };

        function drawBands(bands) {

          //  Average band label width
          var LABEL_WIDTH = 26;

          var band = svgTarget.append('g')
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
            .attr('class', function (d) {
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
            statusBar = svgTarget.append('g')
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

          axis = svgTarget.append('g')
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

          var genes = svgTarget.append('g')
            .attr('transform', 'translate(0,' + GENES_YSHIFT + ")")
            .selectAll('g')
            .data(geneDataSet).enter().append('g');

          genes.append('rect')
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
            .delay(function (d, i) {
              return i * 10;
            })
            .duration(300)
            .attr('width', function (d) {
              var a = scope.xscale(+d.gene.start) - scope.xscale(+d.gene.end);
              var b = scope.xscale(+d.gene.end) - scope.xscale(+d.gene.start);

              var w = d3.max([a, b]);
              return w < 1 ? 2 : w;
            });

          genes.append('title').text(function (d) {
            return d.gene.symbol;
          });

          genes.on('mouseover', geneTip.show)
            .on('mouseout', geneTip.hide);
          //.on('contextmenu', d3.contextMenu(menu))
          //.on('mousedown', d3.contextMenu(menu));


          //update geneDB
          genes.each(function(d) {
            geneDB[d.gene.symbol] = d;
            //geneDB[d.gene.symbol].d3Selection = this;
          });
        }

        function updateContainerHeights(totalGeneTracks) {
          var yShift = (totalGeneTracks + 1) * SD_1COL_HEIGHT + (SD_1COL_HEIGHT * 4);
          var PHENOTYPES_HEIGHT = 280;

          var actHeight = scope.phenotypes ? yShift + PHENOTYPES_HEIGHT : yShift;

          divParent.style('height', actHeight + "px");

          svgTarget.transition()
            .attr('height', actHeight);

          if (scope.showStatus) {
            statusBar.attr('transform', 'translate(0,' + (actHeight - SD_1COL_HEIGHT) + ")");
          }

          var extraShift = scope.showStatus ? 0 : SD_1COL_HEIGHT;
          var extraShiftInv = scope.showStatus ? SD_1COL_HEIGHT : 0;
          axis.selectAll('.tick line').attr('y2', yShift + extraShift - (SD_1COL_HEIGHT * 2));
          svgTarget.select('.barrier-line')
            .attr('y1', yShift - SD_1COL_HEIGHT)
            .attr('y2', yShift - SD_1COL_HEIGHT);

          svgTarget.selectAll('.sensitivityBorders')
            .attr('height', yShift - extraShiftInv);

          currentHeights = {
            geneWindowHeight: yShift,
            fullSVGHeight: actHeight
          };

          //console.log(currentHeights)
        }

        function drawBarrierLine() {
          svgTarget.append('line')
            .classed('barrier-line', true)
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', scope.width)
            .attr('y2', 0)
            .attr('stroke', '#d4d4d4')
            .attr('stroke-width', 1);
        }

        function drawSensitivityBorders() {
          var borders = svgTarget.append('g');

          var styleObj = {
            'fill': '#666666',
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
          for (var i = 0; i < geneData.length; i++) {
            var geneSymbol = geneData[i].gene.symbol;
            if (articleData.hasOwnProperty(geneSymbol)) {
              count = articleData[geneSymbol];
              start = +geneData[i].gene.start;
              end = +geneData[i].gene.end;
            }

            var mid = (start + end) / 2;
            if (isNaN(mid)) {
              continue;
            }
            res.push({
              gene: geneSymbol,
              articleCount: count,
              midLocation: (start + end) / 2
            });
          }

          return res;
        }

        function preprocessPhenoData(response) {
          //remove empty results from promise resolutions
          var res = response.filter(function (e) {
            return e === null ? false : true;
          });

          //if there are any phenotypes from OMIM
          if (res.length > 0) {

            //console.log(res);
            //console.log(res);
            var dataSet = [];
            for (var i = 0; i < res.length; i++) {


              var geneSymbol = res[i].symbol.toUpperCase()

              if (geneDB.hasOwnProperty(geneSymbol)) {
                dataSet.push(
                  {
                    'gene': geneDB[geneSymbol],
                    'phenotypes': res[i].phenotypes
                  }
                );
              }
            }

            dataSet = _.uniq(dataSet, function (n) {
              return n.gene.gene.symbol;
            });

            dataSet.sort(function (a, b) {
              if (+a.gene.gene.start < +b.gene.gene.start) {
                return -1;
              }
              if (+a.gene.gene.start > +b.gene.gene.start) {
                return 1;
              }
              return 0;
            });
            //console.log(dataSet);
            return dataSet;
          }
        }

        function drawPhenotypes(data, currentHeights) {

          phenotypeLoader.load(data)
            .catch(function (e) {
              console.log(e);
            })
            .then(domDraw);

          //Apply dom manipulation based on result
          function domDraw(response) {

            var data = preprocessPhenoData(response);

            var phenotypes = svgTarget.append('g')
              .classed('phenotypes', true)
              .attr('transform', 'translate(0,' + (currentHeights.geneWindowHeight - SD_1COL_HEIGHT) + ")")
              .selectAll('g')
              .data(data).enter().append('g');

            var totalPhenotypes = 0;
            for (var i =0; i<data.length;i++) {
              totalPhenotypes += data[i].phenotypes.length;
            }

            //console.log('g:',data.length, 'pheno',totalPhenotypes);

            //ESTIMATED
            var PX_PER_PHENOTYPE = 59;

            //too many single phenotypes to draw on the screen
            var overflow = (totalPhenotypes * PX_PER_PHENOTYPE) >= scope.width ? true : false;

            //console.log('geneDB', geneDB)

            var lasti = 0;

            //console.log('data',data)
            //console.log('phenotypes-d3',phenotypes);

            function drawPhenotype(lastPos, useCluster) {
              /*jshint validthis: true */

              var data = this.datum();

              //var d3gene = svgTarget.select("#gene_"+ data.gene.gene.symbol)[0][0];
              //var d3gene = d3.select(geneDB[data.gene.gene.symbol].d3Selection);
              var d3gene = svgTarget.select("#gene_"+ data.gene.gene.symbol);
              var geneX = +d3gene.attr('x');
              var geneY = +d3gene.attr('y');

              //d3gene.attr('width') returning wrong results for some reason. Manually recalculating width
              var geneWidth = (+scope.xscale(data.gene.gene.end)) - (+scope.xscale(data.gene.gene.start));

              //console.log(geneX, geneY, geneWidth);

              var margin = {
                top: 20
              };

              function appendPhenoText(text, xpos) {
                this.append('text')
                  .text(text)
                  .attr('transform', "translate(" + (xpos + 12) + "," + (margin.top + 15) +")rotate(25)");
              }

              var xpos = lastPos.xPOS += 50;

              this.append('line')
                .attr('stroke', '#d4d4d4')
                .attr('stroke-width', '1')
                .attr('x1', xpos)
                .attr('y1', margin.top)
                .attr('x2', geneX + (geneWidth / 2))
                .attr('y2', -(currentHeights.geneWindowHeight-SD_1COL_HEIGHT)+GENES_YSHIFT+geneY + 10);

              if(useCluster) {
                this.append('circle')
                  .attr('fill', '#d4d4d4')
                  .attr('r', 10)
                  .attr('cx', xpos)
                  .attr('cy', margin.top);

                var clusterCountOffset = data.phenotypes.length >= 10 ? 5 : 3;

                this.append('text')
                  .text(data.phenotypes.length)
                  .attr('x', xpos - clusterCountOffset)
                  .attr('y', margin.top + clusterCountOffset);

                appendPhenoText.call(this, data.gene.gene.symbol + ' cluster', xpos);

              } else {
                this.append('circle')
                  .attr('fill', function(d) {

                    var p1 = d.phenotypes[0].phenotypeMap.phenotype.charAt(0);
                    //color according to
                    if (p1 === '{') { //susceptibility
                      return "#CBBCDC";
                    }
                    else if (p1 === '?') { //unconfirmed
                      return "#C1DE77";
                    }
                    else if (p1 === '[') { //nondisease
                      return "#83DEC1";
                    }
                    else {
                      return "#E6B273";
                    }
                  })
                  .attr('r', 5)
                  .attr('cx', xpos)
                  .attr('cy', margin.top);

                appendPhenoText.call(this, data.phenotypes[0].phenotypeMap.phenotype, xpos);
              }

            }

            var lastPos = {
              'xPOS': -30
            };

            //Loop per gene of phenotypes
            for(var k = 0; k < phenotypes[0].length; k++) {
              var d = d3.select(phenotypes[0][k]);
              var totalPhenoTypes = d.data()[0].phenotypes.length;

              if (!overflow || totalPhenoTypes ===1) {
                //draw in expanded form
                drawPhenotype.call(d, lastPos, false);
              } else {
                //draw in a cluster
                drawPhenotype.call(d, lastPos, true);

              }
            }
          }

        }

        scope.render = function () {
          scope.selectorPhenotypes = [];
          init();
          if (scope.activeSelection.length > 0) {
            updateStatusText('Requesting ...');
            drawScale();
            drawBarrierLine();
            drawBands(scope.activeSelection);
            drawSensitivityBorders();
            scope.geneLoadPromise = geneLoader.getGenes(scope.chr, scope.boundFrom, scope.boundTo, function (data) {

              if (data.length === 0) {
                //console.log('no data');
                updateStatusText("No Data");
                return;
              }

              scope.g2pO = []; //for omim
              scope.g2pL = []; //for literature

              if (typeof data.err === 'undefined') {

                //var geneDataSet = new GeneManager(scope.boundFrom, scope.boundTo).process(data);
                var geneDataSet = geneManager.process(data, scope.boundFrom, scope.boundTo);

                var maxTrack = d3.max(geneDataSet, function (d) {
                  return d.track;
                });

                drawGenes(geneDataSet);
                updateContainerHeights(maxTrack);
                if (scope.phenotypes) {
                  drawPhenotypes(geneDataSet, currentHeights);
                }
                updateStatusText('Loaded: ' + scope.chr + ' [' + scope.boundFrom + " : " + scope.boundTo + '] Results: ' + geneDataSet.length);

                if (scope.articleStats) {
                  articleStatLoader.getArticleCount(extractGeneSymbol(geneDataSet), function (aCount) {
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
        this.getXscale = function () {
          return $scope.xscale;
        };
      }

      return {
        controller: controller,
        link: link,
        require: '^chromosome',
        restrict: 'AE',
        transclude: true,
        scope: {
          showStatus: '@',
          articleStats: '@',
          phenotypes: '@'
        },
        templateUrl: 'src/geneview-template.html'
      };
    }]);

})();