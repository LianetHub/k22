import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomSelect, initCustomSelects } from "./custom-select.js";

const created = [];

/**
 * @param {string} html
 * @returns {HTMLSelectElement}
 */
function mount(html) {
	document.body.insertAdjacentHTML("beforeend", html);
	return Array.from(document.body.querySelectorAll("select")).at(-1);
}

/**
 * @param {HTMLSelectElement} select
 * @param {object} [options]
 * @returns {CustomSelect}
 */
function make(select, options) {
	const instance = new CustomSelect(select, options);
	created.push(instance);
	return instance;
}

function ui(select) {
	const root = select.closest(".custom-select");
	const trigger = root.querySelector(".custom-select__trigger");
	const list = document.getElementById(trigger.getAttribute("aria-controls"));

	return {
		root,
		trigger,
		list,
		value: trigger.querySelector(".custom-select__value"),
		options: () => Array.from(list.querySelectorAll(".custom-select__option")),
	};
}

/**
 * @param {HTMLElement} element
 * @param {string} key
 */
function press(element, key) {
	element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

/**
 * @param {HTMLElement} element
 */
function pointerClick(element) {
	element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
	element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

beforeEach(() => {
	document.body.innerHTML = "";
	CustomSelect.openInstance = null;
});

afterEach(() => {
	created.splice(0).forEach((instance) => {
		try {
			instance.destroy();
		} catch {
			// уже уничтожен внутри теста
		}
	});
	document.body.innerHTML = "";
});

describe("CustomSelect: некорректный аргумент", () => {
	it("бросает TypeError, если передан не select", () => {
		const div = document.createElement("div");
		document.body.appendChild(div);

		expect(() => new CustomSelect(div)).toThrow(TypeError);
	});
});

describe("CustomSelect: вырожденные списки", () => {
	it("селект без option открывается и показывает заглушку", () => {
		const select = mount(`<select id="brand" data-custom-select></select>`);
		const instance = make(select);
		const { list, trigger } = ui(select);

		expect(list.querySelector(".custom-select__empty")).toBeTruthy();

		press(trigger, "Enter");
		expect(instance.isOpen).toBe(true);
		expect(trigger.hasAttribute("aria-activedescendant")).toBe(false);

		press(trigger, "End");
		press(trigger, "Home");
		expect(trigger.hasAttribute("aria-activedescendant")).toBe(false);
	});

	it("все опции disabled: стрелки и Enter ничего не выбирают", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="" disabled selected>Марка</option>
				<option value="bmw" disabled>BMW</option>
			</select>
		`);
		const instance = make(select);
		const { trigger } = ui(select);

		press(trigger, "ArrowDown");
		expect(instance.isOpen).toBe(true);
		expect(trigger.hasAttribute("aria-activedescendant")).toBe(false);

		press(trigger, "Enter");
		expect(select.value).toBe("");
		expect(instance.isOpen).toBe(true);
	});

	it("optgroup без опций не создаёт выбираемых элементов", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<optgroup label="Пусто"></optgroup>
				<option value="bmw">BMW</option>
			</select>
		`);
		make(select);
		const { list, options } = ui(select);

		expect(list.querySelectorAll('[role="group"]')).toHaveLength(1);
		expect(options()).toHaveLength(1);
		expect(list.querySelector(".custom-select__empty")).toBeNull();
	});

	it("плейсхолдер без disabled остаётся выбираемым", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="">Марка</option>
				<option value="bmw" selected>BMW</option>
			</select>
		`);
		make(select);
		const { trigger, value, options } = ui(select);

		expect(value.textContent).toBe("BMW");

		pointerClick(trigger);
		pointerClick(options()[0]);

		expect(select.value).toBe("");
		expect(value.textContent).toBe("Марка");
		expect(value.classList.contains("is-selected")).toBe(false);
	});
});

describe("CustomSelect: id и aria", () => {
	it("два селекта без id получают разные id списков", () => {
		const first = mount(`<select data-custom-select><option value="a">A</option></select>`);
		make(first);
		const second = mount(`<select data-custom-select><option value="b">B</option></select>`);
		make(second);

		const ids = Array.from(document.querySelectorAll('[role="listbox"]')).map((list) => list.id);

		expect(new Set(ids).size).toBe(2);
		ids.forEach((id) => {
			expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
		});
	});

	it("не создаёт дублирующихся id опций для нескольких селектов", () => {
		mount(`<select id="brand" data-custom-select><option value="a">A</option><option value="b">B</option></select>`);
		mount(`<select id="model" data-custom-select><option value="a">A</option><option value="b">B</option></select>`);
		initCustomSelects().forEach((instance) => created.push(instance));

		const ids = Array.from(document.querySelectorAll('[role="option"]')).map((option) => option.id);

		expect(ids).toHaveLength(4);
		expect(new Set(ids).size).toBe(4);
	});

	it("aria-activedescendant всегда указывает на существующий элемент", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw">BMW</option>
				<option value="audi">Audi</option>
			</select>
		`);
		make(select);
		const { trigger } = ui(select);

		press(trigger, "ArrowDown");
		press(trigger, "ArrowDown");

		const activeId = trigger.getAttribute("aria-activedescendant");
		expect(document.getElementById(activeId)).toBeTruthy();

		press(trigger, "Escape");
		expect(trigger.hasAttribute("aria-activedescendant")).toBe(false);
	});

	it("aria-labelledby не теряется после refresh", () => {
		const select = mount(`
			<label for="brand">Марка</label>
			<select id="brand" data-custom-select><option value="bmw">BMW</option></select>
		`);
		const instance = make(select);
		const { trigger } = ui(select);
		const before = trigger.getAttribute("aria-labelledby");

		instance.refresh();

		expect(trigger.getAttribute("aria-labelledby")).toBe(before);
		expect(document.querySelectorAll("label")).toHaveLength(1);
	});
});

