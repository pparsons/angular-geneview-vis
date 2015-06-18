/*global require*/
"use strict";
var gulp = require('gulp');
var wrap = require('gulp-wrap');
var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var jasmine = require('gulp-jasmine');

var SOURCE_FILES = [
  'src/js/index.js',
  'src/js/services.js',
  'src/js/geneview.js',
  'src/js/articlecount.js',
  'src/mixins.js'
];

var TEST_FILES = ['test/spec/test_spec.js'];

var DIST_FOLDER = './dist';
var DIST_FILE_NAME = 'angular-geneview-vis.js';
var WRAP_TEMPLATE = '!function(){\n"use strict";<%= contents %>}();';

gulp.task('default', ['dev', 'release', 'test'], function () {
});

function source() {
  return gulp.src(SOURCE_FILES);
}

function output() {
  return this.pipe(gulp.dest(DIST_FOLDER));
}

function bundle() {
  return this
    .pipe(concat(DIST_FILE_NAME))
    .pipe(wrap(WRAP_TEMPLATE));
}

gulp.task('dev', function () {
  var s = bundle.call(source()
    .pipe(sourcemaps.init({loadMaps: true})))
    .pipe(sourcemaps.write('./'));

  return output.call(s);
});

gulp.task('release', function () {
  var s = bundle.call(source())
    .pipe(uglify({mangle: false}))
    .pipe(rename('angular-geneview-vis.min.js'))
    .pipe(gulp.dest(DIST_FOLDER));

  return output.call(s);
});

gulp.task('test', function () {
  return gulp.src(TEST_FILES)
    .pipe(jasmine());
});