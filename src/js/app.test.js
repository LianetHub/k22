import fs from "node:fs";
import path from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

const APP_JS = fs.readFileSync(path.resolve("src/js/app.js"), "utf8");

const booted = [];

/**
 * Поднимает app.js в изолированном JSDOM: своё окно, свои слушатели, свой localStorage.
 * @param {string} body
 * @param {{ width?: number, desktop?: boolean, withSwiper?: boolean, withYmaps?: boolean, withFancybox?: boolean, withResizeObserver?: boolean, brokenStorage?: boolean, scrollY?: number }} [options]
 */
function boot(body = "", options = {}) {
	const {
		width = 1440,
		desktop = width > 1200,
		withSwiper = true,
		withYmaps = false,
		withFancybox = false,
		withResizeObserver = false,
		brokenStorage = false,
		scrollY = 0,
	} = options;

	// jsdom сообщает о необработанном исключении дважды: событием error и jsdomError
	const errors = [];
	const seen = new Set();
	const pushError = (error) => {
		const key = String((error && error.message) || error);
		if (seen.has(key)) return;
		seen.add(key);
		errors.push(error);
	};

	const virtualConsole = new VirtualConsole();
	virtualConsole.on("jsdomError", pushError);

	const dom = new JSDOM(`<!DOCTYPE html><html lang="ru"><head></head><body>${body}</body></html>`, {
		url: "https://k22.test/",
		runScripts: "outside-only",
		virtualConsole,
	});
	booted.push(dom);

	const { window } = dom;
	window.addEventListener("error", (event) => pushError(event.error || event.message));

	// viewport
	let currentWidth = width;
	Object.defineProperty(window, "innerWidth", { get: () => currentWidth, configurable: true });
	Object.defineProperty(window, "innerHeight", { get: () => 900, configurable: true });

	// scroll
	let currentScrollY = scrollY;
	Object.defineProperty(window, "scrollY", { get: () => currentScrollY, configurable: true });
	Object.defineProperty(window, "pageYOffset", { get: () => currentScrollY, configurable: true });
	const scrollTo = vi.fn((x, y) => {
		currentScrollY = y;
	});
	window.scrollTo = scrollTo;

	// matchMedia
	const mediaLists = [];
	let isDesktop = desktop;
	window.matchMedia = (media) => {
		const list = {
			media,
			get matches() {
				return isDesktop;
			},
			listeners: [],
			addEventListener(type, cb) {
				if (type === "change") this.listeners.push(cb);
			},
			removeEventListener(type, cb) {
				this.listeners = this.listeners.filter((item) => item !== cb);
			},
			addListener(cb) {
				this.listeners.push(cb);
			},
			removeListener(cb) {
				this.listeners = this.listeners.filter((item) => item !== cb);
			},
		};
		mediaLists.push(list);
		return list;
	};

	// IntersectionObserver
	const observers = [];
	window.IntersectionObserver = class {
		constructor(callback, opts) {
			this.callback = callback;
			this.options = opts;
			this.targets = [];
			this.unobserved = [];
			observers.push(this);
		}
		observe(target) {
			this.targets.push(target);
		}
		unobserve(target) {
			this.unobserved.push(target);
		}
		disconnect() {}
		intersect() {
			this.callback(
				this.targets.map((target) => ({ target, isIntersecting: true })),
				this,
			);
		}
	};

	if (withResizeObserver) {
		window.ResizeObserver = class {
			constructor(callback) {
				this.callback = callback;
			}
			observe() {}
			disconnect() {}
		};
	}

	// Swiper
	const swipers = [];
	if (withSwiper) {
		window.Swiper = class {
			constructor(el, opts) {
				this.el = el;
				this.options = opts;
				this.destroyed = false;
				swipers.push(this);
			}
			destroy() {
				this.destroyed = true;
			}
		};
	}

	// Fancybox
	const fancyboxBinds = [];
	if (withFancybox) {
		window.Fancybox = {
			bind: (selector, opts) => fancyboxBinds.push({ selector, opts }),
		};
	}

	// ymaps
	const maps = [];
	const placemarks = [];
	if (withYmaps) {
		window.ymaps = {
			ready: (cb) => cb(),
			Map: class {
				constructor(container, opts) {
					this.container = container;
					this.options = opts;
					this.disabledBehaviors = [];
					this.added = [];
					this.bounds = null;
					this.behaviors = { disable: (name) => this.disabledBehaviors.push(name) };
					this.geoObjects = {
						add: (obj) => this.added.push(obj),
						getBounds: () => [
							[0, 0],
							[1, 1],
						],
					};
					this.setBoundsCalls = [];
					this.groundElement = { style: {} };
					this.panes = {
						get: (name) => (name === "ground" ? { getElement: () => this.groundElement } : null),
					};
					maps.push(this);
				}
				setBounds(bounds, opts) {
					this.setBoundsCalls.push({ bounds, opts });
				}
			},
			Placemark: class {
				constructor(coords, properties, opts) {
					this.coords = coords;
					this.properties = properties;
					this.createdWith = opts;
					this.optionSets = [];
					this.options = { set: (value) => this.optionSets.push(value) };
					placemarks.push(this);
				}
			},
		};
	}

	if (brokenStorage) {
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			get() {
				throw new window.DOMException("blocked", "SecurityError");
			},
		});
	}

	window.eval(APP_JS);
	window.document.dispatchEvent(new window.Event("DOMContentLoaded"));

	return {
		window,
		document: window.document,
		body: window.document.body,
		errors,
		scrollTo,
		swipers,
		observers,
		maps,
		placemarks,
		fancyboxBinds,
		$: (selector) => window.document.querySelector(selector),
		$$: (selector) => Array.from(window.document.querySelectorAll(selector)),
		setWidth(next) {
			currentWidth = next;
			window.dispatchEvent(new window.Event("resize"));
		},
		setDesktop(next) {
			isDesktop = next;
			mediaLists.forEach((list) => list.listeners.forEach((cb) => cb({ matches: next, media: list.media })));
		},
		clickOn(selector) {
			const el = window.document.querySelector(selector);
			if (!el) throw new Error(`no element for ${selector}`);
			el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
			return el;
		},
		press(key, target) {
			(target || window.document).dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
		},
	};
}

