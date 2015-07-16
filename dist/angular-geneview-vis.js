!function(){
"use strict";
(function () {
  "use strict";
  angular
    .module('geneview', [])
    .provider("geneview", function() {
      this.version = "0.2.5";

      this.setServer = function(newServer) {
        this.server = newServer;
      };

      this.setGeneClickAction = function(actionArg) {
        this.geneClickAction = actionArg;
      };

      this.setGeneContextMenu = function(actionArg) {
        this.geneContextMenu = actionArg;
      };

      this.setPhenotypeClickAction = function(actionArg) {
        this.phenotypeClickAction = actionArg;
      };

      this.setPhenotypeContextMenu = function(actionArg) {
        this.phenotypeContextMenu = actionArg;
      };

      this.$get = function() {
        return this;
      };

    });
}());

/*global angular, d3*/
(function () {
  "use strict";
  angular
    .module('geneview')
    //Load genes based on chromosome start and end location
    .factory('geneLoader', ['$http', "geneview", function ($http, config) {

      return {
        getGenes: function (chr, start, stop, callID, cb) {
          var params = {
            chr: chr,
            start: start,
            stop: stop
          };

          return $http({
            method: 'GET',
            url: '//' + config.server + '/getgenes.php',
            params: params,
            responseType: 'json',
            cache: true
          })
            .success(function (data, status, headers, config) {
              cb(data, callID.id);
            })

            .error(function (data, status, headers, config) {
              //handle error here
              cb({err: "Failed to load genes. Connection failed."});
            });
        }
      };
    }])

    //Mange gene results; calculate their track to draw
    .factory('geneManager', [function () {
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
        var collide;
        for (var i = 0; i < geneDB.length; i++) {
          collide = false;
          for (var j = 0; j < geneDB[i].length; j++) {
            var gene = geneDB[i][j];
            if (gene.stop >= start && gene.start <= stop) {
              trackNo++;
              collide = true;
              break;
            }
          }
          if(!collide) {
            return trackNo;
          }
        }
        return trackNo;
      }

      // Register a gene location
      // Return its available track to display
      function register(gene) {
        var trackNo = findFreeTrack(gene.start, gene.stop);

        if (typeof geneDB[trackNo] === 'undefined') {
          geneDB[trackNo] = [];
        }
        geneDB[trackNo].push(gene);

        return trackNo;
      }

      // Process a data set
      // Return sanitized, wrapped data
      function process(data, boundFrom, boundTo) {

        //reset cache from previous calls 
        if(geneDB.length !== 0) { geneDB.length = 0; }

        var sanData = [];

        function isBadVar(res) {
          //console.log(boundTo, boundFrom);
          return ((res === null) || (typeof res === 'undefined') || (res === ''));
        }

        for (var i = data.length - 1; i >= 0; i--) {
          var start = data[i].start;
          var end = data[i].end;

          //remove bad data, and data slightly out of entire search range
          if (isBadVar(start) || isBadVar(end) || start >= boundTo || end <= boundFrom) {
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
          nModel.track = register({
            start: +data[i].start,
            stop: +data[i].end
          });
          sanData.push(nModel);
        }

        return sanData;
      }

      return {
        process: process
      };
    }])

    //return array of promisses containing phenotype info
    .factory('phenotypeLoader', ['$q', '$http', "geneview", function ($q, $http, config) {
      var http = {
        omim: function (gene) {
          return $http({
            method: 'get',
            url: '//' + config.server + '/gen2phen.php',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            params: {'gene': gene}
          });
        }
      };

      function loadPhenotypes(data) {

        var promises = [];

        //loop through each result
        for (var i = 0; i < data.length; i++) {
          (function () {
            var defer = $q.defer();

            // get associated phenotypes for each
            var promise = http.omim(data[i].gene.symbol)
              .then(function (res) {

                //resolve bad data to null
                var data = null;

                try {
                  //if there is a result
                  if (res.data.omim.searchResponse.endIndex !== -1) {
                    var gene = res.data.omim.searchResponse.entryList[0].entry;
                    //if there is a related phenotype(s)

                    if (typeof gene.geneMap !== 'undefined' && typeof gene.geneMap.phenotypeMapList !== 'undefined') {
                      var symbol = gene.matches;
                      var phenotypes = gene.geneMap.phenotypeMapList;
                      var geneStart = gene.geneMap.chromosomeLocationStart;
                      //scope.g2pO.push({'symbol': symbol, 'phenotypes': phenotypes, 'start':geneStart});
                      data = {'symbol': symbol, 'phenotypes': phenotypes, 'start': geneStart};
                    }

                  }
                }
                catch (e) {
                  defer.resolve(null);
                }

                defer.resolve(data);
                return defer.promise;
              });
            promises.push(promise);

          })(i);
        }//end for
        return $q.all(promises);

      }

      return {
        load: loadPhenotypes
      };
    }])

    //Load article statistics for an array of genes
    .factory('articleStatLoader', ['$http', 'geneview', function ($http, geneviewconfig) {

      return {
        getArticleCount: function (genes, cb) {
          return $http.get('//129.100.19.193' + '/soscip/api/genearticlestats.php?genes=' + genes)
            .success(function (d) {
              cb(d);
            });
        }

      };
    }]);
})();

/*global angular, d3, _, console*/
(function () {
  "use strict";
  angular
    .module('geneview')
    .directive('geneview', ['cytochromosome','geneview','geneLoader', 'phenotypeLoader', 'articleStatLoader', 'geneManager', function (cytochromosome, config, geneLoader, phenotypeLoader, articleStatLoader, geneManager) {

      function link(scope, element, attrs, chrAPI) {
        var
          svgTarget,

          //Barrier lines to separate components
          geneline,
          detailLine,

          axis,
          statusBar,
          statusText,
          geneTip,
          phenoTip,
          gvmapContainer,

          // Immediate div containing target svg
          divParent,

          //Active dom heights, updated by updateContainerHeights()
          currentHeights,

          geneDB = {};

        var
        // Fixed one unit of height in px
          SD_1COL_HEIGHT = 20,
          GENES_YSHIFT = 34,
          PHENOTYPES_HEIGHT = 225,
          DETAIL_WIN_HEIGHT = 160;

        var chr = cytochromosome.build();

        chr.target(d3.select(element[0]).select('.chromosome'))
          .segment(scope.chr)
          .height(17)
          .resolution(550)
          .useRelative(false)
          .showAxis(true)
          .render();

        function updateRender() {
          scope.render();
          var s = chr.getSelections()[0];
          scope.updateSelectorMap([+s.start, +s.stop]);
        }

        chr.on('bandclick', function(d) {
          updateRender();
          scope.$emit('bandclick', d);
        });

        chr.on('selectorend', function(d){
          scope.render();
          scope.$emit('selectorend', d);
        });

        chr.on('selectordelete', function(d){
          init();
          gvmapContainer.remove();
          gvinit = false;
          scope.$emit('selectordelete', d);
        });

        scope.$on('geneview:render', function(e, a) {
          chr
            .segment(a.segment)
            .resolution(a.resolution)
            .showAxis(a.showAxis)
            .useRelative(a.relativeSize)
            .render();
          gvinit = false;
        });

        chr.on("selectorchange", function(d) {
          scope.updateSelectorMap(d);
          scope.$emit('selectorchange', d);
        });

        scope.$on('geneview:updateselector', function(e, d) {
          chr.moveSelectorTo(d.start, d.stop);
          updateRender();
        });

        function getSensitivityValue(start, end) {
          var defaultMax = 1000000;
          var s = (end - start) * 0.10;
          return s > defaultMax ? defaultMax : s;
        }

        function chrgvmap() {
          var chrTarget = chr.getSVGTarget();
          gvmapContainer = chrTarget.append('g')
            .classed('geneview-map', true)
            .attr('transform', 'translate(0,' + 60 + ")");

          var gvpoly = gvmapContainer.append('polygon');

          var chrmax = chr.getMaxBasepair();

          var chrScale = d3.scale.linear()
            .domain([1, chrmax])
            .range([0, scope.width]);

          var gvScale = d3.scale.linear()
            .range([0, +scope.width]);

          scope.updateSelectorMap = function (arg) {
            var selStart = arg[0];
            var selStop = arg[1];
            var sensitivity = Math.round(getSensitivityValue(selStart, selStop));

            var ds = selStart - sensitivity;
            var de = selStop + sensitivity;
            gvScale.domain([ds, de]);

            //TODO calculate/ get actual values than hardcode
            var
              p1x = chrScale(selStop),
              p1y = 0,

              p2x = chrScale(selStart) + 14,
              p2y = 0,

              p3x = gvScale(selStart),
              p3y = 19,

              p4x = gvScale(selStop),
              p4y = 19;

            gvpoly.attr('points', p1x + "," + p1y + " " + p2x + "," + p2y + " " + p3x + "," + p3y + " " + p4x + "," + p4y)
              .style({
                "fill": "#666666",
                "opacity": 0.3,
                "stroke": "black",
                "stroke-width" : 1
              });
          }
        }

        var gvinit = false;

        function initgvmap () {
          if(!gvinit) {
            chrgvmap();
            gvinit = true;
          }
        }


        var init = function () {

          var selectionModel = chr.getSelections();

          scope.displayGeneview = true;
          scope.articleStats = (scope.articleStats === true) ? true : (scope.articleStats === 'true');
          scope.phenotypes = (scope.phenotypes === true) ? true : (scope.phenotypes === 'true');
          scope.detailWindow = (scope.detailWindow === true) ? true : (scope.detailWindow === 'true');

          scope.selectorStart = +selectionModel[0].start;
          scope.selectorEnd = +selectionModel[0].stop;
          scope.sensitivity = getSensitivityValue(scope.selectorStart, scope.selectorEnd);
          scope.activeSelection = chr.getSelectedBands(scope.sensitivity);
          scope.boundFrom = +selectionModel[0].start - scope.sensitivity;
          scope.boundTo = +selectionModel[0].stop + scope.sensitivity;
          scope.width = chr.width();
          scope.chr = chr.segment();
          scope.height = 120;
          scope.showStatus = (scope.showStatus === true) ? true : (scope.showStatus === 'true');


          scope.xscale = d3.scale.linear()
            .range([0, +scope.width])
            .domain([scope.boundFrom, scope.boundTo]);

          initgvmap();

          divParent = d3.select(element[0]).select('.angular-geneview-vis')
            .style('height', scope.height + 'px')
            .style('width', scope.width + 'px');

          divParent.select('svg').remove();

          svgTarget = divParent.append('svg')
            .attr('height', scope.height)
            .attr('width', scope.width);

          geneTip = d3.tip()
            .attr('class', 'd3-tip')
            .direction('n')
            .offset([-8, 0])
            .html(function (d) {
              var tiptemp = '<div class="gene-tip"><span style="color:#ffb006">' + d.gene.symbol + "</span> <div>" + d.gene.desc + "</div></div> ";
              return tiptemp;
            });

          phenoTip = d3.tip()
            .attr('class', 'd3-tip')
            .direction('w')
            .offset([-15,-35])
            .html(function(d){
              var t = '';
              d.phenotypes.forEach(function(v, i) {
                t+= '<div>'+ (++i) +'. '+ v.phenotypeMap.phenotype + '</div>';
              });

              return t;
            });

          svgTarget.call(geneTip);
          svgTarget.call(phenoTip);

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
            .attr('x', function (d) {
              return scope.xscale(+d.bp_start);
            })
            .attr('height', SD_1COL_HEIGHT)
            .attr('width', function (d) {
              return scope.xscale(d.bp_stop) - scope.xscale(d.bp_start);
            })
            .style({
              'stroke' : '#d9d9d9',
              'stroke-width': '0.5'
            })
            .style('fill', function(d){
              return cyto_chr.getStainColour(d.stain, d.density);
            });

          band.append('text')
            .text(function (d) {
              var bandw = scope.xscale(d.bp_stop) - scope.xscale(d.bp_start);
              if (bandw < LABEL_WIDTH) {
                return "";
              }

              return d.arm + d.band;
            })
            .attr('x', function (d) {

              var s = +d.bp_start < scope.boundFrom ? scope.boundFrom : +d.bp_start;
              var e = +d.bp_stop < scope.boundTo ? +d.bp_stop : scope.boundTo;
              var mid = s + ((e - s) / 2);
              return scope.xscale(mid) - (LABEL_WIDTH / 2);
            })
            .attr('y', 13)
            .style('fill', function(d) {
              if(d.stain === "gpos" || +d.density > 50 || d.stain === "acen") {
                return "#ededed";
              }
            });

        }

        function updateStatusText(text, append) {
          if (scope.showStatus) {
            if(append) {
              var prev = statusText.text();
              statusText.text(prev + text);
            } else {
              statusText.text(text);
            }
          }
        }

        function drawStatusBar() {

          if (scope.showStatus) {
            statusBar = svgTarget.append('g')
              .attr('transform', 'translate(0,' + (scope.height - SD_1COL_HEIGHT) + ")");

            statusBar.append('rect')
              .classed('geneview-statusbar', true)
              .attr('fill', '#ededed')
              .attr('width', scope.width - 2)
              .attr('height', SD_1COL_HEIGHT - 2);

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

          genes
            .on('mouseover', function (d) {
              geneTip.show(d, this);
            })
            .on('mouseout', geneTip.hide)
            .on('click', function (d) {
              updateDetailInfo({gene:d}, -1);
            })
            .on('contextmenu', function(d) {
              if (typeof config.geneContextMenu !== 'undefined') {
                d3.contextMenu(config.geneContextMenu)(d);
              }
            });
          //.on('contextmenu', d3.contextMenu(menu))
          //.on('mousedown', d3.contextMenu(menu));

          //update geneDB
          genes.each(function(d) {
            geneDB[d.gene.symbol] = d;
            //geneDB[d.gene.symbol].d3Selection = this;
          });

          geneline = drawBarrierLine.call(svgTarget, 0);
        }

        function updateContainerHeights(totalGeneTracks) {
          var yShift = (totalGeneTracks + 1) * SD_1COL_HEIGHT + (SD_1COL_HEIGHT * 4);

          var actHeight = scope.phenotypes ? yShift + PHENOTYPES_HEIGHT : yShift;

          if(scope.detailWindow) {
            actHeight += DETAIL_WIN_HEIGHT;
          }

          divParent.style('height', actHeight + "px");

          svgTarget.transition()
            .attr('height', actHeight);

          if (scope.showStatus) {
            statusBar.attr('transform', 'translate(0,' + (actHeight - SD_1COL_HEIGHT) + ")");
          }

          var extraShift = scope.showStatus ? 0 : SD_1COL_HEIGHT;
          var extraShiftInv = scope.showStatus ? SD_1COL_HEIGHT : 0;
          axis.selectAll('.tick line').attr('y2', yShift + extraShift - (SD_1COL_HEIGHT * 2));

          function updateBarrierLines(y) {
            /*jshint validthis: true */

            if(this !== undefined) {
              this.attr('y1', y);
              this.attr('y2', y);
            }
          }

          updateBarrierLines.call(geneline, yShift - SD_1COL_HEIGHT);

          if(scope.detailWindow) {
            updateBarrierLines.call(detailLine, actHeight - DETAIL_WIN_HEIGHT);
          }

          svgTarget.selectAll('.sensitivityBorders')
            .attr('height', yShift - extraShiftInv);

          currentHeights = {
            geneWindowHeight: yShift,
            fullSVGHeight: actHeight
          };

        }

        function drawBarrierLine(ycoord) {
          return this.append('line')
            .attr('x1', 0)
            .attr('y1', ycoord)
            .attr('x2', scope.width)
            .attr('y2', ycoord)
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
          var dataSet = [];
          //remove empty results from promise resolutions
          var res = response.filter(function (e) {
            return e === null ? false : true;
          });

          //if there are any phenotypes from OMIM
          if (res.length > 0) {

            //console.log(res);
            //console.log(res);
            for (var i = 0; i < res.length; i++) {

              var geneSymbol = res[i].symbol.toUpperCase();

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
                return 1;
              }
              if (+a.gene.gene.start > +b.gene.gene.start) {
                return -1;
              }
              return 0;
            });
          }
          return dataSet;
        }

        function blackText() {
          d3.select(this)
            .style('cursor', 'default')
            .style('fill', 'black');
        }

        function highlightText() {
          d3.select(this)
            .style('cursor', 'pointer')
            .style('fill', 'steelblue');
        }

        function drawPhenotypes(data, currentHeights) {
          var totalPhenotypes = 0;

          phenotypeLoader.load(data)
            .catch(function (e) {
              console.log(e);
            })
            .then(domDraw);

          //Apply dom manipulation based on result
          function domDraw(response) {

            var data = preprocessPhenoData(response);

            var phenotypes = svgTarget.append('g')
              .attr('transform', 'translate(0,' + (currentHeights.geneWindowHeight - SD_1COL_HEIGHT) + ")")
              .selectAll('g')
              .data(data).enter()
              .append('g')
              .classed('phenotype', true);

            for (var i =0; i < data.length;i++) {
              totalPhenotypes += data[i].phenotypes.length;
            }

            //ESTIMATED
            var PX_PER_PHENOTYPE = 59;

            //too many single phenotypes to draw on the screen
            var overflow = (totalPhenotypes * PX_PER_PHENOTYPE) >= scope.width ? true : false;

            function drawPhenotype(lastPos, useCluster) {
              /*jshint validthis: true */

              var data = this.datum();

              var d3gene = svgTarget.select("#gene_"+ data.gene.gene.symbol);

              try {
                var geneX = +d3gene.attr('x');
                var geneY = +d3gene.attr('y');
              } catch(e) {
                return;
              }



              var geneWidth = (+scope.xscale(data.gene.gene.end)) - (+scope.xscale(data.gene.gene.start));

              var margin = {
                top: 20
              };

              var lineCache = [];

              var xpos;

              function appendPhenoText(text, i, xpos, cluster) {

                var data = this.datum();

                var geneData = data.gene;
                var domgene = svgTarget.select('#gene_' + geneData.gene.symbol)[0][0];


                function hideDetails(i) {

                  phenoTip.hide();
                  geneTip.hide(geneData, domgene);
                  blackText.call(this);
                  lineCache[i].attr('stroke', '#d4d4d4');
                }

                function showDetails(d, i) {

                  lineCache[i].attr('stroke', 'steelblue');

                  highlightText.call(this);

                  if(cluster) {
                    phenoTip.show(d);
                  }

                  geneTip.show(geneData, domgene);
                }

                var ptext = this.append('text')
                  .text(text)
                  .attr('transform', "translate(" + (xpos + 12) + "," + (margin.top + 15) + ")rotate(25)")

                  if (scope.detailWindow) {
                    ptext.on('mouseover', function (d) {
                      showDetails.call(this, d, i);
                    })
                      .on('mouseout', function () {
                        hideDetails.call(this, i);
                      })
                      .on('click', function (d) {
                        updateDetailInfo(d, i);
                      }).on('contextmenu', function (d) {

                        var menu = [];

                        function makeItem(title, i) {
                          return {
                            title: title,
                            action: function () {
                              updateDetailInfo(d, i);
                            }
                          };
                        }

                        for (var j = 0; j < data.phenotypes.length; j++) {
                          var p = data.phenotypes[j].phenotypeMap;

                          menu.push(makeItem(p.phenotype, j));
                        }

                        d3.contextMenu(menu)(d, i);
                      });
                  }


              }

              function drawline() {
                return this.append('line')
                  .attr('stroke', '#d4d4d4')
                  .attr('stroke-width', '1')
                  .attr('x1', xpos)
                  .attr('y1', margin.top)
                  .attr('x2', geneX + (geneWidth / 2))
                  .attr('y2', -(currentHeights.geneWindowHeight-SD_1COL_HEIGHT)+GENES_YSHIFT+geneY + 10);
              }

              if (useCluster) {
                xpos = lastPos.xPOS += 50;

                lineCache.push(drawline.call(this));

                this.append('circle')
                    .attr('fill', '#666666')
                    .attr('r', 10)
                    .attr('cx', xpos)
                    .attr('cy', margin.top);

                  var clusterCountOffset = data.phenotypes.length >= 10 ? 5 : 3;

                  this.append('text')
                    .text(data.phenotypes.length)
                    .attr('fill', 'white')
                    .attr('x', xpos - clusterCountOffset)
                    .attr('y', margin.top + clusterCountOffset);

                  appendPhenoText.call(this, data.gene.gene.symbol + ' cluster', 0, xpos, true);

              } else {

                for(var i = 0; i < data.phenotypes.length; i++) {

                  var p = data.phenotypes[i].phenotypeMap;

                  xpos = lastPos.xPOS += 50;

                  lineCache.push(drawline.call(this));

                  this.append('circle')
                    .attr('fill', function(d) {
                      return getPhenoColor(d.phenotypes[i].phenotypeMap.phenotype);
                    })
                    .attr('r', 5)
                    .attr('cx', xpos)
                    .attr('cy', margin.top);

                  appendPhenoText.call(this, data.phenotypes[i].phenotypeMap.phenotype, i, xpos, false);
                }
              }
            }

            var lastPos = {
              'xPOS': -30
            };

            if (!overflow) {
              lastPos.xPOS = (scope.width - (totalPhenotypes * PX_PER_PHENOTYPE)) / 2;
            } else {
              lastPos.xPOS = (scope.width - (data.length * PX_PER_PHENOTYPE)) / 2;
            }

            if (lastPos.xPOS < -30) {
              lastPos.xPOS = -30;
            }

            //Loop per gene of phenotypes
            for(var k = phenotypes[0].length -1; k >= 0; k--) {
              var d = d3.select(phenotypes[0][k]);
              var totalPhenoTypes = d.datum().phenotypes.length;

              if (!overflow || totalPhenoTypes ===1) {
                //draw in expanded form
                drawPhenotype.call(d, lastPos, false);
              } else {
                //draw in a cluster
                drawPhenotype.call(d, lastPos, true);

              }
            }

            updateStatusText(' Phenotypes: ' + totalPhenotypes, true);
          }
        }

        function getPhenoColor(p) {
          var p1 = p.charAt(0);
          //color according to
          if (p1 === '{') { //susceptibility
            return "#E9AEC8";
          }
          else if (p1 === '?') { //unconfirmed
            return "#C5DB76";
          }
          else if (p1 === '[') { //nondisease
            return "#C5DB76";
          }
          else {
            return "#9ECEE4";
          }
        }

        function getPhenoDisorderType(p) {
          var p1 = p.charAt(0);
          //color according to
          if (p1 === '{') { //susceptibility
            return "Susceptibility to multifactorial disorders or to infection";
          }
          else if (p1 === '?') { //unconfirmed
            return "Unconfirmed";
          }
          else if (p1 === '[') { //nondisease
            return "Nondiease";
          }
          else {
            return "N/A";
          }
        }


        var dwObjects = {};

        //i is the index to the particular phenotype of a clustered set
        function updateDetailInfo(model, i) {

          var gene = model.gene.gene;


          var gsa = gene.synonyms.split(', ');
          var desc = gene.desc.split(' ');

          var gsy_1 = gsa.slice(0, 8).join(', ');
          var gsy_2 = gsa.slice(8, gsa.length).join(', ');

          var dsa_1 = desc.slice(0, 8).join(' ');
          var dsa_2 = desc.slice(8, desc.length).join(' ');

          dwObjects.gst1.text(gsy_1);
          dwObjects.gst2.text(gsy_2);

          dwObjects.gd1.text(dsa_1);
          dwObjects.gd2.text(dsa_2);

          dwObjects.geneTitle.text(gene.symbol);

          //dwObjects.geneDesc.text(gene.desc);
          dwObjects.geneLoci.text(gene.cytloc + ' [' + gene.start + ' - ' + gene.end + ']');
          dwObjects.lrect.style('fill', '#ffb006');

          if(i >= 0) {
            var pheno = model.phenotypes[i].phenotypeMap;
            dwObjects.phenoSymbol.text(pheno.phenotype)
              .on('click', function() {
                config.phenotypeClickAction(pheno);
              });

            dwObjects.phenoType.text('Disorder: ' + getPhenoDisorderType(pheno.phenotype));
            dwObjects.phenoInheritance.text('Inheritance: ' + (pheno.phenotypeInheritance === null ? "N/A" : pheno.phenotypeInheritance));
            //dwObjects.cline.style('stroke', 'black');
            dwObjects.rrect.style('fill', getPhenoColor(pheno.phenotype));
            dwObjects.rrect.attr('width', 15);

          } else {
            //only gene is clicked, clear pheno texts
            dwObjects.phenoSymbol.text("");
            dwObjects.phenoType.text("");
            dwObjects.phenoInheritance.text("");
            dwObjects.rrect.attr('width', 0);

          }
        }

        function drawDetailWindow() {
          var dv = svgTarget.append('g')
            .attr('transform', 'translate(0,' + (currentHeights.fullSVGHeight - DETAIL_WIN_HEIGHT)+")");

          var dv_t = dv.append('g')
            .attr('transform', 'translate(35,0)');


          drawBarrierLine.call(svgTarget, currentHeights.fullSVGHeight - DETAIL_WIN_HEIGHT);

          function drawText(x, y, size, testtext) {
            return dv_t.append('text')
              .style('font-size', size + 'px')
              .attr('x', x)
              .attr('y', y);
          }

          var geneX = 0;
          var geneY = 30;
          var phenoX = 430;
          var phenoY = 30;

          dwObjects.lrect = dv.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 15)
            .attr('height', DETAIL_WIN_HEIGHT - 20)
            .style('fill', '#ffb006')
            .style('fill', 'white');


          dwObjects.geneTitle = drawText(geneX, geneY, 15, "GHR")
            .on('mouseover', function () {
              highlightText.call(this);
            })
            .on('mouseout', function () {
              blackText.call(this);
            })
            .on('click', function () {
              var title = d3.select(this).text();
              var d = geneDB[title].gene;

              if(typeof config.geneClickAction === 'function') {
                config.geneClickAction(d);
              }
            })
            .on('contextmenu', function() {
              var title = d3.select(this).text();
              var d = geneDB[title].gene;
              if (typeof config.geneContextMenu !== 'undefined') {
                d3.contextMenu(config.geneContextMenu)(d);
              }
            });

          dwObjects.geneSynonyms = drawText(geneX, geneY, 11, "GHAR, ADER");

          dwObjects.gst1 = dwObjects.geneSynonyms.append('tspan')
            .attr('x', 0)
            .attr('y', geneY + 5)
            .attr('x','0')
            .attr('dy', '1.2em');
          dwObjects.gst2 = dwObjects.geneSynonyms.append('tspan')
            .attr('x', 30)
            .attr('y', geneY + 20)
            .attr('x','0')
            .attr('dy', '1.2em');

          dwObjects.geneDesc = drawText(geneX, geneY + 45, 11, "long dexcla;ksdjf;lask ");

          dwObjects.gd1 = dwObjects.geneDesc.append('tspan')
            .attr('x', 0)
            .attr('y', geneY + 45)
            .attr('x','0')
            .attr('dy', '1.2em');
          dwObjects.gd2 = dwObjects.geneDesc.append('tspan')
            .attr('x', 0)
            .attr('y', geneY + 60)
            .attr('x','0')
            .attr('dy', '1.2em');

          dwObjects.geneLoci = drawText(geneX, geneY + 90, 11, ":1232 p3232");

          dwObjects.phenoSymbol = drawText(phenoX , phenoY, 13, "Mental retardation, autosoman recessive")
            .on('mouseover', function () {
              highlightText.call(this);
            })
            .on('mouseout', function () {
              blackText.call(this);
            })
            .on('contextmenu', function() {
              if (typeof config.phenotypeContextMenu !== 'undefined') {
                var d = d3.select(this).text();
                d3.contextMenu(config.phenotypeContextMenu)(d);
              }
            });

          dwObjects.phenoType = drawText(phenoX, phenoY + 30, 11, "Disorder: nondisease");
          dwObjects.phenoInheritance = drawText(phenoX, phenoY + 45, 11, "Inheritance: Autosomal Dominant");

          dwObjects.rrect = dv.append('rect')
            .attr('x', phenoX - 5)
            .attr('y', 0)
            .attr('width', 15)
            .attr('height', DETAIL_WIN_HEIGHT - 20)
            .style('fill', 'white');

        }

        //Create unique callid for each http request.
        //This avoids a race condition where two or more requests are made at the same time,
        //and multiple results are drawn incorrectly / overlapping
        var calls = 0;
        var newestCallID = 0;

        function CallID (id) {
          this.id = id;
        }

        scope.render = function () {

          init();

          if (scope.activeSelection.length > 0) {

            updateStatusText('Requesting ...', false);
            drawScale();

            drawBands(scope.activeSelection);
            drawSensitivityBorders();

            var callid = new CallID(++calls);
            scope.geneLoadPromise = geneLoader.getGenes(scope.chr, scope.boundFrom, scope.boundTo, callid, function (data, id) {

              //Old request call detected, abort drawing
              if(id < newestCallID) {
                return;
              }

              if (data.length === 0) {
                updateStatusText("No Data", false);
                return;
              }

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

                if (scope.detailWindow) {
                  drawDetailWindow();
                }

                var s = scope.boundFrom < 0 ? 0 : scope.boundFrom;
                var e = scope.boundTo > scope.selectorEnd ? scope.selectorEnd : scope.boundTo;
                updateStatusText('Loaded: CHR:' + scope.chr + ' [' + s+ ": " + e + '] Genes: ' + geneDataSet.length);

                if (scope.articleStats) {
                  articleStatLoader.getArticleCount(extractGeneSymbol(geneDataSet), function (aCount) {
                    scope.articleData = processGeneArticleData(geneDataSet, aCount);
                  });

                }

              } else {
                updateStatusText(data.err);
              }
            });
            newestCallID = callid.id;
          }
          else {
            updateStatusText("No active selectors");
          }
        };
      }

      function controller($scope) {
        /*jshint validthis:true */
        this.getXscale = function () {
          return $scope.xscale;
        };
      }

      return {
        controller: controller,
        link: link,
        restrict: 'E',
        transclude: true,
        scope: {
          chr: '@',
          showStatus: '@',
          articleStats: '@',
          phenotypes: '@',
          detailWindow: '@'
        },
        template: "<div class='chromosome'></div><div class='angular-geneview-vis' ng-show='displayGeneview' cg-busy='{promise:geneLoadPromise, message:&quot; Retrieving Data &quot;}'></div><div><article-view class='article-view-e' data='articleData' ng-show='articleStats && displayGeneview' width='width'></article-view></div>"
        //templateUrl: '../src/geneview-template.html'
      };
    }]);

})();
/*global angular, d3*/
(function () {
  "use strict";
  angular
    .module('geneview')
    .directive('articleView', ['articleStatLoader', function (articleStatLoader) {
      return {
        restrict: 'AE',
        require: '^geneview',
        scope: {
          data: '=',
          width: '='
        },
        link: function (scope, element, attrs, geneviewAPI) {

          var xscale, height = 60, articleTip;
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
            .attr("transform", "translate(" + 10 + "," + (height - 3) + ") rotate(-90)");

          var line = d3.svg.line();

          var yscale = d3.scale.linear()
            .range([margin.top, height - margin.bottom]);

          //render updated data
          scope.$watch('data', function (data) {
            if (typeof data !== 'undefined') {
              target.attr('width', scope.width);

              data.sort(function (a, b) {
                if (a.midLocation < b.midLocation) {
                  return -1;
                }
                if (a.midLocation > b.midLocation) {
                  return 1;
                }
                return 0;
              });

              var maxArticleCount = d3.max(data, function (d) {
                return d.articleCount;
              });
              yscale.domain([0, maxArticleCount]);
              xscale = geneviewAPI.getXscale();

              ylAxis.scale(yscale);

              g.call(ylAxis);

              line.x(function (d) {
                return xscale(d.midLocation);
              })
                .y(function (d) {
                  return yscale(d.articleCount);
                });

              target.selectAll('.line').remove();
              target.selectAll('.article-dots').remove();

              target.append("path")
                .datum(data)
                .classed('line', true)
                .attr('d', line);

              var gene = target.append('g')
                .classed('article-dots', true)
                //.attr('transform', 'translate(0,' + 0 + ")")
                .selectAll('g')
                .data(data).enter()
                .append('g');

              //console.log(data);

              gene.append('circle')
                .attr('r', 3)
                .attr('cx', function (d) {
                  return xscale(d.midLocation);
                })
                .attr('cy', function (d) {
                  return yscale(d.articleCount);
                })
                .attr('fill', 'orange');

              articleTip = d3.tip()
                .attr('class', 'd3-tip')
                .direction('w')
                .offset([0, -10])
                .html(function (d) {
                  var tiptemp = '<div class="gene-tip"><span style="color:#3d91c0">' + d.gene + "</span> <div>" + d.articleCount + "</div></div> ";
                  return tiptemp;
                });

              target.call(articleTip);
              gene.on('mouseover', function (d) {
                var ge = d3.select(this).select('circle');
                articleTip.show(d);
                ge.attr('fill', 'red');

              });

              gene.on('mouseout', function (d) {
                var ge = d3.select(this).select('circle');
                articleTip.hide(d);
                ge.attr('fill', 'orange');

              });
            }
          });
        }
      };
    }]);
}());}();
//# sourceMappingURL=angular-geneview-vis.js.map