import gulp from "gulp";

import { path } from "./gulp/config/path.js";
import { plugins } from "./gulp/config/plugins.js";

global.app = {
    isBuild: process.argv.includes("--build"),
    isDev: !process.argv.includes("--build"),
    path: path,
    gulp: gulp,
    plugins: plugins,
};

import { copy } from "./gulp/tasks/copy.js";
import { reset } from "./gulp/tasks/reset.js";
import { html } from "./gulp/tasks/html.js";
import { server } from "./gulp/tasks/server.js";
import { scss, normalize, copyCssLibs } from "./gulp/tasks/scss.js";
import { js, copyJsLibs } from "./gulp/tasks/js.js";
import { images, favicon } from "./gulp/tasks/images.js";
import {
    otf2ttf,
    ttfToWoff,
    copyWoff,
    fontsStyle,
} from "./gulp/tasks/fonts.js";
import { zip } from "./gulp/tasks/zip.js";
import { json } from "./gulp/tasks/json.js";
import { php } from "./gulp/tasks/php.js";
// import { svgSpriteTask } from "./gulp/tasks/svg.js";

function watcher() {
    gulp.watch(path.watch.files, copy);
    gulp.watch(path.watch.html, html);
    gulp.watch(path.watch.scss, scss);
    gulp.watch(path.watch.normalize, normalize);
    gulp.watch(path.watch.js, js);
    gulp.watch(path.watch.json, json);
    gulp.watch(path.watch.images, images);
    gulp.watch(path.watch.php, php);
    gulp.watch(path.watch.fonts, fonts);
    // gulp.watch(path.watch.svgIcons, svgSpriteTask);
}

const fonts = gulp.series(otf2ttf, ttfToWoff, copyWoff, fontsStyle);

const mainTasks = gulp.series(
    fonts,
    // svgSpriteTask,
    gulp.parallel(copy, copyCssLibs, copyJsLibs, html, normalize, scss, favicon, js, json, images, php)
);

const dev = gulp.series(reset, mainTasks, gulp.parallel(watcher, server));
const build = gulp.series(reset, mainTasks);
const deployZIP = gulp.series(reset, mainTasks, zip);

export { dev };
export { build };
export { deployZIP };

gulp.task("default", dev);