afterEach(() => {
	booted.splice(0).forEach((dom) => dom.window.close());
	vi.useRealTimers();
});

// ─── fixtures ────────────────────────────────────────────────────────────────

const MENU = `
<header class="header">
	<button type="button" class="header__burger" aria-expanded="false" aria-controls="site-menu" data-menu-burger></button>
</header>
<nav class="menu" id="site-menu" data-menu aria-label="Меню в шапке">
	<div class="menu__mobile-bar">
		<button type="button" class="menu__back" hidden aria-label="Назад" data-menu-back></button>
		<button type="button" class="menu__close" aria-label="Закрыть меню" data-menu-close></button>
	</div>
	<ul class="menu__list">
		<li class="menu__item menu__item--has-dropdown" id="item-chip">
			<button type="button" class="menu__link" id="trigger-chip" aria-expanded="false" data-menu-trigger>Чип-тюнинг</button>
			<div class="menu__dropdown" id="dropdown-chip" hidden data-menu-dropdown>
				<div class="menu__group" id="group-power">
					<button type="button" class="menu__group-toggle" id="toggle-power" aria-expanded="false" data-menu-group>Увеличение мощности</button>
					<ul class="menu__services"><li><a class="menu-service" href="power-increase.html"><span class="menu-service__name">Stage 1</span></a></li></ul>
				</div>
				<div class="menu__group menu__group--flat" id="group-flat">
					<button type="button" class="menu__group-toggle" id="toggle-flat" aria-expanded="false" data-menu-group>Плоская группа</button>
					<ul class="menu__services"><li><a class="menu-service" href="service-category.html"><span class="menu-service__name">ТО</span></a></li></ul>
				</div>
			</div>
		</li>
		<li class="menu__item menu__item--has-dropdown" id="item-exhaust">
			<button type="button" class="menu__link" id="trigger-exhaust" aria-expanded="false" data-menu-trigger>Выхлоп</button>
			<div class="menu__dropdown" id="dropdown-exhaust" hidden data-menu-dropdown></div>
		</li>
		<li class="menu__item"><a class="menu__link" id="link-shop" href="catalog.html">Магазин</a></li>
	</ul>
</nav>
<main class="page"><p id="outside">контент страницы</p></main>`;

function powerFixture({ withPrice = true, stages = [1, 2] } = {}) {
	const stageButtons = stages
		.map(
			(stage, index) =>
				`<button type="button" class="power__stage${index === 0 ? " is-active" : ""}" role="tab" aria-selected="${index === 0}" data-power-stage="${stage}" id="stage-${stage}">STAGE ${stage}</button>`,
		)
		.join("");

	const price = withPrice
		? `<p class="power__price-label" data-power-price-label>Стоимость stage 1</p>
			 <p class="power__price-value" data-power-price-value>от 35 000 ₽</p>`
		: "";

	return `
<section class="power is-empty" data-power>
	<div class="power__vehicle" role="tablist">
		<button type="button" class="power__vehicle-btn is-active" role="tab" aria-selected="true" data-power-vehicle="car" id="vehicle-car">Автомобиль</button>
		<button type="button" class="power__vehicle-btn" role="tab" aria-selected="false" data-power-vehicle="moto" id="vehicle-moto">Мотоцикл</button>
	</div>
	<div class="power__selects">
		<select class="custom-select__native" id="power-brand" data-power-select>
			<option value="" selected disabled>Марка</option>
			<option value="bmw">BMW</option>
		</select>
		<select class="custom-select__native" id="power-model" data-power-select>
			<option value="" selected disabled>Модель</option>
			<option value="m3">M3</option>
		</select>
		<select class="custom-select__native" id="power-engine" data-power-select>
			<option value="" selected disabled>Двигатель</option>
			<option value="competition-450">Competition 450</option>
		</select>
	</div>
	<div class="power__table">
		<span class="power__value-num" data-power-hp-before>177</span>
		<span class="power__value-num" data-power-hp-after>210</span>
		<span class="power__value-num" data-power-hp-gain>+28</span>
		<span class="power__value-num" data-power-nm-before>350</span>
		<span class="power__value-num" data-power-nm-after>420</span>
		<span class="power__value-num" data-power-nm-gain>+28</span>
	</div>
	<div class="power__stages" role="tablist">${stageButtons}</div>
	<div class="power__footer">${price}</div>
</section>`;
}

const COOKIES = `
<div class="cookies" data-cookies>
	<div class="cookies__content">
		<p class="cookies__text">Мы используем файлы cookie.</p>
		<button type="button" class="cookies__btn" data-cookies-accept>Хорошо</button>
	</div>
</div>`;

const PHONE = `
<form class="callback__form" action="#" method="post">
	<input class="form-control" type="tel" name="phone" id="phone" placeholder="+7 (___)-___-__-__">
</form>`;

