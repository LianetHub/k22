"use strict";

document.addEventListener("DOMContentLoaded", () => {
	// maps
	function initYandexMap() {
		const mapContainer = document.getElementById("contacts-map");
		if (!mapContainer) return;

		const getIconParams = () => {
			const width = window.innerWidth;
			let size = [62, 70];

			if (width <= 767) {
				size = [47, 53];
			} else if (width <= 1024) {
				size = [40, 45];
			}

			const tipShiftY = 12;

			return {
				size,
				offset: [-(size[0] / 2), -size[1] + tipShiftY],
			};
		};

		const parseMarkers = () => {
			const raw = (mapContainer.dataset.markers || "").trim();
			if (!raw) return [];

			return raw
				.split(";")
				.map((chunk) => {
					const [coordsPart, title = ""] = chunk.split("|");
					const coords = (coordsPart || "").split(",").map((item) => parseFloat(item.trim()));

					if (coords.length < 2 || coords.some((n) => Number.isNaN(n))) {
						return null;
					}

					return {
						coords,
						title: title.trim() || "K22",
					};
				})
				.filter(Boolean);
		};

		const init = () => {
			const markers = parseMarkers();
			if (!markers.length) return;

			const zoom = parseInt(mapContainer.dataset.zoom, 10) || 12;
			const iconPath = mapContainer.dataset.icon;
			const iconParams = getIconParams();

			const map = new ymaps.Map(mapContainer, {
				center: markers[0].coords,
				zoom,
				controls: ["zoomControl"],
			});

			map.behaviors.disable("scrollZoom");

			const placemarks = [];

			markers.forEach((marker) => {
				const placemarkOptions = {
					hasBalloon: false,
				};

				if (iconPath) {
					Object.assign(placemarkOptions, {
						iconLayout: "default#image",
						iconImageHref: iconPath,
						iconImageSize: iconParams.size,
						iconImageOffset: iconParams.offset,
					});
				} else {
					Object.assign(placemarkOptions, {
						preset: "islands#redDotIcon",
					});
				}

				const placemark = new ymaps.Placemark(
					marker.coords,
					{
						hintContent: marker.title,
					},
					placemarkOptions,
				);

				map.geoObjects.add(placemark);
				placemarks.push(placemark);
			});

			if (markers.length > 1) {
				const bounds = map.geoObjects.getBounds();
				if (bounds) {
					map.setBounds(bounds, {
						checkZoomRange: true,
						zoomMargin: 40,
					});
				}
			}

			let resizeTimer = null;
			window.addEventListener("resize", () => {
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(() => {
					if (!iconPath) return;
					const nextParams = getIconParams();
					placemarks.forEach((placemark) => {
						placemark.options.set({
							iconImageSize: nextParams.size,
							iconImageOffset: nextParams.offset,
						});
					});
				}, 150);
			});
		};

		const loadScript = () => {
			if (typeof ymaps !== "undefined") {
				ymaps.ready(init);
				return;
			}

			const apiKey = mapContainer.dataset.apikey || "";
			const script = document.createElement("script");
			script.src = `https://api-maps.yandex.ru/2.1/?${apiKey ? `apikey=${encodeURIComponent(apiKey)}&` : ""}lang=ru_RU`;
			script.async = true;
			script.onload = () => {
				ymaps.ready(init);
			};
			document.head.appendChild(script);
		};

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						loadScript();
						observer.unobserve(entry.target);
					}
				});
			},
			{ rootMargin: "200px" },
		);

		observer.observe(mapContainer);
	}

	initYandexMap();

	// sliders
	function getMobileSlider(sliderName, options) {
		let init = false;
		let swiper = null;

		function getSwiper() {
			if (window.innerWidth <= 575.98) {
				if (!init) {
					init = true;
					swiper = new Swiper(sliderName, options);
				}
			} else if (init) {
				swiper.destroy(true, true);
				swiper = null;
				init = false;
			}
		}

		getSwiper();
		window.addEventListener("resize", getSwiper);
	}

	if (typeof Swiper !== "undefined") {
		document.querySelectorAll(".reviews__slider")?.forEach((el) => {
			getMobileSlider(el, {
				slidesPerView: 1.05,
				spaceBetween: 12,
			});
		});

		document.querySelectorAll(".blog__slider")?.forEach((slider) => {
			const section = slider.closest(".blog");

			new Swiper(slider, {
				slidesPerView: 1.15,
				spaceBetween: 16,
				navigation: {
					prevEl: section?.querySelector(".blog__prev"),
					nextEl: section?.querySelector(".blog__next"),
				},
				breakpoints: {
					576: {
						slidesPerView: 2,
						spaceBetween: 20,
					},
					992: {
						slidesPerView: 3,
						spaceBetween: 24,
					},
					1200: {
						slidesPerView: 4,
						spaceBetween: 30,
					},
				},
			});
		});

		document.querySelectorAll(".gallery__slider")?.forEach((el) => {
			new Swiper(el, {
				slidesPerView: "auto",
				spaceBetween: 12,
				breakpoints: {
					768: { spaceBetween: 20 },
					1200: { spaceBetween: 30 },
				},
			});
		});
	}
});

if (typeof Fancybox !== "undefined") {
	Fancybox.bind("[data-fancybox]", {
		autoFocus: true,
		placeFocusBack: true,
		backdropClick: "close",
		dragToClose: (fancybox) => fancybox.getSlide()?.type !== "inline",
		closeButtonTpl: '<button class="f-button icon-cross-circle" title="Закрыть" data-fancybox-close></button>',
	});
}
