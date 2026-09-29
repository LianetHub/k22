import fileinclude from "gulp-file-include";
import versionNumber from "gulp-version-number";
import htmlBeautify from "gulp-html-beautify";

export const html = () => {
	return app.gulp
		.src(app.path.src.html)
		.pipe(
			app.plugins.if(
				app.isBuild,
				htmlBeautify({
					indent_size: 4,
					indent_with_tabs: true,
					preserve_newlines: false,
					max_preserve_newlines: 0,
					wrap_line_length: 0,
					end_with_newline: true,
				}),
			),
		)
		.pipe(
			app.plugins.plumber(
				app.plugins.notify.onError({
					title: "HTML",
					message: "Error: <%= error.message %>",
				}),
			),
		)
		.pipe(
			fileinclude({
				prefix: "@@",
				basepath: "@file",
				indent: true,
				context: {},
			}),
		)
		.pipe(app.plugins.replace(/^[ \t]*<!-- fileinclude -->[ \t]*\r?\n?/gm, ""))
		.pipe(app.plugins.replace(/@img\//g, "img/"))
		.pipe(
			app.plugins.if(
				app.isBuild,
				versionNumber({
					value: "%DT%",
					append: {
						key: "_v",
						cover: 0,
						to: ["css", "js"],
					},
					output: {
						file: "gulp/version.json",
					},
				}),
			),
		)
		.pipe(
			app.plugins.if(
				app.isBuild,
				htmlBeautify({
					indent_size: 4,
					indent_with_tabs: true,
					preserve_newlines: false,
					max_preserve_newlines: 0,
					wrap_line_length: 0,
					end_with_newline: true,
				}),
			),
		)
		.pipe(app.gulp.dest(app.path.build.html))
		.pipe(app.plugins.browsersync.stream());
};