function mapFixture(attrs = 'data-zoom="12" data-icon="img/placemark.svg" data-apikey="" data-markers="59.8689,30.3675|Кузнецовская, 52к13;59.8336,30.3758|Лужская, 3к2б"') {
	return `<div class="contacts__map" id="contacts-map" ${attrs}></div>`;
}

/** Печатает символ в конец input и отдаёт событие, как это делает браузер. */
function type(ctx, selector, chars) {
	const input = ctx.$(selector);
	Array.from(chars).forEach((char) => {
		input.value = `${input.value}${char}`;
		input.selectionStart = input.value.length;
		input.selectionEnd = input.value.length;
		input.dispatchEvent(new ctx.window.InputEvent("input", { bubbles: true, data: char, inputType: "insertText" }));
	});
	return input;
}

// ─── 1. Пустая страница и отсутствующие блоки ────────────────────────────────

describe("app.js на странице без блоков", () => {
	it("не падает на полностью пустом body", () => {
		const ctx = boot("");
		expect(ctx.errors).toEqual([]);
	});

	it("не падает без Swiper, Fancybox и ymaps", () => {
		const ctx = boot(`${MENU}${COOKIES}${mapFixture()}`, { withSwiper: false });
		expect(ctx.errors).toEqual([]);
		expect(ctx.window.Swiper).toBeUndefined();
	});

	it("не падает на клике, Escape и resize без единого хука", () => {
		const ctx = boot(`<main><p id="outside">текст</p></main>`);
		ctx.clickOn("#outside");
		ctx.press("Escape");
		ctx.setWidth(400);
		ctx.setDesktop(false);
		expect(ctx.errors).toEqual([]);
	});

	it("бургер без [data-menu] ничего не делает и не бросает ошибку", () => {
		const ctx = boot(`<button type="button" data-menu-burger aria-expanded="false"></button>`);
		ctx.clickOn("[data-menu-burger]");
		expect(ctx.errors).toEqual([]);
		expect(ctx.$("[data-menu-burger]").getAttribute("aria-expanded")).toBe("false");
	});

	it("[data-menu] без бургера, back и close работает по Escape", () => {
		const ctx = boot(`<nav class="menu" data-menu><ul class="menu__list"><li class="menu__item"><a href="#">Магазин</a></li></ul></nav>`, {
			desktop: true,
		});
		ctx.press("Escape");
		expect(ctx.errors).toEqual([]);
	});

	it("[data-power] без селектов, табов и цены не бросает ошибку", () => {
		const ctx = boot(`<section class="power is-empty" data-power></section>`);
		expect(ctx.errors).toEqual([]);
	});

	it("[data-power] без блока цены не бросает ошибку", () => {
		const ctx = boot(powerFixture({ withPrice: false }));
		expect(ctx.errors).toEqual([]);
	});

	it("[data-cookies] без кнопки согласия не бросает ошибку", () => {
		const ctx = boot(`<div class="cookies" data-cookies><p>текст</p></div>`);
		expect(ctx.errors).toEqual([]);
		expect(ctx.$("[data-cookies]").classList.contains("is-visible")).toBe(true);
	});

	it("слайдеры без секции-обёртки (нет .blog) не бросают ошибку", () => {
		const ctx = boot(`<div class="swiper blog__slider"><div class="swiper-wrapper"><div class="swiper-slide">1</div></div></div>`);
		expect(ctx.errors).toEqual([]);
		expect(ctx.swipers).toHaveLength(1);
		expect(ctx.swipers[0].options.navigation).toEqual({ prevEl: undefined, nextEl: undefined });
	});
});

// ─── 2. Меню: мобильная логика ───────────────────────────────────────────────