describe("CustomSelect: активная и выбранная опция", () => {
	it("active и selected существуют независимо", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw" selected>BMW</option>
				<option value="audi">Audi</option>
			</select>
		`);
		make(select);
		const { trigger, options } = ui(select);

		press(trigger, "ArrowDown");
		press(trigger, "ArrowDown");

		expect(options()[1].classList.contains("is-active")).toBe(true);
		expect(options()[1].getAttribute("aria-selected")).toBe("false");
		expect(options()[0].classList.contains("is-active")).toBe(false);
		expect(options()[0].getAttribute("aria-selected")).toBe("true");
		expect(select.value).toBe("bmw");
	});

	it("навигация без подтверждения не меняет значение", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw" selected>BMW</option>
				<option value="audi">Audi</option>
			</select>
		`);
		make(select);
		const { trigger } = ui(select);
		const onChange = vi.fn();
		select.addEventListener("change", onChange);

		press(trigger, "Enter");
		press(trigger, "ArrowDown");
		press(trigger, "ArrowDown");
		press(trigger, "Escape");

		expect(select.value).toBe("bmw");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("клик вне списка не сбрасывает значение", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw" selected>BMW</option>
				<option value="audi">Audi</option>
			</select>
		`);
		const instance = make(select);
		const { trigger, value } = ui(select);

		trigger.focus();
		press(trigger, "ArrowDown");
		press(trigger, "ArrowDown");
		document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));

		expect(instance.isOpen).toBe(false);
		expect(select.value).toBe("bmw");
		expect(value.textContent).toBe("BMW");
		expect(document.activeElement).toBe(trigger);
	});
});

describe("CustomSelect: typeahead", () => {
	it("находит опцию по первой букве", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw">BMW</option>
				<option value="audi">Audi</option>
			</select>
		`);
		make(select);
		const { trigger, options } = ui(select);

		pointerClick(trigger);
		press(trigger, "a");

		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[1].id);
	});

	it("копит буфер из нескольких букв", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="mercedes">Mercedes</option>
				<option value="mazda">Mazda</option>
				<option value="mini">Mini</option>
			</select>
		`);
		make(select);
		const { trigger, options } = ui(select);

		pointerClick(trigger);
		press(trigger, "m");
		press(trigger, "i");

		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[2].id);
	});

	it("пропускает disabled опции при поиске", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="audi" disabled>Audi</option>
				<option value="aston">Aston Martin</option>
			</select>
		`);
		make(select);
		const { trigger, options } = ui(select);

		pointerClick(trigger);
		press(trigger, "a");

		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[1].id);
	});

	it("не перехватывает сочетания с модификаторами", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw">BMW</option>
				<option value="audi">Audi</option>
			</select>
		`);
		make(select);
		const { trigger, options } = ui(select);

		pointerClick(trigger);
		trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true }));

		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[0].id);
	});
});

describe("CustomSelect: несколько инстансов и повторная инициализация", () => {
	it("initCustomSelects не создаёт второй инстанс для того же select", () => {
		mount(`<select id="brand" data-custom-select><option value="bmw">BMW</option></select>`);

		const first = initCustomSelects();
		const second = initCustomSelects();
		[...first, ...second].forEach((instance) => created.push(instance));

		expect(second[0]).toBe(first[0]);
		expect(document.querySelectorAll(".custom-select__trigger")).toHaveLength(1);
	});

	it("повторная инициализация не удваивает change", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="">Марка</option>
				<option value="bmw">BMW</option>
			</select>
		`);
		initCustomSelects().forEach((instance) => created.push(instance));
		initCustomSelects().forEach((instance) => created.push(instance));

		const onChange = vi.fn();
		select.addEventListener("change", onChange);

		pointerClick(ui(select).trigger);
		pointerClick(ui(select).options()[1]);

		expect(select.value).toBe("bmw");
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("destroy одного инстанса не ломает документные слушатели другого", () => {
		const first = mount(`<select id="brand" data-custom-select><option value="bmw">BMW</option></select>`);
		const second = mount(`<select id="model" data-custom-select><option value="m3">M3</option></select>`);
		const instanceA = make(first);
		make(second);

		instanceA.destroy();

		const instanceB = CustomSelect.get(second);
		instanceB.open();
		document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));

		expect(instanceB.isOpen).toBe(false);
	});

	it("после destroy последнего инстанса документные слушатели снимаются", () => {
		const select = mount(`<select id="brand" data-custom-select><option value="bmw">BMW</option></select>`);
		const instance = make(select);

		instance.destroy();

		expect(CustomSelect.openInstance).toBeNull();
		expect(CustomSelect._documentBound).toBe(0);
	});
});

