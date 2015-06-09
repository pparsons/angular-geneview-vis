var gulp = require('gulp');
var wrap = require('gulp-wrap');
var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat');

gulp.task('dev', function(){
    gulp.src(['src/js/index.js','src/js/services.js'])
        .pipe(sourcemaps.init({loadMaps:true}))
        .pipe(concat('angular-geneview-vis.js'))
        .pipe(wrap('!function(){\n"use strict";<%= contents %>}();'))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest("./dist"));
});

//TODO create task to build minified release file
