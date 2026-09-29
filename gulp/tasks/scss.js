import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';
import rename from 'gulp-rename';

import cleanCss from 'gulp-clean-css';
import autoprefixer from 'gulp-autoprefixer';
// gulp-group-css-media-queries removed: its CSS parser does not support @container
// and throws "missing '}'" on catalog card container queries.
import shorthand from 'gulp-shorthand';

const sass = gulpSass(dartSass);

export const scss = () => {

    return app.gulp.src(app.path.src.scss, { sourcemaps: app.isDev })
        .pipe(app.plugins.plumber(
            app.plugins.notify.onError({
                title: "SCSS",
                message: "Error: <%= error.message %>"
            }))
        )
        .pipe(sass({
            style: 'expanded'
        }))
        .pipe(
            app.plugins.if(
                app.isBuild,
                autoprefixer({
                    cascade: true
                })
            )
        )
        .pipe(app.plugins.replace(/@img\//g, '../img/'))
        .pipe(app.gulp.dest(app.path.build.css))
        .pipe(
            app.plugins.if(
                app.isBuild,
                cleanCss()
            )
        )
        .pipe(rename({
            extname: ".min.css"
        }))
        .pipe(app.gulp.dest(app.path.build.css))
        .pipe(app.plugins.browsersync.stream());
}

export const normalize = () => {
    return app.gulp.src(app.path.src.normalize, { sourcemaps: app.isDev })
        .pipe(app.plugins.plumber(
            app.plugins.notify.onError({
                title: "SCSS RESET",
                message: "Error: <%= error.message %>"
            }))
        )
        .pipe(app.plugins.replace(/@img\//g, '../img/'))
        .pipe(sass({
            style: 'expanded'
        }))
        .pipe(
            app.plugins.if(
                app.isBuild,
                autoprefixer({
                    cascade: true
                })
            )
        )
        .pipe(
            app.plugins.if(
                app.isBuild,
                shorthand()
            )
        )
        .pipe(app.gulp.dest(app.path.build.normalize))
        .pipe(
            app.plugins.if(
                app.isBuild,
                cleanCss()
            )
        )
        .pipe(rename({
            extname: ".min.css"
        }))
        .pipe(app.gulp.dest(app.path.build.normalize))
        .pipe(app.plugins.browsersync.stream());
}

export const copyCssLibs = () => {
    return app.gulp.src(app.path.src.cssLibs, { allowEmpty: true })
        .pipe(app.gulp.dest(app.path.build.cssLibs))
}
