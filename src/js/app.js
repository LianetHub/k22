"use strict";

// Breakpoints
const BP_MD0 = 1919.98;
const BP_MD1 = 1439.98;
const BP_MD2 = 1199.98;
const BP_MD3 = 991.98;
const BP_MD4 = 767.98;
const BP_MD5 = 575.98;

document.addEventListener("DOMContentLoaded", () => {
	// maps
	function initYandexMap() {
		const mapContainer = document.getElementById("contacts-map");
		if (!mapContainer) return;

		const getIconParams = () => {
			const width = window.innerWidth;
			let size = [62, 70];

			if (width <= BP_MD4) {
				size = [47, 53];
			} else if (width <= BP_MD3) {
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

			const parsedZoom = parseInt(mapContainer.dataset.zoom, 10);
			const zoom = Number.isFinite(parsedZoom) ? parsedZoom : 12;
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

			let boundsResult = null;

			if (markers.length > 1) {
				const bounds = map.geoObjects.getBounds();
				if (bounds) {
					boundsResult = map.setBounds(bounds, {
						checkZoomRange: true,
						zoomMargin: 40,
					});
				}
			}

			const applyZoom = () => {
				if (!Number.isFinite(parsedZoom) || typeof map.setZoom !== "function") return;

				map.setZoom(parsedZoom);
			};

			if (boundsResult && typeof boundsResult.then === "function") {
				boundsResult.then(applyZoom);
			} else {
				applyZoom();
			}

			const fitMap = () => {
				if (typeof map.container?.fitToViewport === "function") {
					map.container.fitToViewport();
				}
			};

			fitMap();

			const mapBlock = mapContainer.closest(".contacts__map-block");
			const balloons = mapBlock ? Array.from(mapBlock.querySelectorAll(".contacts__balloon")) : [];
			let openedMarker = "";
			let openedPlacemark = null;
			let skipMapClick = false;
			let syncOpenBalloon = () => {};

			const setPlacemarkVisible = (placemark, visible) => {
				if (!placemark || !placemark.options || typeof placemark.options.set !== "function") return;
				placemark.options.set({ visible });
			};

			if (balloons.length && mapBlock) {
				const closeBalloons = () => {
					openedMarker = "";
					balloons.forEach((balloon) => {
						balloon.classList.remove("is-open");
					});
					setPlacemarkVisible(openedPlacemark, true);
					openedPlacemark = null;
				};

				const placeBalloon = (balloon, coords) => {
					const projection = map.options.get && map.options.get("projection");
					if (!projection || typeof projection.toGlobalPixels !== "function") return;
					if (!map.converter || typeof map.converter.globalToPage !== "function" || typeof map.getZoom !== "function") return;

					const pagePixels = map.converter.globalToPage(projection.toGlobalPixels(coords, map.getZoom()));
					if (!pagePixels) return;

					const blockRect = mapBlock.getBoundingClientRect();
					const scrollX = window.pageXOffset || 0;
					const scrollY = window.pageYOffset || 0;

					balloon.style.left = `${pagePixels[0] - blockRect.left - scrollX}px`;
					balloon.style.top = `${pagePixels[1] - blockRect.top - scrollY}px`;
				};

				syncOpenBalloon = () => {
					if (!openedMarker) return;

					const balloon = balloons.find((item) => item.dataset.marker === openedMarker);
					const marker = markers.find((item) => item.title === openedMarker);
					if (!balloon || !marker) return;

					placeBalloon(balloon, marker.coords);
				};

				placemarks.forEach((placemark, index) => {
					const marker = markers[index];
					if (!marker || !placemark.events || typeof placemark.events.add !== "function") return;

					placemark.events.add("click", (event) => {
						if (event && typeof event.stopPropagation === "function") {
							event.stopPropagation();
						}

						skipMapClick = true;
						queueMicrotask(() => {
							skipMapClick = false;
						});

						const balloon = balloons.find((item) => item.dataset.marker === marker.title);
						if (!balloon) {
							closeBalloons();
							return;
						}

						const willOpen = openedMarker !== marker.title;
						closeBalloons();

						if (willOpen) {
							openedMarker = marker.title;
							openedPlacemark = placemark;
							balloon.classList.add("is-open");
							setPlacemarkVisible(placemark, false);
							placeBalloon(balloon, marker.coords);
						}
					});
				});

				if (map.events && typeof map.events.add === "function") {
					map.events.add("click", () => {
						if (skipMapClick) return;
						closeBalloons();
					});

					map.events.add("actionbegin", () => {
						if (skipMapClick) return;
						closeBalloons();
					});

					map.events.add("boundschange", syncOpenBalloon);
				}

				document.addEventListener("click", (event) => {
					if (skipMapClick || !openedMarker) return;
					if (event.target?.closest?.(".contacts__balloon")) return;

					closeBalloons();
				});
			}

			let resizeTimer = null;
			window.addEventListener("resize", () => {
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(() => {
					fitMap();
					if (iconPath) {
						const nextParams = getIconParams();
						placemarks.forEach((placemark) => {
							placemark.options.set({
								iconImageSize: nextParams.size,
								iconImageOffset: nextParams.offset,
							});
						});
					}
					syncOpenBalloon();
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
	function initContactsCities() {
		const contactsCities = document.querySelector("[data-contacts-cities]");
		const contactsCitiesMq = window.matchMedia(`(max-width: ${BP_MD4}px)`);

		function setOpen(open) {
			if (!contactsCities) return;

			contactsCities.classList.toggle("is-open", open);
			contactsCities.setAttribute("aria-expanded", open ? "true" : "false");
		}

		function onClick(event) {
			if (!contactsCities || !contactsCitiesMq.matches) return;

			const target = event.target;
			const city = target.closest(".contacts__city");

			if (city && contactsCities.contains(city)) {
				const input = city.querySelector(".contacts__city-input");

				if (input && input.checked) {
					event.preventDefault();
					setOpen(!contactsCities.classList.contains("is-open"));
				} else {
					setOpen(false);
				}
			} else if (!target.closest("[data-contacts-cities]")) {
				setOpen(false);
			}
		}

		function onEscape() {
			setOpen(false);
		}

		if (contactsCities) {
			contactsCitiesMq.addEventListener("change", () => {
				setOpen(false);
			});
		}

		return { onClick, onEscape };
	}

	const contactsCities = initContactsCities();

	// products filters
	function initProductsFilters() {
		function onClick(event) {
			const productsSwitch = event.target.closest("[data-products-switch]");
			if (!productsSwitch) return false;

			const productsSection = productsSwitch.closest(".products");
			const isOpen = productsSection?.classList.toggle("is-filters-open") ?? false;

			productsSwitch.setAttribute("aria-expanded", isOpen ? "true" : "false");
			return true;
		}

		return { onClick };
	}

	const productsFilters = initProductsFilters();

	// article rating
	function initArticleRating() {
		function onClick(event) {
			const ratingStar = event.target.closest("[data-article-star]");
			if (!ratingStar) return;

			const group = ratingStar.closest("[data-article-rating]");
			const value = Number(ratingStar.getAttribute("data-article-star"));

			group?.querySelectorAll("[data-article-star]").forEach((star) => {
				const starValue = Number(star.getAttribute("data-article-star"));
				const isActive = starValue <= value;
				star.classList.toggle("is-active", isActive);
				star.setAttribute("aria-pressed", isActive ? "true" : "false");
			});
		}

		return { onClick };
	}

	const articleRating = initArticleRating();

	// header
	function initMenu() {
		const menu = document.querySelector("[data-menu]");
		const menuBurger = document.querySelector("[data-menu-burger]");
		const menuBack = menu?.querySelector("[data-menu-back]");
		const menuClose = menu?.querySelector("[data-menu-close]");
		const desktopMenuMq = window.matchMedia(`(min-width: ${BP_MD2}px)`);
		const tabletMenuMq = window.matchMedia(`(min-width: ${BP_MD5}px)`);
		const menuHoverMq = window.matchMedia("(hover: hover) and (pointer: fine)");
		let menuScrollY = 0;

		function isDesktopMenu() {
			return desktopMenuMq.matches;
		}

		function canHoverMenu() {
			return menuHoverMq.matches;
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
				if (productsFilters.onClick(e)) return;

				contactsCities.onClick(e);
				articleRating.onClick(e);

				const target = e.target;

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
				if (groupToggle && !tabletMenuMq.matches) {
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

				contactsCities.onEscape();

				if (menu.classList.contains("is-open")) {
					closeMobileMenu();
					return;
				}

				closeDesktopDropdowns();
			});

			desktopMenuMq.addEventListener("change", resetMenuOnBreakpoint);

			menu.querySelectorAll(".menu__item--has-dropdown").forEach((item) => {
				item.addEventListener("mouseenter", () => {
					if (!isDesktopMenu() || !canHoverMenu()) return;
					openDesktopDropdown(item);
				});

				item.addEventListener("mouseleave", () => {
					if (!isDesktopMenu() || !canHoverMenu()) return;
					closeDesktopDropdowns();
				});
			});
		}
	}

	initMenu();

	// sliders
	function initSliders() {
		if (typeof Swiper !== "undefined") {
			function getMobileSlider(sliderName, options) {
				let init = false;
				let swiper = null;

				function getSwiper() {
					if (window.innerWidth <= BP_MD5) {
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
						[BP_MD4]: {
							slidesPerView: 2,
							spaceBetween: 30,
						},
						[BP_MD1]: {
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
						[BP_MD4]: {
							slidesPerView: 2.22,
							spaceBetween: 10,
						},
						[BP_MD1]: {
							slidesPerView: 4,
							spaceBetween: 30,
						},
						[BP_MD0]: {
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
						[BP_MD4]: {
							slidesPerView: 1.61,
						},
						[BP_MD2]: {
							slidesPerView: 2,
						},
						[BP_MD1]: {
							slidesPerView: 3,
						},
					},
				});
			});

			document.querySelectorAll(".works--related .works__slider")?.forEach((slider) => {
				let swiper = null;
				let init = false;

				function mountRelatedWorks() {
					const tablet = window.innerWidth >= BP_MD4 && window.innerWidth < BP_MD1;

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
					slidesPerView: "auto",
					spaceBetween: 10,
					breakpoints: {
						[BP_MD4]: {
							spaceBetween: 30,
						},
						[BP_MD1]: {
							spaceBetween: 30,
						},
					},
				});
			});

			document.querySelectorAll(".article__reviews-slider")?.forEach((slider) => {
				let swiper = null;
				let mode = "";

				function reviewsMode() {
					if (window.innerWidth >= BP_MD1) return "sidebar";
					if (window.innerWidth >= BP_MD4) return "grid";
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

			document.querySelectorAll("[data-article-related]")?.forEach((slider) => {
				let swiper = null;
				let init = false;

				function mountRelatedSlider() {
					if (window.innerWidth < BP_MD4) {
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
	}

	initSliders();

	// power increase calculator
	function initPowerCalculator() {
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
	}

	initPowerCalculator();

	// phone mask
	function initPhoneMask() {
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
	}

	initPhoneMask();

	// forms
	function initLeadForms() {
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
	}

	initLeadForms();

	// cookies
	function initCookies() {
		const cookies = document.querySelector("[data-cookies]");
		if (cookies) {
			const cookiesKey = "k22-cookies-accepted";

			function isCookiesAccepted() {
				try {
					return document.cookie.split(";").some((part) => part.trim() === `${cookiesKey}=1`);
				} catch (error) {
					// cookies недоступны
					return false;
				}
			}

			function saveCookiesConsent() {
				try {
					document.cookie = `${cookiesKey}=1; path=/; max-age=31536000; SameSite=Lax`;
				} catch (error) {
					// cookies недоступны
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
	}

	initCookies();

	// slide
	function initSlide() {
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
	}

	initSlide();

	// faq
	function initFaq() {
		const faqDuration = 400;

		document.querySelectorAll(".faq__details").forEach((details) => {
			const question = details.querySelector(".faq__question");
			const answer = details.querySelector(".faq__answer");
			if (!question || !answer) return;

			if (details.open) details.classList.add("is-open");

			details.addEventListener("click", (event) => {
				if (event.target.closest("a, button")) return;

				const selection = window.getSelection();
				if (selection && !selection.isCollapsed && details.contains(selection.anchorNode)) return;

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
	}

	initFaq();
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
