import fs from "fs";

export const json = (done) => {
    if (!fs.existsSync(`${app.path.srcFolder}/json`)) {
        return done();
    }

    return app.gulp.src(app.path.src.json, { allowEmpty: true })
        .pipe(app.gulp.dest(app.path.build.json))
        .pipe(app.plugins.browsersync.stream());
}