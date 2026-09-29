import fs from "fs";

export const copy = (done) => {
    if (!fs.existsSync(`${app.path.srcFolder}/files`)) {
        return done();
    }

    return app.gulp.src(app.path.src.files, { encoding: false, allowEmpty: true })
    .pipe(app.gulp.dest(app.path.build.files))
}