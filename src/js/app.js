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

			const groundPane = map.panes.get("ground");
			const groundElement = groundPane && groundPane.getElement();

			if (groundElement) {
				groundElement.style.filter = "grayscale(1)";
			}

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

			const fitMap = () => {
				if (typeof map.container?.fitToViewport === "function") {
					map.container.fitToViewport();
				}
			};

			fitMap();

			let resizeTimer = null;
			window.addEventListener("resize", () => {
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(() => {
					fitMap();
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

	// contacts cities
	const contactsCities = document.querySelector("[data-contacts-cities]");
	const contactsCitiesMq = window.matchMedia("(max-width: 767.98px)");

	function setContactsCitiesOpen(open) {
		if (!contactsCities) return;

		contactsCities.classList.toggle("is-open", open);
		contactsCities.setAttribute("aria-expanded", open ? "true" : "false");
	}

	if (contactsCities) {
		contactsCitiesMq.addEventListener("change", () => {
			setContactsCitiesOpen(false);
		});
	}

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
			const productsSwitch = target.closest("[data-products-switch]");

			if (productsSwitch) {
				const productsSection = productsSwitch.closest(".products");
				const isOpen = productsSection?.classList.toggle("is-filters-open") ?? false;

				productsSwitch.setAttribute("aria-expanded", isOpen ? "true" : "false");
				return;
			}

			if (contactsCities && contactsCitiesMq.matches) {
				const city = target.closest(".contacts__city");

				if (city && contactsCities.contains(city)) {
					const input = city.querySelector(".contacts__city-input");

					if (input && input.checked) {
						e.preventDefault();
						setContactsCitiesOpen(!contactsCities.classList.contains("is-open"));
					} else {
						setContactsCitiesOpen(false);
					}
				} else if (!target.closest("[data-contacts-cities]")) {
					setContactsCitiesOpen(false);
				}
			}

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

			setContactsCitiesOpen(false);

			if (menu.classList.contains("is-open")) {
				closeMobileMenu();
				return;
			}

			closeDesktopDropdowns();
		});

		desktopMenuMq.addEventListener("change", resetMenuOnBreakpoint);

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
			const section = el.closest(".reviews");

			getMobileSlider(el, {
				slidesPerView: 1.05,
				spaceBetween: 10,
				navigation: {
					prevEl: section?.querySelector(".reviews__prev"),
					nextEl: section?.querySelector(".reviews__next"),
				},
			});
		});

		document.querySelectorAll(".blog__slider")?.forEach((slider) => {
			const section = slider.closest(".blog");

			new Swiper(slider, {
				slidesPerView: 1.1,
				spaceBetween: 30,
				navigation: {
					prevEl: section?.querySelector(".blog__prev"),
					nextEl: section?.querySelector(".blog__next"),
				},
				breakpoints: {
					768: {
						slidesPerView: 2,
						spaceBetween: 30,
					},
					1440: {
						slidesPerView: 4,
						spaceBetween: 30,
					},
				},
			});
		});

		document.querySelectorAll(".products__slider")?.forEach((slider) => {
			const section = slider.closest(".products");

			new Swiper(slider, {
				slidesPerView: 2,
				spaceBetween: 10,
				watchOverflow: true,
				navigation: {
					prevEl: section?.querySelector(".products__prev"),
					nextEl: section?.querySelector(".products__next"),
				},
				breakpoints: {
					768: {
						slidesPerView: 2.22,
						spaceBetween: 10,
					},
					1440: {
						slidesPerView: 4,
						spaceBetween: 30,
					},
					1920: {
						slidesPerView: 5,
						spaceBetween: 30,
					},
				},
			});
		});

		document.querySelectorAll(".works__slider")?.forEach((slider) => {
			if (slider.closest(".works--related")) return;

			const section = slider.closest(".works");

			new Swiper(slider, {
				slidesPerView: 1,
				spaceBetween: 30,
				navigation: {
					prevEl: section?.querySelector(".works__prev"),
					nextEl: section?.querySelector(".works__next"),
				},
				breakpoints: {
					768: {
						slidesPerView: 1.61,
						spaceBetween: 30,
					},
					1440: {
						slidesPerView: 3,
						spaceBetween: 30,
					},
				},
			});
		});

		document.querySelectorAll(".works--related .works__slider").forEach((slider) => {
			let swiper = null;
			let init = false;

			function mountRelatedWorks() {
				const tablet = window.innerWidth >= 767.98 && window.innerWidth < 1439.98;

				if (tablet) {
					if (!init) {
						init = true;
						swiper = new Swiper(slider, {
							slidesPerView: 1.61,
							spaceBetween: 30,
						});
					}
				} else if (init) {
					swiper.destroy(true, true);
					swiper = null;
					init = false;
				}
			}

			mountRelatedWorks();
			window.addEventListener("resize", mountRelatedWorks);
		});

		document.querySelectorAll(".gallery__slider")?.forEach((el) => {
			new Swiper(el, {
				slidesPerView: 1,
				spaceBetween: 10,
				breakpoints: {
					768: {
						slidesPerView: 3.13,
						spaceBetween: 30,
					},
					1440: {
						slidesPerView: 4,
						spaceBetween: 30,
					},
				},
			});
		});

		document.querySelectorAll(".article__reviews-slider").forEach((slider) => {
			let swiper = null;
			let mode = "";

			function reviewsMode() {
				if (window.innerWidth >= 1439.98) return "sidebar";
				if (window.innerWidth >= 767.98) return "grid";
				return "mobile";
			}

			function mountReviewsSlider() {
				const nextMode = reviewsMode();

				if (nextMode === mode) return;

				mode = nextMode;

				if (swiper) {
					swiper.destroy(true, true);
					swiper = null;
				}

				if (mode === "grid") return;

				swiper = new Swiper(slider, {
					slidesPerView: mode === "mobile" ? 1.05 : 1,
					spaceBetween: 16,
					watchOverflow: true,
					navigation: {
						prevEl: slider.querySelector(".swiper-button-prev"),
						nextEl: slider.querySelector(".swiper-button-next"),
					},
				});
			}

			mountReviewsSlider();
			window.addEventListener("resize", mountReviewsSlider);
		});

		document.querySelectorAll("[data-article-related]").forEach((slider) => {
			let swiper = null;
			let init = false;

			function mountRelatedSlider() {
				if (window.innerWidth < 767.98) {
					if (!init) {
						init = true;
						swiper = new Swiper(slider, {
							slidesPerView: 1.1,
							spaceBetween: 30,
						});
					}
				} else if (init) {
					swiper.destroy(true, true);
					swiper = null;
					init = false;
				}
			}

			mountRelatedSlider();
			window.addEventListener("resize", mountRelatedSlider);
		});
	}

	// power increase calculator
	const powerSection = document.querySelector("[data-power]");
	if (powerSection) {
		const selects = powerSection.querySelectorAll("[data-power-select]");

		function syncPowerEmptyState() {
			const allSelected = Array.from(selects).every((select) => Boolean(select.value));
			powerSection.classList.toggle("is-empty", !allSelected);
		}

		selects.forEach((select) => {
			select.addEventListener("change", syncPowerEmptyState);
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

	// forms
	const leadForms = document.querySelectorAll(".callback__form, .article__form, .article__comment-form");
	const namePattern = /^[A-Za-zА-Яа-яЁё]+(?:[ -][A-Za-zА-Яа-яЁё]+)*$/;

	function isNameValid(value) {
		return namePattern.test(value.trim());
	}

	function isPhoneValid(value) {
		return value.replace(/\D/g, "").length === 11;
	}

	function isLeadInputValid(input) {
		if (input.name === "name") return isNameValid(input.value);
		if (input.type === "tel") return isPhoneValid(input.value);
		return true;
	}

	function setFieldError(field, input, invalid) {
		field.classList.toggle("is-error", invalid);

		if (invalid) {
			input.setAttribute("aria-invalid", "true");
		} else {
			input.removeAttribute("aria-invalid");
		}
	}

	function validateLeadForm(form) {
		let valid = true;

		form.querySelectorAll(".form-field").forEach((field) => {
			const input = field.querySelector("input");
			if (!input || (input.name !== "name" && input.type !== "tel")) return;

			const invalid = !isLeadInputValid(input);
			setFieldError(field, input, invalid);
			if (invalid) valid = false;
		});

		const policy = form.querySelector('input[type="checkbox"][required]');
		if (policy && !policy.checked) valid = false;

		return valid;
	}

	leadForms.forEach((form) => {
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			validateLeadForm(form);
		});

		form.addEventListener("input", (event) => {
			const input = event.target;
			if (!input || typeof input.closest !== "function") return;

			const field = input.closest(".form-field");
			if (!field || !form.contains(field) || !field.classList.contains("is-error")) return;
			if (input.name !== "name" && input.type !== "tel") return;

			setFieldError(field, input, false);
		});
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

	// slide
	const collapsedBox = {
		height: 0,
		paddingTop: 0,
		paddingBottom: 0,
		marginTop: 0,
		marginBottom: 0,
	};

	function parseLength(value) {
		const number = parseFloat(value);
		return Number.isFinite(number) ? number : 0;
	}

	function readBox(style) {
		return {
			height: parseLength(style.getPropertyValue("height")),
			paddingTop: parseLength(style.getPropertyValue("padding-top")),
			paddingBottom: parseLength(style.getPropertyValue("padding-bottom")),
			marginTop: parseLength(style.getPropertyValue("margin-top")),
			marginBottom: parseLength(style.getPropertyValue("margin-bottom")),
		};
	}

	function writeBox(el, box) {
		el.style.height = `${box.height}px`;
		el.style.paddingTop = `${box.paddingTop}px`;
		el.style.paddingBottom = `${box.paddingBottom}px`;
		el.style.marginTop = `${box.marginTop}px`;
		el.style.marginBottom = `${box.marginBottom}px`;
	}

	function mixBox(from, to, progress) {
		return {
			height: from.height + (to.height - from.height) * progress,
			paddingTop: from.paddingTop + (to.paddingTop - from.paddingTop) * progress,
			paddingBottom: from.paddingBottom + (to.paddingBottom - from.paddingBottom) * progress,
			marginTop: from.marginTop + (to.marginTop - from.marginTop) * progress,
			marginBottom: from.marginBottom + (to.marginBottom - from.marginBottom) * progress,
		};
	}

	function easeOutCubic(progress) {
		return 1 - Math.pow(1 - progress, 3);
	}

	function prefersReducedMotion() {
		return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}

	function finishSlide(el, isDown, callback) {
		el.style.height = "";
		el.style.paddingTop = "";
		el.style.paddingBottom = "";
		el.style.marginTop = "";
		el.style.marginBottom = "";
		el.style.overflow = "";
		if (!isDown) el.style.display = "none";
		if (typeof callback === "function") callback();
	}

	function runSlide(el, duration, callback, isDown) {
		if (typeof duration === "undefined") duration = 400;
		if (typeof isDown === "undefined") isDown = false;

		const token = (el._slideToken || 0) + 1;
		el._slideToken = token;

		if (el._slideFrame && typeof window.cancelAnimationFrame === "function") {
			window.cancelAnimationFrame(el._slideFrame);
			el._slideFrame = 0;
		}

		el.style.overflow = "hidden";
		if (isDown) el.style.display = "block";

		if (prefersReducedMotion() || duration <= 0 || typeof window.requestAnimationFrame !== "function") {
			finishSlide(el, isDown, callback);
			return;
		}

		const inlineFrom = el.style.height ? readBox(el.style) : null;

		el.style.height = "";
		el.style.paddingTop = "";
		el.style.paddingBottom = "";
		el.style.marginTop = "";
		el.style.marginBottom = "";

		const natural = readBox(window.getComputedStyle(el));
		if (natural.height === 0 && el.scrollHeight > 0) natural.height = el.scrollHeight;

		const from = inlineFrom || (isDown ? collapsedBox : natural);
		const to = isDown ? natural : collapsedBox;

		// В том же кадре, иначе перед анимацией ответ мигнёт в полный рост.
		writeBox(el, from);

		let start;

		function step(timestamp) {
			if (el._slideToken !== token) return;
			if (start === undefined) start = timestamp;

			const progress = Math.min((timestamp - start) / duration, 1);

			if (progress >= 1) {
				el._slideFrame = 0;
				finishSlide(el, isDown, callback);
				return;
			}

			writeBox(el, mixBox(from, to, easeOutCubic(progress)));
			el._slideFrame = window.requestAnimationFrame(step);
		}

		el._slideFrame = window.requestAnimationFrame(step);
	}

	HTMLElement.prototype.slideToggle = function (duration, callback) {
		runSlide(this, duration, callback, this.clientHeight === 0);
	};

	HTMLElement.prototype.slideUp = function (duration, callback) {
		runSlide(this, duration, callback, false);
	};

	HTMLElement.prototype.slideDown = function (duration, callback) {
		runSlide(this, duration, callback, true);
	};

	// faq
	const faqDuration = 400;

	document.querySelectorAll(".faq__details").forEach((details) => {
		const question = details.querySelector(".faq__question");
		const answer = details.querySelector(".faq__answer");
		if (!question || !answer) return;

		if (details.open) details.classList.add("is-open");

		question.addEventListener("click", (event) => {
			event.preventDefault();

			const willOpen = !details.classList.contains("is-open");
			details.classList.toggle("is-open", willOpen);
			details.classList.toggle("is-closing", !willOpen);

			if (willOpen) {
				details.open = true;
				answer.slideDown(faqDuration);
				return;
			}

			answer.slideUp(faqDuration, () => {
				if (details.classList.contains("is-open")) return;
				details.open = false;
				details.classList.remove("is-closing");
			});
		});
	});
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