describe("CustomSelect: динамические изменения", () => {
	it("добавление option в native обновляет список", async () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="">Марка</option>
				<option value="bmw">BMW</option>
			</select>
		`);
		make(select);

		select.append(new Option("Porsche", "porsche"));

		await vi.waitFor(() => expect(ui(select).options()).toHaveLength(3));
		expect(ui(select).options()[2].dataset.value).toBe("porsche");
	});

	it("изменение текста option обновляет подпись", async () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw" selected>BMW</option>
			</select>
		`);
		make(select);

		select.options[0].textContent = "BMW M";

		await vi.waitFor(() => expect(ui(select).value.textContent).toBe("BMW M"));
	});

	it("динамический disabled у option убирает его из навигации", async () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw">BMW</option>
				<option value="audi">Audi</option>
			</select>
		`);
		make(select);
		const { trigger } = ui(select);

		select.options[1].disabled = true;
		await vi.waitFor(() => expect(ui(select).options()[1].getAttribute("aria-disabled")).toBe("true"));

		pointerClick(trigger);
		press(trigger, "ArrowDown");

		expect(trigger.getAttribute("aria-activedescendant")).toBe(ui(select).options()[0].id);
	});

	it("disabled у native закрывает уже открытый список", async () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw">BMW</option>
			</select>
		`);
		const instance = make(select);

		pointerClick(ui(select).trigger);
		expect(instance.isOpen).toBe(true);

		select.disabled = true;

		await vi.waitFor(() => expect(instance.isOpen).toBe(false));
		expect(ui(select).root.classList.contains("is-disabled")).toBe(true);
	});

	it("переключение multiple обновляет aria-multiselectable", async () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="bmw">BMW</option>
			</select>
		`);
		make(select);

		expect(ui(select).list.hasAttribute("aria-multiselectable")).toBe(false);

		select.multiple = true;
		await vi.waitFor(() => expect(ui(select).list.getAttribute("aria-multiselectable")).toBe("true"));
	});

	it("программная синхронизация не шлёт change и input", () => {
		const select = mount(`
			<select id="brand" data-custom-select>
				<option value="">Марка</option>
				<option value="bmw">BMW</option>
			</select>
		`);
		const instance = make(select);
		const events = vi.fn();
		select.addEventListener("change", events);
		select.addEventListener("input", events);

		select.value = "bmw";
		select.selectedIndex = 0;
		select.options[1].selected = true;
		instance.reset();
		instance.refresh();

		expect(events).not.toHaveBeenCalled();
	});
});