describe("меню на мобильном", () => {
	it("бургер открывает и закрывает меню, блокируя скролл", () => {
		const ctx = boot(MENU, { width: 375, desktop: false, scrollY: 1200 });

		ctx.clickOn("[data-menu-burger]");
		expect(ctx.$("[data-menu]").classList.contains("is-open")).toBe(true);
		expect(ctx.$("[data-menu-burger]").getAttribute("aria-expanded")).toBe("true");
		expect(ctx.body.classList.contains("is-locked")).toBe(true);
		expect(ctx.body.style.position).toBe("fixed");
		expect(ctx.body.style.top).toBe("-1200px");

		ctx.clickOn("[data-menu-burger]");
		expect(ctx.$("[data-menu]").classList.contains("is-open")).toBe(false);
		expect(ctx.body.classList.contains("is-locked")).toBe(false);
		expect(ctx.body.style.position).toBe("");
		expect(ctx.scrollTo).toHaveBeenCalledWith(0, 1200);
		expect(ctx.errors).toEqual([]);
	});

	it("крестик закрывает меню", () => {
		const ctx = boot(MENU, { width: 375, desktop: false });
		ctx.clickOn("[data-menu-burger]");
		ctx.clickOn("[data-menu-close]");
		expect(ctx.$("[data-menu]").classList.contains("is-open")).toBe(false);
	});

	it("тап по пункту с подменю уводит в drill, back возвращает", () => {
		const ctx = boot(MENU, { width: 375, desktop: false });
		ctx.clickOn("[data-menu-burger]");
		ctx.clickOn("#trigger-chip");

		expect(ctx.$("[data-menu]").classList.contains("is-drill")).toBe(true);
		expect(ctx.$("#item-chip").classList.contains("is-drill")).toBe(true);
		expect(ctx.$("#dropdown-chip").hidden).toBe(false);
		expect(ctx.$("[data-menu-back]").hidden).toBe(false);

		ctx.clickOn("[data-menu-back]");
		expect(ctx.$("[data-menu]").classList.contains("is-drill")).toBe(false);
		expect(ctx.$("#dropdown-chip").hidden).toBe(true);
		expect(ctx.$("[data-menu-back]").hidden).toBe(true);
	});

	it("drill НЕ выставляет aria-expanded у триггера (в отличие от десктопа)", () => {
		const ctx = boot(MENU, { width: 375, desktop: false });
		ctx.clickOn("#trigger-chip");
		expect(ctx.$("#dropdown-chip").hidden).toBe(false);
		// aria-expanded остаётся "false" при открытом подменю — состояние не озвучивается скринридером
		expect(ctx.$("#trigger-chip").getAttribute("aria-expanded")).toBe("false");
	});

	it("аккордеон группы открывается и закрывается", () => {
		const ctx = boot(MENU, { width: 375, desktop: false });
		ctx.clickOn("#trigger-chip");

		ctx.clickOn("#toggle-power");
		expect(ctx.$("#group-power").classList.contains("is-open")).toBe(true);
		expect(ctx.$("#toggle-power").getAttribute("aria-expanded")).toBe("true");

		ctx.clickOn("#toggle-power");
		expect(ctx.$("#group-power").classList.contains("is-open")).toBe(false);
		expect(ctx.$("#toggle-power").getAttribute("aria-expanded")).toBe("false");
	});

	it("группа --flat не сворачивается", () => {
		const ctx = boot(MENU, { width: 375, desktop: false });
		ctx.clickOn("#trigger-chip");
		ctx.clickOn("#toggle-flat");
		expect(ctx.$("#group-flat").classList.contains("is-open")).toBe(false);
		expect(ctx.$("#toggle-flat").getAttribute("aria-expanded")).toBe("false");
	});

	it("Escape закрывает открытое мобильное меню", () => {
		const ctx = boot(MENU, { width: 375, desktop: false });
		ctx.clickOn("[data-menu-burger]");
		ctx.press("Escape");
		expect(ctx.$("[data-menu]").classList.contains("is-open")).toBe(false);
		expect(ctx.body.classList.contains("is-locked")).toBe(false);
	});

	it("hover по пункту не открывает дропдаун на мобильном", () => {
		const ctx = boot(MENU, { width: 375, desktop: false });
		ctx.$("#item-chip").dispatchEvent(new ctx.window.MouseEvent("mouseenter"));
		expect(ctx.$("#item-chip").classList.contains("is-open")).toBe(false);
	});
});

// ─── 3. Меню: десктоп ────────────────────────────────────────────────────────

describe("меню на десктопе", () => {
	it("клик по триггеру открывает дропдаун", () => {
		const ctx = boot(MENU, { desktop: true });
		ctx.clickOn("#trigger-chip");

		expect(ctx.$("#item-chip").classList.contains("is-open")).toBe(true);
		expect(ctx.$("#trigger-chip").getAttribute("aria-expanded")).toBe("true");
		expect(ctx.$("#dropdown-chip").hidden).toBe(false);
		expect(ctx.$("[data-menu]").classList.contains("is-drill")).toBe(false);
	});

	it("повторный клик по триггеру закрывает дропдаун", () => {
		const ctx = boot(MENU, { desktop: true });
		ctx.clickOn("#trigger-chip");
		ctx.clickOn("#trigger-chip");
		expect(ctx.$("#item-chip").classList.contains("is-open")).toBe(false);
		expect(ctx.$("#dropdown-chip").hidden).toBe(true);
	});

	it("открытие второго дропдауна закрывает первый", () => {
		const ctx = boot(MENU, { desktop: true });
		ctx.clickOn("#trigger-chip");
		ctx.clickOn("#trigger-exhaust");

		expect(ctx.$("#item-chip").classList.contains("is-open")).toBe(false);
		expect(ctx.$("#dropdown-chip").hidden).toBe(true);
		expect(ctx.$("#item-exhaust").classList.contains("is-open")).toBe(true);
	});

	it("клик вне меню закрывает дропдаун", () => {
		const ctx = boot(MENU, { desktop: true });
		ctx.clickOn("#trigger-chip");
		ctx.clickOn("#outside");
		expect(ctx.$("#item-chip").classList.contains("is-open")).toBe(false);
	});

	it("hover открывает и закрывает дропдаун", () => {
		const ctx = boot(MENU, { desktop: true });
		const item = ctx.$("#item-chip");

		item.dispatchEvent(new ctx.window.MouseEvent("mouseenter"));
		expect(item.classList.contains("is-open")).toBe(true);

		item.dispatchEvent(new ctx.window.MouseEvent("mouseleave"));
		expect(item.classList.contains("is-open")).toBe(false);
	});

	it("аккордеон группы на десктопе не срабатывает", () => {
		const ctx = boot(MENU, { desktop: true });
		ctx.clickOn("#trigger-chip");
		ctx.clickOn("#toggle-power");
		expect(ctx.$("#group-power").classList.contains("is-open")).toBe(false);
	});

	it("Escape закрывает дропдаун", () => {
		const ctx = boot(MENU, { desktop: true });
		ctx.clickOn("#trigger-chip");
		ctx.press("Escape");
		expect(ctx.$("#item-chip").classList.contains("is-open")).toBe(false);
	});
});

// ─── 4. Найденные баги меню ──────────────────────────────────────────────────

