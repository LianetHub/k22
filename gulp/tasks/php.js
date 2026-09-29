export const php = () => {
    return app.gulp.src(app.path.src.php, { allowEmpty: true })
    .pipe(app.gulp.dest(app.path.build.php))
    .pipe(app.plugins.browsersync.stream());
}