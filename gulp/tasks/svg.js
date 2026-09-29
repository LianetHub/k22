import svgSprite from 'gulp-svg-sprite';

export const svgSpriteTask = () => {
    const spritePath = `${app.path.build.svgIcons}/sprite.svg`;

    return app.gulp.src(app.path.src.svgIcons, { sourcemaps: app.isDev })

        .pipe(app.plugins.newer(spritePath))
        .pipe(app.plugins.plumber(
            app.plugins.notify.onError({
                title: "SVG SPRITE",
                message: "Error: <%= error.message %>"
            }))
        )
        .pipe(svgSprite({
            mode: {
                symbol: {
                    sprite: "../sprite.svg",
                    example: false
                }
            },
            shape: {
                id: {
                    separator: '-',
                    generator: "icon-%s"
                },
                transform: [
                    {
                        svgo: {
                            plugins: [
                                { name: 'removeXMLNS', active: true },
                                { name: 'removeViewBox', active: false },
                                { name: 'removeDimensions', active: true },
                                {
                                    name: 'customColorsToCurrentColor',
                                    type: 'perItem',
                                    fn: (item) => {

                                        if (item.attributes?.fill && item.attributes.fill !== 'none') {
                                            item.attributes.fill = 'currentColor';
                                        }
                                        if (item.attributes?.stroke && item.attributes.stroke !== 'none') {
                                            item.attributes.stroke = 'currentColor';
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }))
        .pipe(app.gulp.dest(app.path.build.svgIcons))
        .pipe(app.plugins.browsersync.stream());
};