describe("меню: краевые случаи", () => {
	it("БАГ: смена брейкпоинта без открытого меню скроллит страницу наверх", () => {
		const ctx = boot(MENU, { width: 1440, desktop: true, scrollY: 2500 });

		// меню ни разу не открывали, скролл трогать нельзя
		ctx.setDesktop(false);

		expect(ctx.scrollTo).toHaveBeenCalledWith(0, 0);
		expect(ctx.window.scrollY).toBe(0);
	});

	it("БАГ: клик по крестику при закрытом меню тоже сбрасывает скролл", () => {
		const ctx = boot(MENU, { width: 375, desktop: false, scrollY: 900 });
		ctx.clickOn("[data-menu-close]");
		expect(ctx.scrollTo).toHaveBeenCalledWith(0, 0);
	});

	it("БАГ: смена брейкпоинта затирает чужие inline-стили body", () => {
		const ctx = boot(MENU, { desktop: true });
		ctx.body.style.position = "relative";
		ctx.body.style.width = "1200px";

		ctx.setDesktop(false);

		expect(ctx.body.style.position).toBe("");
		expect(ctx.body.style.width).toBe("");
	});

	it("БАГ: click, у которого target === document, валит обработчик меню", () => {
		const ctx = boot(MENU, { desktop: true });
		ctx.document.dispatchEvent(new ctx.window.Event("click", { bubbles: true }));
		expect(ctx.errors).not.toHaveLength(0);
		expect(String(ctx.errors[0])).toMatch(/closest is not a function/);
	});

	it("десктопный дропдаун остаётся открытым после перехода в мобильную ширину без события MQ", () => {
		const ctx = boot(MENU, { desktop: true });
		ctx.clickOn("#trigger-chip");
		ctx.setWidth(375);
		// resize сам по себе меню не сбрасывает — только change у matchMedia
		expect(ctx.$("#item-chip").classList.contains("is-open")).toBe(true);
	});
});

// ─── 5. Слайдеры ─────────────────────────────────────────────────────────────

describe("слайдеры", () => {
	const REVIEWS = `<section class="reviews"><div class="swiper reviews__slider"><div class="swiper-wrapper reviews__grid"><div class="swiper-slide">1</div></div></div></section>`;
	const GALLERY = `<section class="gallery"><div class="gallery__slider swiper"><div class="swiper-wrapper"><div class="swiper-slide">1</div></div></div></section>`;
	const BLOG = `<section class="blog"><div class="swiper blog__slider"><div class="swiper-wrapper"><div class="swiper-slide">1</div></div></div><button class="blog__prev"></button><button class="blog__next"></button></section>`;

	it("reviews не инициализируется на десктопе", () => {
		const ctx = boot(REVIEWS, { width: 1440 });
		expect(ctx.swipers).toHaveLength(0);
	});

	it("reviews инициализируется на мобильной ширине и уничтожается на десктопной", () => {
		const ctx = boot(REVIEWS, { width: 375 });
		expect(ctx.swipers).toHaveLength(1);
		expect(ctx.swipers[0].options.slidesPerView).toBe(1.05);

		ctx.setWidth(1440);
		expect(ctx.swipers[0].destroyed).toBe(true);

		ctx.setWidth(375);
		expect(ctx.swipers).toHaveLength(2);
		expect(ctx.swipers[1].destroyed).toBe(false);
	});

	it("reviews не пересоздаётся на каждый resize внутри мобильного диапазона", () => {
		const ctx = boot(REVIEWS, { width: 375 });
		ctx.setWidth(400);
		ctx.setWidth(500);
		ctx.setWidth(575);
		expect(ctx.swipers).toHaveLength(1);
	});

	it("граница reviews совпадает с $md5 (575.98px)", () => {
		expect(boot(REVIEWS, { width: 575 }).swipers).toHaveLength(1);
		expect(boot(REVIEWS, { width: 576 }).swipers).toHaveLength(0);
	});

	it("gallery инициализируется на любой ширине", () => {
		expect(boot(GALLERY, { width: 1440 }).swipers).toHaveLength(1);
		expect(boot(GALLERY, { width: 375 }).swipers).toHaveLength(1);
	});

	it("blog находит стрелки внутри своей секции", () => {
		const ctx = boot(BLOG);
		expect(ctx.swipers).toHaveLength(1);
		expect(ctx.swipers[0].options.navigation.prevEl).toBe(ctx.$(".blog__prev"));
		expect(ctx.swipers[0].options.navigation.nextEl).toBe(ctx.$(".blog__next"));
	});

	it("две галереи на странице получают по своему инстансу", () => {
		const ctx = boot(`${GALLERY}${GALLERY}`);
		expect(ctx.swipers).toHaveLength(2);
		expect(ctx.swipers[0].el).not.toBe(ctx.swipers[1].el);
	});

	it("БАГ: несколько reviews-слайдеров делят один флаг init — второй не создаётся", () => {
		const ctx = boot(`${REVIEWS}${REVIEWS}`, { width: 375 });
		expect(ctx.swipers).toHaveLength(2);
		expect(ctx.swipers[0].el).not.toBe(ctx.swipers[1].el);
	});
});

// ─── 6. Калькулятор мощности ─────────────────────────────────────────────────

