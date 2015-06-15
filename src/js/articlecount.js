/*global angular, d3*/
(function () {
    "use strict";
    angular
        .module('angularGeneviewVis')
        .directive('articleView', ['articleStatLoader', function (articleStatLoader) {
            return {
                restrict: 'AE',
                require: '^geneview',
                scope: {
                    data: '=',
                    width: '='
                },
                link : function (scope, element, attrs, geneviewAPI) {

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
                                if (a.midLocation < b.midLocation) { return -1; }
                                if (a.midLocation > b.midLocation) { return 1; }
                                return 0;
                            });

                            var maxArticleCount = d3.max(data, function (d) { return d.articleCount; });
                            yscale.domain([0, maxArticleCount]);
                            xscale = geneviewAPI.getXscale();

                            ylAxis.scale(yscale);

                            g.call(ylAxis);

                            line.x(function (d) { return xscale(d.midLocation); })
                                .y(function (d) { return yscale(d.articleCount); });

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
}());