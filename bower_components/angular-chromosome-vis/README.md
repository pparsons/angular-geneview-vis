#angular-chromosome-vis

Interactive visual chromosome representation for [Angular.js](http://angularjs.org/) 

##Brief Description
Include the angular-chromosome-vis dependency on your angular module:

```
var app = angular.module("myApp", ["angularChromosomeVis"]);
```

Include the script and stylesheet in your HTML, e.g.:

```html
<script src="bower_components/angular/angular.min.js"></script>
<script src="bower_components/d3/d3.min.js"></script>
<script src="bower_components/jsdas/jsdas.min.js"></script>
<script src="bower_components/underscore/underscore-min.js"></script>
<script src="bower_components/angular-chromosome-vis/angular-chromosome-vis.js"></script>
<link rel="stylesheet" href="bower_components/angular-chromosome-vis.css" />
```

Add the directive to your HTML, e.g.:

```html
<div chromosome chr="1" rel-size="true" axis="true" assembly="37" width='850' height="20" mode="multi"></div>
```

##Documentation and Demos
[pparsons.github.io/angular-chromosome-vis](http://pparsons.github.io/angular-chromosome-vis)


##References
Based on [linjoey/cyto-chromosome](https://github.com/linjoey/cyto-chromosome) and [4ndr01d3/biojs-vis-chromosome](https://github.com/4ndr01d3/biojs-vis-chromosome)