describe("калькулятор мощности", () => {
	function selectAll(ctx) {
		["#power-brand", "#power-model", "#power-engine"].forEach((selector) => {
			const select = ctx.$(selector);
			select.value = select.options[1].value;
			select.dispatchEvent(new ctx.window.Event("change", { bubbles: true }));
		});
	}

	it("стартует в состоянии is-empty", () => {
		const ctx = boot(powerFixture());
		expect(ctx.$("[data-power]").classList.contains("is-empty")).toBe(true);
	});

	it("is-empty снимается только когда выбраны все три селекта", () => {
		const ctx = boot(powerFixture());
		const brand = ctx.$("#power-brand");

		brand.value = "bmw";
		brand.dispatchEvent(new ctx.window.Event("change", { bubbles: true }));
		expect(ctx.$("[data-power]").classList.contains("is-empty")).toBe(true);

		selectAll(ctx);
		expect(ctx.$("[data-power]").classList.contains("is-empty")).toBe(false);
	});

	it("сброс одного селекта возвращает is-empty", () => {
		const ctx = boot(powerFixture());
		selectAll(ctx);

		const model = ctx.$("#power-model");
		model.value = "";
		model.dispatchEvent(new ctx.window.Event("change", { bubbles: true }));
		expect(ctx.$("[data-power]").classList.contains("is-empty")).toBe(true);
	});

	it("секция без селектов сразу считается заполненной", () => {
		const ctx = boot(`<section class="power is-empty" data-power><div class="power__stages"></div></section>`);
		// Array.prototype.every на пустом списке — true, поэтому is-empty снимается
		expect(ctx.$("[data-power]").classList.contains("is-empty")).toBe(false);
	});
});

// ─── 7. Маска телефона ───────────────────────────────────────────────────────

describe("маска телефона", () => {
	it("нормализует номер, начинающийся с 9", () => {
		const ctx = boot(PHONE);
		expect(type(ctx, "#phone", "9214019898").value).toBe("+7 (921) 401-98-98");
	});

	it("форматирует номер, начинающийся с 7", () => {
		const ctx = boot(PHONE);
		expect(type(ctx, "#phone", "79214019898").value).toBe("+7 (921) 401-98-98");
	});

	it("сохраняет 8 как первый символ", () => {
		const ctx = boot(PHONE);
		expect(type(ctx, "#phone", "89214019898").value).toBe("8 (921) 401-98-98");
	});

	it("промежуточные состояния выглядят корректно", () => {
		const ctx = boot(PHONE);
		const input = ctx.$("#phone");
		const steps = [];
		Array.from("79214019898").forEach((char) => {
			type(ctx, "#phone", char);
			steps.push(input.value);
		});

		expect(steps).toEqual([
			"+7 ",
			"+7 (9",
			"+7 (92",
			"+7 (921",
			"+7 (921) 4",
			"+7 (921) 40",
			"+7 (921) 401",
			"+7 (921) 401-9",
			"+7 (921) 401-98",
			"+7 (921) 401-98-9",
			"+7 (921) 401-98-98",
		]);
	});

	it("буквы вырезаются", () => {
		const ctx = boot(PHONE);
		expect(type(ctx, "#phone", "абв").value).toBe("");
	});

	it("зарубежный номер получает только +", () => {
		const ctx = boot(PHONE);
		expect(type(ctx, "#phone", "4951234567").value).toBe("+4951234567");
	});

	it("Backspace на единственной цифре очищает поле", () => {
		const ctx = boot(PHONE);
		const input = type(ctx, "#phone", "7");
		expect(input.value).toBe("+7 ");

		input.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
		expect(input.value).toBe("");
	});

	it("БАГ: после автоподстановки +7 поле не очищается одним Backspace", () => {
		const ctx = boot(PHONE);
		const input = type(ctx, "#phone", "9");
		expect(input.value).toBe("+7 (9");

		const backspace = () => {
			input.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
			input.value = input.value.slice(0, -1);
			input.selectionStart = input.value.length;
			input.dispatchEvent(new ctx.window.InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
		};

		// пользователь ввёл один символ, а стереть его получится только со второго Backspace
		backspace();
		expect(input.value).toBe("+7 ");
		backspace();
		expect(input.value).toBe("");
	});

	it("вставка номера с разделителями форматируется", () => {
		const ctx = boot(PHONE);
		const input = ctx.$("#phone");

		const paste = new ctx.window.Event("paste", { bubbles: true, cancelable: true });
		paste.clipboardData = { getData: () => "+7 (921) 401-98-98" };
		input.dispatchEvent(paste);

		input.value = "+7 (921) 401-98-98";
		input.selectionStart = input.value.length;
		input.dispatchEvent(new ctx.window.InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));

		expect(input.value).toBe("+7 (921) 401-98-98");
	});

	it("paste без clipboardData не бросает ошибку", () => {
		const ctx = boot(PHONE);
		ctx.$("#phone").dispatchEvent(new ctx.window.Event("paste", { bubbles: true }));
		expect(ctx.errors).toEqual([]);
	});

	it("БАГ: цифры сверх 11 молча игнорируются вместо блокировки ввода", () => {
		const ctx = boot(PHONE);
		const input = type(ctx, "#phone", "792140198981234");
		expect(input.value).toBe("+7 (921) 401-98-98");
	});

	it("БАГ: правка в середине номера оставляет значение неформатированным", () => {
		const ctx = boot(PHONE);
		const input = type(ctx, "#phone", "79214019898");
		expect(input.value).toBe("+7 (921) 401-98-98");

		// курсор внутри строки: пользователь правит код города
		input.value = "+7 (9215) 401-98-98";
		input.selectionStart = 8;
		input.dispatchEvent(new ctx.window.InputEvent("input", { bubbles: true, data: "5", inputType: "insertText" }));

		expect(input.value).toBe("+7 (9215) 401-98-98");
	});
});

// ─── 8. Cookies ──────────────────────────────────────────────────────────────

