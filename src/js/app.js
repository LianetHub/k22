"use strict";

document.addEventListener("DOMContentLoaded", () => {
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
		document.querySelectorAll("[data-reviews]").forEach((el) => {
			getMobileSlider(el, {
				slidesPerView: 1.05,
				spaceBetween: 12,
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
