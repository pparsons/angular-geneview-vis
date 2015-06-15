/*global require*/
var gulp = require('gulp');
var wrap = require('gulp-wrap');
var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat');

var SOURCE_FILES = [
    'src/js/index.js',
    'src/js/services.js',
    'src/js/geneview.js',
    'src/js/articlecount.js',
    'src/mixins.js'
];

var DIST_FOLDER = './dist';
var DIST_FILE_NAME = 'angular-geneview-vis.js';
var WRAP_TEMPLATE = '!function(){\n"use strict";<%= contents %>}();';

gulp.task('default',['dev'],function(){});

gulp.task('dev', function(){
    "use strict";
    return gulp.src(SOURCE_FILES)
        .pipe(sourcemaps.init({loadMaps:true}))
        .pipe(concat(DIST_FILE_NAME))
        .pipe(wrap(WRAP_TEMPLATE))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(DIST_FOLDER));
});

//TODO create task to build minified release file
//TODO create jasmine test task