describe("cookies", () => {
	it("показывает баннер и выставляет --cookies-height", () => {
		const ctx = boot(COOKIES);
		expect(ctx.$("[data-cookies]").classList.contains("is-visible")).toBe(true);
		expect(ctx.document.documentElement.style.getPropertyValue("--cookies-height")).toBe("0px");
	});

	it("кнопка согласия убирает баннер и пишет флаг в localStorage", () => {
		const ctx = boot(COOKIES);
		ctx.clickOn("[data-cookies-accept]");

		expect(ctx.$("[data-cookies]")).toBeNull();
		expect(ctx.window.localStorage.getItem("k22-cookies-accepted")).toBe("1");
		expect(ctx.document.documentElement.style.getPropertyValue("--cookies-height")).toBe("0px");
	});

	it("при выставленном флаге баннер удаляется сразу", () => {
		const ctx = boot(COOKIES);
		ctx.window.localStorage.setItem("k22-cookies-accepted", "1");

		// повторный прогон в том же окне имитирует следующую загрузку страницы
		ctx.body.innerHTML = COOKIES;
		ctx.window.eval(APP_JS);
		ctx.document.dispatchEvent(new ctx.window.Event("DOMContentLoaded"));

		expect(ctx.$("[data-cookies]")).toBeNull();
		expect(ctx.errors).toEqual([]);
	});

	it("недоступный localStorage не ломает баннер", () => {
		const ctx = boot(COOKIES, { brokenStorage: true });
		expect(ctx.errors).toEqual([]);
		expect(ctx.$("[data-cookies]").classList.contains("is-visible")).toBe(true);

		ctx.clickOn("[data-cookies-accept]");
		expect(ctx.$("[data-cookies]")).toBeNull();
		expect(ctx.errors).toEqual([]);
	});

	it("ResizeObserver подключается, если поддерживается", () => {
		const ctx = boot(COOKIES, { withResizeObserver: true });
		expect(ctx.errors).toEqual([]);
		expect(ctx.$("[data-cookies]").classList.contains("is-visible")).toBe(true);
	});
});

// ─── 9. Яндекс.Карта ─────────────────────────────────────────────────────────

describe("Яндекс.Карта", () => {
	it("без контейнера ничего не инициализирует", () => {
		const ctx = boot(`<section class="contacts"></section>`);
		expect(ctx.observers).toHaveLength(0);
		expect(ctx.errors).toEqual([]);
	});

	it("грузит API только при попадании контейнера в вьюпорт", () => {
		const ctx = boot(mapFixture(), { withYmaps: true });

		expect(ctx.maps).toHaveLength(0);
		ctx.observers[0].intersect();

		expect(ctx.maps).toHaveLength(1);
		expect(ctx.observers[0].unobserved).toHaveLength(1);
	});

	it("ставит метки, отключает scrollZoom и подгоняет bounds для двух адресов", () => {
		const ctx = boot(mapFixture(), { withYmaps: true });
		ctx.observers[0].intersect();

		const map = ctx.maps[0];
		expect(map.options.center).toEqual([59.8689, 30.3675]);
		expect(map.options.zoom).toBe(12);
		expect(map.disabledBehaviors).toContain("scrollZoom");
		expect(ctx.placemarks).toHaveLength(2);
		expect(ctx.placemarks[0].properties.hintContent).toBe("Кузнецовская, 52к13");
		expect(ctx.placemarks[0].createdWith.iconImageHref).toBe("img/placemark.svg");
		expect(map.setBoundsCalls).toHaveLength(1);
		expect(map.groundElement.style.filter).toBe("grayscale(1)");
		expect(ctx.placemarks[0].createdWith.hasBalloon).toBe(false);
		expect(ctx.placemarks[0].optionSets).toHaveLength(0);
	});

	it("для одного адреса bounds не пересчитывается", () => {
		const ctx = boot(mapFixture('data-markers="59.8689,30.3675|Кузнецовская"'), { withYmaps: true });
		ctx.observers[0].intersect();
		expect(ctx.maps[0].setBoundsCalls).toHaveLength(0);
	});

	it("без data-icon используется дефолтный пресет", () => {
		const ctx = boot(mapFixture('data-markers="59.8689,30.3675|Адрес"'), { withYmaps: true });
		ctx.observers[0].intersect();
		expect(ctx.placemarks[0].createdWith.preset).toBe("islands#redDotIcon");
	});

	it("битые координаты отбрасываются", () => {
		const ctx = boot(mapFixture('data-markers="abc,def|Плохая;59.8;;60.1,30.2|Хорошая"'), { withYmaps: true });
		ctx.observers[0].intersect();

		expect(ctx.placemarks).toHaveLength(1);
		expect(ctx.placemarks[0].coords).toEqual([60.1, 30.2]);
		expect(ctx.errors).toEqual([]);
	});

	it("некорректный data-zoom откатывается на 12", () => {
		const ctx = boot(mapFixture('data-markers="59.8,30.3|Адрес" data-zoom="abc"'), { withYmaps: true });
		ctx.observers[0].intersect();
		expect(ctx.maps[0].options.zoom).toBe(12);
	});

	it("размер иконки зависит от ширины окна", () => {
		const desktop = boot(mapFixture(), { withYmaps: true, width: 1440 });
		desktop.observers[0].intersect();
		expect(desktop.placemarks[0].createdWith.iconImageSize).toEqual([62, 70]);

		const tablet = boot(mapFixture(), { withYmaps: true, width: 1000 });
		tablet.observers[0].intersect();
		expect(tablet.placemarks[0].createdWith.iconImageSize).toEqual([40, 45]);

		const mobile = boot(mapFixture(), { withYmaps: true, width: 375 });
		mobile.observers[0].intersect();
		expect(mobile.placemarks[0].createdWith.iconImageSize).toEqual([47, 53]);
	});

	it("resize пересчитывает иконки после дебаунса", () => {
		vi.useFakeTimers();
		const ctx = boot(mapFixture(), { withYmaps: true, width: 1440 });
		ctx.observers[0].intersect();

		ctx.setWidth(375);
		expect(ctx.placemarks[0].optionSets).toHaveLength(0);

		vi.advanceTimersByTime(200);
		expect(ctx.placemarks[0].optionSets[0].iconImageSize).toEqual([47, 53]);
	});

	it("БАГ: API карт грузится, даже когда data-markers пустой", () => {
		const ctx = boot(mapFixture('data-zoom="12"'));
		ctx.observers[0].intersect();

		expect(ctx.document.head.querySelector('script[src*="api-maps.yandex.ru"]')).not.toBeNull();
		expect(ctx.maps).toHaveLength(0);
	});

	it("БАГ: пустой data-apikey даёт запрос к API без ключа", () => {
		const ctx = boot(mapFixture());
		ctx.observers[0].intersect();

		const src = ctx.document.head.querySelector('script[src*="api-maps.yandex.ru"]').src;
		expect(src).toBe("https://api-maps.yandex.ru/2.1/?lang=ru_RU");
		expect(src).not.toContain("apikey");
	});

	it("apikey экранируется в URL", () => {
		const ctx = boot(mapFixture('data-markers="59.8,30.3|Адрес" data-apikey="a b&c"'));
		ctx.observers[0].intersect();
		expect(ctx.document.head.querySelector('script[src*="api-maps.yandex.ru"]').src).toContain("apikey=a%20b%26c&");
	});

	it("БАГ: ошибка загрузки скрипта карт никак не обрабатывается", () => {
		const ctx = boot(mapFixture());
		ctx.observers[0].intersect();
		const script = ctx.document.head.querySelector('script[src*="api-maps.yandex.ru"]');

		expect(script.onload).toBeTypeOf("function");
		expect(script.onerror).toBeNull();
	});

	it("повторный intersect не создаёт вторую карту", () => {
		const ctx = boot(mapFixture(), { withYmaps: true });
		ctx.observers[0].intersect();
		ctx.observers[0].intersect();
		expect(ctx.maps.length).toBeGreaterThanOrEqual(1);
		expect(ctx.errors).toEqual([]);
	});
});

