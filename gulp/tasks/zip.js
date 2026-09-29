import { deleteAsync } from "del";
import zipPlugin from "gulp-zip";

export const zip = async () => {
    await deleteAsync(`./${app.path.rootFolder}.zip`, { force: true });
    return app.gulp.src(`${app.path.clean}/**/*.*`, { encoding: false, allowEmpty: true })
        .pipe(app.plugins.plumber(
            app.plugins.notify.onError({
                title: "ZIP",
                message: "Error: <%= error.message %>"
            }))
        )
        .pipe(zipPlugin(`${app.path.rootFolder}.zip`))
        .pipe(app.gulp.dest('./'));
}