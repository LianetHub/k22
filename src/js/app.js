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

	// header
	const menu = document.querySelector("[data-menu]");
	const menuBurger = document.querySelector("[data-menu-burger]");
	const menuBack = menu?.querySelector("[data-menu-back]");
	const menuClose = menu?.querySelector("[data-menu-close]");
	const desktopMenuMq = window.matchMedia("(min-width: 1199.98px)");
	let menuScrollY = 0;

	function isDesktopMenu() {
		return desktopMenuMq.matches;
	}

	function lockBody(lock) {
		const body = document.body;

		if (lock) {
			menuScrollY = window.scrollY;
			body.classList.add("is-locked");
			body.style.top = `-${menuScrollY}px`;
			body.style.position = "fixed";
			body.style.width = "100%";
			return;
		}

		body.classList.remove("is-locked");
		body.style.position = "";
		body.style.top = "";
		body.style.width = "";
		window.scrollTo(0, menuScrollY);
	}

	function closeDesktopDropdowns() {
		if (!menu) return;

		menu.querySelectorAll(".menu__item.is-open").forEach((item) => {
			item.classList.remove("is-open");
			const trigger = item.querySelector("[data-menu-trigger]");
			const dropdown = item.querySelector("[data-menu-dropdown]");
			if (trigger) trigger.setAttribute("aria-expanded", "false");
			if (dropdown) dropdown.hidden = true;
		});
	}

	function closeMobileDrill() {
		if (!menu) return;

		menu.classList.remove("is-drill");
		menu.querySelectorAll(".menu__item.is-drill").forEach((item) => {
			item.classList.remove("is-drill");
		});
		menu.querySelectorAll(".menu__group.is-open").forEach((group) => {
			group.classList.remove("is-open");
			const toggle = group.querySelector("[data-menu-group]");
			if (toggle) toggle.setAttribute("aria-expanded", "false");
		});
		menu.querySelectorAll("[data-menu-dropdown]").forEach((dropdown) => {
			dropdown.hidden = true;
		});
		if (menuBack) menuBack.hidden = true;
	}

	function closeMobileMenu() {
		if (!menu) return;

		menu.classList.remove("is-open");
		closeMobileDrill();
		if (menuBurger) menuBurger.setAttribute("aria-expanded", "false");
		lockBody(false);
	}

	function openMobileMenu() {
		if (!menu) return;

		menu.classList.add("is-open");
		if (menuBurger) menuBurger.setAttribute("aria-expanded", "true");
		lockBody(true);
	}

	function openDesktopDropdown(item) {
		closeDesktopDropdowns();
		item.classList.add("is-open");
		const trigger = item.querySelector("[data-menu-trigger]");
		const dropdown = item.querySelector("[data-menu-dropdown]");
		if (trigger) trigger.setAttribute("aria-expanded", "true");
		if (dropdown) dropdown.hidden = false;
	}

	function openMobileDrill(item) {
		if (!menu) return;

		closeMobileDrill();
		menu.classList.add("is-drill");
		item.classList.add("is-drill");
		const dropdown = item.querySelector("[data-menu-dropdown]");
		if (dropdown) dropdown.hidden = false;
		if (menuBack) menuBack.hidden = false;
	}

	function resetMenuOnBreakpoint() {
		closeDesktopDropdowns();
		closeMobileMenu();
	}

	if (menu) {
		document.addEventListener("click", (e) => {
			const target = e.target;

			const ratingStar = target.closest("[data-article-star]");
			if (ratingStar) {
				const group = ratingStar.closest("[data-article-rating]");
				const value = Number(ratingStar.getAttribute("data-article-star"));

				group?.querySelectorAll("[data-article-star]").forEach((star) => {
					const starValue = Number(star.getAttribute("data-article-star"));
					const isActive = starValue <= value;
					star.classList.toggle("is-active", isActive);
					star.setAttribute("aria-pressed", isActive ? "true" : "false");
				});
			}

			if (target.closest("[data-menu-burger]")) {
				if (menu.classList.contains("is-open")) {
					closeMobileMenu();
				} else {
					openMobileMenu();
				}
				return;
			}

			if (target.closest("[data-menu-close]")) {
				closeMobileMenu();
				return;
			}

			if (target.closest("[data-menu-back]")) {
				closeMobileDrill();
				return;
			}

			const groupToggle = target.closest("[data-menu-group]");
			if (groupToggle && !isDesktopMenu()) {
				const group = groupToggle.closest(".menu__group");
				if (!group || group.classList.contains("menu__group--flat")) return;

				const isOpen = group.classList.toggle("is-open");
				groupToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
				return;
			}

			const trigger = target.closest("[data-menu-trigger]");
			if (trigger) {
				const item = trigger.closest(".menu__item--has-dropdown");
				if (!item) return;

				if (isDesktopMenu()) {
					if (item.classList.contains("is-open")) {
						closeDesktopDropdowns();
					} else {
						openDesktopDropdown(item);
					}
				} else {
					openMobileDrill(item);
				}
				return;
			}

			if (isDesktopMenu() && menu.querySelector(".menu__item.is-open") && !target.closest(".menu__item--has-dropdown")) {
				closeDesktopDropdowns();
			}
		});

		document.addEventListener("keydown", (e) => {
			if (e.key !== "Escape") return;

			if (menu.classList.contains("is-open")) {
				closeMobileMenu();
				return;
			}

			closeDesktopDropdowns();
		});

		if (typeof desktopMenuMq.addEventListener === "function") {
			desktopMenuMq.addEventListener("change", resetMenuOnBreakpoint);
		} else {
			desktopMenuMq.addListener(resetMenuOnBreakpoint);
		}

		menu.querySelectorAll(".menu__item--has-dropdown").forEach((item) => {
			item.addEventListener("mouseenter", () => {
				if (!isDesktopMenu()) return;
				openDesktopDropdown(item);
			});

			item.addEventListener("mouseleave", () => {
				if (!isDesktopMenu()) return;
				closeDesktopDropdowns();
			});
		});
	}

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

		document.querySelectorAll(".products__slider")?.forEach((slider) => {
			const section = slider.closest(".products");

			new Swiper(slider, {
				slidesPerView: 1.15,
				spaceBetween: 16,
				watchOverflow: true,
				navigation: {
					prevEl: section?.querySelector(".products__prev"),
					nextEl: section?.querySelector(".products__next"),
				},
				breakpoints: {
					768: {
						slidesPerView: 2,
						spaceBetween: 20,
					},
					1200: {
						slidesPerView: "auto",
						spaceBetween: 30,
					},
				},
			});
		});

		document.querySelectorAll(".works__slider")?.forEach((slider) => {
			const section = slider.closest(".works");

			new Swiper(slider, {
				slidesPerView: 1,
				spaceBetween: 10,
				navigation: {
					prevEl: section?.querySelector(".works__prev"),
					nextEl: section?.querySelector(".works__next"),
				},
				breakpoints: {
					768: {
						slidesPerView: "auto",
						spaceBetween: 30,
					},
					1200: {
						slidesPerView: 3,
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

		document.querySelectorAll(".article__reviews-slider").forEach((slider) => {
			new Swiper(slider, {
				slidesPerView: 1,
				spaceBetween: 16,
				watchOverflow: true,
				navigation: {
					prevEl: slider.querySelector(".swiper-button-prev"),
					nextEl: slider.querySelector(".swiper-button-next"),
				},
			});
		});
	}

	// power increase calculator
	const powerSection = document.querySelector("[data-power]");
	if (powerSection) {
		const selects = powerSection.querySelectorAll("[data-power-select]");
		const vehicleTabs = powerSection.querySelectorAll("[data-power-vehicle]");
		const stageTabs = powerSection.querySelectorAll("[data-power-stage]");
		const priceLabel = powerSection.querySelector("[data-power-price-label]");
		const priceValue = powerSection.querySelector("[data-power-price-value]");

		const stagePrices = {
			1: { label: "Стоимость stage 1", value: "от 35 000 ₽" },
			2: { label: "Стоимость stage 2", value: "от 55 000 ₽" },
		};

		function syncPowerEmptyState() {
			const allSelected = Array.from(selects).every((select) => Boolean(select.value));
			powerSection.classList.toggle("is-empty", !allSelected);
		}

		function activateTabGroup(tabs, activeTab, attrName) {
			tabs.forEach((tab) => {
				const isActive = tab === activeTab;
				tab.classList.toggle("is-active", isActive);
				tab.setAttribute("aria-selected", isActive ? "true" : "false");
			});

			if (attrName === "data-power-stage" && priceLabel && priceValue) {
				const stage = activeTab.getAttribute("data-power-stage");
				const price = stagePrices[stage] || stagePrices[1];
				priceLabel.textContent = price.label;
				priceValue.textContent = price.value;
			}
		}

		selects.forEach((select) => {
			select.addEventListener("change", syncPowerEmptyState);
		});

		vehicleTabs.forEach((tab) => {
			tab.addEventListener("click", () => {
				activateTabGroup(vehicleTabs, tab, "data-power-vehicle");
			});
		});

		stageTabs.forEach((tab) => {
			tab.addEventListener("click", () => {
				activateTabGroup(stageTabs, tab, "data-power-stage");
			});
		});

		syncPowerEmptyState();
	}

	// phone mask
	const phoneInputs = document.querySelectorAll('input[type="tel"]');

	function getInputNumbersValue(input) {
		return input.value.replace(/\D/g, "");
	}

	function onPhonePaste(e) {
		const input = e.target;
		const inputNumbersValue = getInputNumbersValue(input);
		const pasted = e.clipboardData || window.clipboardData;

		if (!pasted) return;

		const pastedText = pasted.getData("Text");
		if (/\D/g.test(pastedText)) {
			input.value = inputNumbersValue;
		}
	}

	function onPhoneInput(e) {
		const input = e.target;
		let inputNumbersValue = getInputNumbersValue(input);
		const selectionStart = input.selectionStart;
		let formattedInputValue = "";

		if (!inputNumbersValue) {
			input.value = "";
			return;
		}

		if (input.value.length !== selectionStart) {
			if (e.data && /\D/g.test(e.data)) {
				input.value = inputNumbersValue;
			}
			return;
		}

		if (["7", "8", "9"].indexOf(inputNumbersValue[0]) > -1) {
			if (inputNumbersValue[0] === "9") {
				inputNumbersValue = "7" + inputNumbersValue;
			}

			const firstSymbols = inputNumbersValue[0] === "8" ? "8" : "+7";
			formattedInputValue = firstSymbols + " ";

			if (inputNumbersValue.length > 1) {
				formattedInputValue += "(" + inputNumbersValue.substring(1, 4);
			}
			if (inputNumbersValue.length >= 5) {
				formattedInputValue += ") " + inputNumbersValue.substring(4, 7);
			}
			if (inputNumbersValue.length >= 8) {
				formattedInputValue += "-" + inputNumbersValue.substring(7, 9);
			}
			if (inputNumbersValue.length >= 10) {
				formattedInputValue += "-" + inputNumbersValue.substring(9, 11);
			}
		} else {
			formattedInputValue = "+" + inputNumbersValue.substring(0, 16);
		}

		input.value = formattedInputValue;
	}

	function onPhoneKeyDown(e) {
		const inputValue = e.target.value.replace(/\D/g, "");

		if (e.key === "Backspace" && inputValue.length === 1) {
			e.target.value = "";
		}
	}

	phoneInputs.forEach((phoneInput) => {
		phoneInput.addEventListener("keydown", onPhoneKeyDown);
		phoneInput.addEventListener("input", onPhoneInput);
		phoneInput.addEventListener("paste", onPhonePaste);
	});

	// cookies
	const cookies = document.querySelector("[data-cookies]");
	if (cookies) {
		const cookiesKey = "k22-cookies-accepted";

		function isCookiesAccepted() {
			try {
				return localStorage.getItem(cookiesKey) === "1";
			} catch (error) {
				// localStorage недоступен в приватном режиме
				return false;
			}
		}

		function saveCookiesConsent() {
			try {
				localStorage.setItem(cookiesKey, "1");
			} catch (error) {
				// localStorage недоступен в приватном режиме
			}
		}

		function setCookiesHeight(value) {
			document.documentElement.style.setProperty("--cookies-height", value);
		}

		function acceptCookies() {
			saveCookiesConsent();
			cookies.remove();
			setCookiesHeight("0px");
		}

		if (isCookiesAccepted()) {
			cookies.remove();
		} else {
			cookies.classList.add("is-visible");
			setCookiesHeight(`${cookies.offsetHeight}px`);

			if (typeof ResizeObserver !== "undefined") {
				new ResizeObserver(() => {
					if (!cookies.isConnected) return;
					setCookiesHeight(`${cookies.offsetHeight}px`);
				}).observe(cookies);
			}

			cookies.querySelector("[data-cookies-accept]")?.addEventListener("click", acceptCookies);
		}
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