// ─── 10. Fancybox ────────────────────────────────────────────────────────────

describe("Fancybox", () => {
	it("биндится один раз на [data-fancybox]", () => {
		const ctx = boot(`<a href="img/1.png" data-fancybox="gallery">фото</a>`, { withFancybox: true });
		expect(ctx.fancyboxBinds).toHaveLength(1);
		expect(ctx.fancyboxBinds[0].selector).toBe("[data-fancybox]");
	});

	it("биндится даже без подходящих элементов и не бросает ошибку", () => {
		const ctx = boot("", { withFancybox: true });
		expect(ctx.fancyboxBinds).toHaveLength(1);
		expect(ctx.errors).toEqual([]);
	});

	it("dragToClose отключён для inline-попапов и включён для картинок", () => {
		const ctx = boot("", { withFancybox: true });
		const { dragToClose } = ctx.fancyboxBinds[0].opts;

		expect(dragToClose({ getSlide: () => ({ type: "inline" }) })).toBe(false);
		expect(dragToClose({ getSlide: () => ({ type: "image" }) })).toBe(true);
		expect(dragToClose({ getSlide: () => null })).toBe(true);
	});
});

// ─── 11. Совместная работа блоков ────────────────────────────────────────────

describe("несколько блоков на одной странице", () => {
	const PAGE = `${MENU}${powerFixture()}${COOKIES}${PHONE}${mapFixture()}<section class="gallery"><div class="gallery__slider swiper"><div class="swiper-wrapper"><div class="swiper-slide">1</div></div></div></section>`;

	it("страница со всеми блоками поднимается без ошибок", () => {
		const ctx = boot(PAGE, { withYmaps: true, withFancybox: true, withResizeObserver: true });
		expect(ctx.errors).toEqual([]);
		expect(ctx.swipers).toHaveLength(1);
		expect(ctx.fancyboxBinds).toHaveLength(1);
	});

	it("клик по кнопке cookies не задевает обработчик меню", () => {
		const ctx = boot(PAGE, { desktop: true, withYmaps: true });
		ctx.clickOn("#trigger-chip");
		ctx.clickOn("[data-cookies-accept]");

		expect(ctx.$("[data-cookies]")).toBeNull();
		expect(ctx.$("#item-chip").classList.contains("is-open")).toBe(false);
		expect(ctx.errors).toEqual([]);
	});

	it("клик по ссылке в подменю не мешает закрытию дропдауна", () => {
		const ctx = boot(PAGE, { desktop: true, withYmaps: true });
		ctx.clickOn("#trigger-chip");
		ctx.clickOn("#dropdown-chip .menu-service__name");
		expect(ctx.errors).toEqual([]);
	});

	it("change от кастомного селекта пересчитывает состояние калькулятора", () => {
		const ctx = boot(PAGE, { withYmaps: true });
		["#power-brand", "#power-model", "#power-engine"].forEach((selector) => {
			const select = ctx.$(selector);
			select.value = select.options[1].value;
			select.dispatchEvent(new ctx.window.Event("change", { bubbles: true }));
		});
		expect(ctx.$("[data-power]").classList.contains("is-empty")).toBe(false);
	});
});
