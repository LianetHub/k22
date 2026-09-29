import fs from "fs";
import fonter from "gulp-fonter";
import ttf2woff2 from "gulp-ttf2woff2";

export const otf2ttf = () => {
    return app.gulp
        .src(`${app.path.srcFolder}/fonts/*.otf`, { encoding: false, allowEmpty: true })
        .pipe(
            app.plugins.plumber(
                app.plugins.notify.onError({
                    title: "FONTS",
                    message: "Error: <%= error.message %>",
                })
            )
        )
        .pipe(
            fonter({
                formats: ["ttf"],
            })
        )
        .pipe(app.gulp.dest(`${app.path.srcFolder}/fonts/`));
};

export const ttfToWoff = () => {
    return app.gulp
        .src(`${app.path.srcFolder}/fonts/*.ttf`, { encoding: false, allowEmpty: true })
        .pipe(
            app.plugins.plumber(
                app.plugins.notify.onError({
                    title: "FONTS",
                    message: "Error: <%= error.message %>",
                })
            )
        )
        .pipe(
            fonter({
                formats: ["woff"],
            })
        )
        .pipe(app.gulp.dest(`${app.path.build.fonts}`))
        .pipe(app.gulp.src(`${app.path.srcFolder}/fonts/*.ttf`, { encoding: false, allowEmpty: true }))
        .pipe(ttf2woff2())
        .pipe(app.gulp.dest(`${app.path.build.fonts}`));
};
export const copyWoff = () => {
    const stream = app.gulp
        .src(`${app.path.srcFolder}/fonts/*.woff`, { encoding: false, allowEmpty: true })
        .pipe(app.gulp.dest(`${app.path.build.fonts}`))
        .pipe(app.gulp.src(`${app.path.srcFolder}/fonts/*.woff2`, { encoding: false, allowEmpty: true }))
        .pipe(app.gulp.dest(`${app.path.build.fonts}`));

    const iconfontDir = `${app.path.srcFolder}/fonts/iconfont`;
    if (!fs.existsSync(iconfontDir)) {
        return stream;
    }

    return stream
        .pipe(app.gulp.src(`${iconfontDir}/**/*.*`, { encoding: false, allowEmpty: true }))
        .pipe(app.gulp.dest(`${app.path.build.fonts}/iconfont`));
};

export const fontsStyle = () => {
    let fontsFile = `${app.path.srcFolder}/scss/fonts.scss`;

    // Проверяем наличие папки с шрифтами
    fs.readdir(app.path.build.fonts, function (err, fontsFiles) {
        if (fontsFiles) {
            fontsFiles = fontsFiles.filter((file) => /\.(woff2?|ttf|otf)$/i.test(file));
            // Если файл существует, удаляем его
            if (fs.existsSync(fontsFile)) {
                fs.unlinkSync(fontsFile);
                console.log("Файл scss/fonts.scss актуализирован");
            } else {
                console.log("Файл scss/fonts.scss создан");
            }

            // Создаем новый файл
            fs.writeFile(fontsFile, "", cb);
            let newFileOnly;

            for (let i = 0; i < fontsFiles.length; i++) {
                // Получаем имя файла без расширения
                let fontFileNameWithExtension = fontsFiles[i].split(".")[0];
                let fontFileName = fontFileNameWithExtension;

                // Проверка на вариативный шрифт
                const isVariableFont = fontFileName.toLowerCase().includes("variablefont_");

                if (isVariableFont) {
                    fontFileName = fontFileName.replace(/-VariableFont_wght/i, "");
                }

                if (newFileOnly !== fontFileName) {
                    let fontName = fontFileName.split("-")[0] ? fontFileName.split("-")[0] : fontFileName;
                    let fontWeight = fontFileName.split("-")[1] || '';
                    let fontStyle = 'normal';

                    if (!isVariableFont) {

                        // Обработка начертания Italic
                        if (fontWeight.toLowerCase().includes("italic")) {
                            fontStyle = "italic";
                            fontWeight = fontWeight.replace(/italic/i, "").trim();
                        }

                        // Определение веса шрифта
                        switch (fontWeight.toLowerCase()) {
                            case "thin": fontWeight = 100; break;
                            case "extralight": fontWeight = 200; break;
                            case "light": fontWeight = 300; break;
                            case "book": fontWeight = 450; break;
                            case "medium": fontWeight = 500; break;
                            case "semibold":
                            case "demi": fontWeight = 600; break;
                            case "demibold": fontWeight = 600; break;
                            case "bold": fontWeight = 700; break;
                            case "extrabold":
                            case "heavy": fontWeight = 800; break;
                            case "black": fontWeight = 900; break;
                            default: fontWeight = 400; break;
                        }
                    }


                    if (isVariableFont) {
                        // Генерация для Вариативных шрифтов
                        fs.appendFile(fontsFile,
                            `@font-face {
								font-family: '${fontName}';
								src: url("../fonts/${fontFileNameWithExtension}.woff2") format("woff2 supports variations"),
									url("../fonts/${fontFileNameWithExtension}.woff2") format("woff2-variations"),
									url("../fonts/${fontFileNameWithExtension}.woff") format("woff");
								font-weight: 100 900;
								font-stretch: 75% 125%;
								font-style: normal;
								font-display: swap;
							}\r\n`, cb);
                    } else {
                        // Генерация для Обычных шрифтов
                        fs.appendFile(fontsFile,
                            `@font-face {
								font-family: '${fontName}';
								font-display: swap;
								src: url("../fonts/${fontFileNameWithExtension}.woff2") format("woff2"), url("../fonts/${fontFileNameWithExtension}.woff") format("woff");
								font-weight: ${fontWeight};
								font-style: ${fontStyle};
							}\r\n`, cb);
                    }

                    newFileOnly = fontFileName;
                }
            }
        }
    });

    return app.gulp.src(`${app.path.srcFolder}`);
    function cb() { }
};
