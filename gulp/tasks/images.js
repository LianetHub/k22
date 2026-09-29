export const images = () => {
	return app.gulp
		.src(app.path.src.images, { encoding: false, allowEmpty: true })
		.pipe(
			app.plugins.plumber(
				app.plugins.notify.onError({
					title: "Images",
					message: "Error: <%= error.message %>",
				}),
			),
		)
		.pipe(app.plugins.newer(app.path.build.images))
		.pipe(app.gulp.dest(app.path.build.images))
		.pipe(app.gulp.src(app.path.src.svg, { encoding: false, allowEmpty: true }))
		.pipe(app.gulp.dest(app.path.build.images))
		.pipe(app.plugins.browsersync.stream());
};

export const favicon = () => {
	return app.gulp.src(app.path.src.favicon, { encoding: false, allowEmpty: true }).pipe(app.gulp.dest(app.path.build.favicon));
};
