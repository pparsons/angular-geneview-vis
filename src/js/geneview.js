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
          SD_1COL_HEIGHT = 20;


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

          var GENES_YSHIFT = 34;

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
              .attr('transform', 'translate(0,' + currentHeights.geneWindowHeight + ")")
              .selectAll('g')
              .data(data).enter().append('g');

            var totalPhenotypes = 0;
            for (var i =0; i<data.length;i++) {
              totalPhenotypes += data[i].phenotypes.length;
            }

            console.log('g:',data.length, 'pheno',totalPhenotypes);

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
              console.log(data);

              var dgene = svgTarget.select("#gene_"+ data.gene.gene.symbol)[0][0];
              //console.log(dgene);


              var geneX = dgene.x.animVal.value;
              var geneY = dgene.y.animVal.value;
              var geneWidth = dgene.width.animVal.value;

              //console.log(geneX, geneY, geneWidth);


              //d3sel.append('text')
              //  .text(this.phenotypes[0].phenotypeMap.phenotype)
              //  .attr('transform', function(d) {
              //    return "translate(" + ((index * 50) + 30) + "," + 50 + ")rotate(25)";
              //  });
              //var retLast = {};

              var margin = {
                top: 20
              };

              function appendPhenoText(text, xpos) {
                this.append('text')
                  .text(text)
                  .attr('transform', "translate(" + (xpos + 12) + "," + (margin.top + 15) +")rotate(25)");
              }

              var xpos = lastPos.xPOS += 50;

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
                  .attr('cy', margin.top)

                appendPhenoText.call(this, data.phenotypes[0].phenotypeMap.phenotype, xpos);
              }
              //var ph = d3sel.append('g')
              //  .selectAll('circle').data(d.phenotypes).enter().append('g')
              //
              //  ph.append('circle')
              //  .attr('cx', function(d, i) {
              //    var n = last.circle += 50;
              //    retLast.circle = n;
              //
              //    return n;
              //  })
              //  .attr('cy', 20)
              //  .attr('r', 6)
              //  .attr('fill', 'steelblue');
              //
              //ph.append('text')
              //  .text(function(d){
              //    return d.phenotypeMap.phenotype;
              //  })
              //  .attr('transform', function(){
              //    var n = last.text += 50;
              //    last.text = n;
              //    return "translate(" + n + "," + (30+10) + ")rotate(25)";
              //  })
              //
              //return retLast;
            }

            //function drawPhenoCluster(d3sel, last, cluster) {
            //  var d = this;
            //
            //  var dgene = svgTarget.select("#gene_"+ this.gene.gene.symbol)[0][0];
            //  console.log(this);
            //
            //
            //  var geneX = dgene.x.animVal.value;
            //  var geneY = dgene.y.animVal.value;
            //  var geneWidth = dgene.width.animVal.value;
            //
            //  var retLast = {};
            //
            //  //
            //  d3sel.append('circle')
            //    .attr('cx', function() {
            //      var n = last.circle += 50;
            //      retLast.circle = n;
            //
            //      return n;
            //    })
            //    .attr('cy', 20)
            //    .attr('r', 6)
            //    .attr('fill', 'black')
            //
            //  d3sel.append('text')
            //    .text('cluster')
            //    .attr('transform', function(){
            //      var n = last.text += 50;
            //      last.text = n;
            //      return "translate(" + n + "," + (30+10) + ")rotate(25)";
            //    });
            //
            //
            //
            //}


            var lastPos = {
              'circle': 0,
              'text': 0,
              'xPOS': 0
            }

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

                console.log('overflow');
              }
            }

            //(function(){
            //  var res = response.filter(function (e) {
            //    return e === null ? false : true;
            //  });
            //  //sort phenotypes based on the start location of its associated gene
            //  res.sort(function (a, b) {
            //    if (a.start < b.start) {
            //      return -1;
            //    }
            //    if (a.start > b.start) {
            //      return 1;
            //    }
            //    return 0;
            //  });
            //
            //  //console.log(res);
            //
            //  var startHeight = currentHeights.geneWindowHeight + 10;
            //
            //  var margin = {top: 50, right: 10, bottom: 10, left: 10},
            //    width = 960 - margin.left - margin.right,
            //    height = 200 - margin.top - margin.bottom;
            //
            //  var t = _.pluck(res, 'phenotypes');
            //  var phenotypes = _.pluckDeep(_.flatten(t), 'phenotypeMap.phenotype'); //list of phenotypes
            //
            //  var names = svgTarget.append("g")
            //    .selectAll('text')
            //    .data(phenotypes)
            //    .enter()
            //    //.append('g')
            //    .append('text')
            //    .attr("font-size", "12px")
            //    .text(function (d) {
            //      return d;
            //    })
            //    .attr("transform", function (d, i) {
            //      return "translate(" + ((i * 50) + 30) + "," + (startHeight + 10) + ")rotate(25)";
            //    });
            //
            //  var lineFunction = d3.svg.line()
            //    .x(function (d) {
            //      return d.x;
            //    })
            //    .y(function (d) {
            //      return d.y;
            //    })
            //    .interpolate("linear");
            //
            //  var currentPhen = "";
            //  var currentMapping = "";
            //
            //  var linetest = svgTarget.append("g")
            //    .selectAll('path')
            //    .data(phenotypes)
            //    .enter()
            //    .append("path")
            //    .attr("d", function (d, i) {
            //      //get location of related gene
            //      var geneXVal, geneYVal;
            //      currentPhen = d;
            //
            //
            //      _.forEach(res, function (b) {
            //        currentMapping = b;
            //        _.forEach(b.phenotypes, function (c) {
            //          if (c.phenotypeMap.phenotype === currentPhen) {
            //            //now we want to get location of gene
            //            var g = currentMapping.symbol; //gene we want
            //            //var se = scope.gene.filter(function(d) {
            //            //	return d.gene.symbol === g;
            //            //})
            //            var genes = d3.selectAll(".gene").filter(function (d) {
            //              return d.gene.symbol.toUpperCase() === g.toUpperCase();
            //            }); //all the gene elements
            //            var geneWidth = genes[0][0].width.animVal.value;
            //            geneXVal = genes[0][0].x.animVal.value + geneWidth / 2;
            //            geneYVal = genes[0][0].y.animVal.value + 45; //TODO calculate this properly
            //          }
            //        });
            //      });
            //      return lineFunction([{'x': (i * 50 + 20), 'y': startHeight}, {'x': geneXVal, 'y': geneYVal}]);
            //    })
            //    .attr("stroke", function (d) {
            //      return "steelblue";
            //      //TODO encode according to omim type?
            //    })
            //    .attr("stroke-width", 1)
            //    .style("opacity", 0.3)
            //    .attr("fill", "none")
            //    .on('mouseover', function (d) {
            //      d3.select(this)
            //        .style("opacity", 1);
            //    })
            //    .on('mouseout', function (d) {
            //      d3.select(this)
            //        .style("opacity", 0.3);
            //    });
            //
            //  var circles = svgTarget.append("g")
            //    .selectAll('circle')
            //    .data(phenotypes)
            //    .enter()
            //    .append('circle');
            //
            //  circles.attr("cx", function (d, i) {
            //    return (i * 50) + 20;
            //  })
            //    .attr("cy", startHeight)
            //    .attr("r", 5)
            //    .attr("fill", function (d) {
            //      //color according to
            //      if (d.charAt(0) === '{') { //susceptibility
            //        return "#CBBCDC";
            //      }
            //      else if (d.charAt(0) === '?') { //unconfirmed
            //        return "#C1DE77";
            //      }
            //      else if (d.charAt(0) === '[') { //nondisease
            //        return "#83DEC1";
            //      }
            //      else {
            //        return "#E6B273";
            //      }
            //    });
            //})(response);

            //if there any phenotypes from the literature
            //if (scope.g2pL.length > 0) {
            //  scope.mappingsL = _.map(scope.g2pL, function (a, key) {
            //    var b = {};
            //    b.symbol = a.symbol;
            //    b.phenotypes = a.phenotypes;
            //    return b;
            //  });
            //  var a;
            //}
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