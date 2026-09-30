import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomSelect } from "./custom-select.js";

const instances = [];

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
function create(select, options) {
	const instance = new CustomSelect(select, options);
	instances.push(instance);
	return instance;
}

/**
 * @param {string} [id]
 * @returns {HTMLSelectElement}
 */
function citySelect(id = "city") {
	return mount(`
		<label for="${id}">Город</label>
		<select id="${id}" name="${id}" data-custom-select>
			<option value="">Выберите город</option>
			<option value="moscow">Москва</option>
			<option value="spb" disabled>Санкт-Петербург</option>
			<option value="kazan">Казань</option>
		</select>
	`);
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

beforeEach(() => {
	document.body.innerHTML = "";
	CustomSelect.openInstance = null;
});

afterEach(() => {
	instances.forEach((instance) => {
		try {
			instance.destroy();
		} catch {
			// already destroyed by the test
		}
	});
	instances.length = 0;
	document.body.innerHTML = "";
});

describe("CustomSelect / markup and ARIA", () => {
	it("builds the trigger and listbox from the native select", () => {
		const select = citySelect();
		create(select);
		const { root, trigger, list, options } = ui(select);

		expect(root).toBeTruthy();
		expect(select.classList.contains("custom-select__native")).toBe(true);
		expect(select.isConnected).toBe(true);

		expect(trigger.tagName).toBe("BUTTON");
		expect(trigger.type).toBe("button");
		expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(trigger.getAttribute("aria-controls")).toBe(list.id);

		expect(list.getAttribute("role")).toBe("listbox");
		expect(list.hidden).toBe(true);
		expect(list.tabIndex).toBe(-1);
		expect(list.hasAttribute("aria-multiselectable")).toBe(false);

		expect(options()).toHaveLength(4);
		options().forEach((option) => {
			expect(option.getAttribute("role")).toBe("option");
			expect(option.hasAttribute("aria-selected")).toBe(true);
			// options must stay out of the Tab order
			expect(option.hasAttribute("tabindex")).toBe(false);
		});
	});

	it("marks disabled options with aria-disabled", () => {
		const select = citySelect();
		create(select);
		const [, , spb] = ui(select).options();

		expect(spb.getAttribute("aria-disabled")).toBe("true");
		expect(spb.classList.contains("is-disabled")).toBe(true);
	});

	it("uses the native option value when the attribute is omitted", () => {
		const select = mount(`
			<select id="city" data-custom-select>
				<option>Москва</option>
				<option value="123">Казань</option>
			</select>
		`);
		create(select);
		const [first, second] = ui(select).options();

		expect(first.dataset.value).toBe("Москва");
		expect(second.dataset.value).toBe("123");
	});

	it("renders option text as plain text", () => {
		const select = mount(`
			<select id="city" data-custom-select>
				<option value="x">&lt;img src=x onerror=alert(1)&gt;</option>
			</select>
		`);
		create(select);
		const [option] = ui(select).options();

		expect(option.querySelector("img")).toBeNull();
		expect(option.textContent).toBe("<img src=x onerror=alert(1)>");
	});

	it("generates unique ids for several selects without ids", () => {
		const first = mount(`<select data-custom-select><option value="a">A</option></select>`);
		create(first);
		const second = mount(`<select data-custom-select><option value="b">B</option></select>`);
		create(second);

		const firstList = first.closest(".custom-select").querySelector('[role="listbox"]');
		const secondList = second.closest(".custom-select").querySelector('[role="listbox"]');

		expect(firstList.id).toBeTruthy();
		expect(firstList.id).not.toBe(secondList.id);
		expect(document.querySelectorAll(`#${firstList.id}`)).toHaveLength(1);
	});

	it("keeps the accessible name from a label[for]", () => {
		const select = citySelect();
		create(select);
		const { trigger } = ui(select);
		const label = document.querySelector("label");

		expect(label.id).toBeTruthy();
		expect(trigger.getAttribute("aria-labelledby")).toBe(`${label.id} ${trigger.id}`);
	});

	it("keeps the accessible name from a wrapping label", () => {
		const select = mount(`
			<label>Город
				<select id="city" data-custom-select>
					<option value="moscow">Москва</option>
				</select>
			</label>
		`);
		create(select);
		const { trigger } = ui(select);

		expect(trigger.getAttribute("aria-labelledby")).toContain(document.querySelector("label").id);
	});

	it("mirrors aria-label, aria-describedby and title", () => {
		const select = mount(`
			<p id="city-description">Только города присутствия</p>
			<select id="city" data-custom-select aria-label="Город" aria-describedby="city-description" title="Выберите город" required>
				<option value="">Выберите</option>
				<option value="moscow">Москва</option>
			</select>
		`);
		create(select);
		const { trigger } = ui(select);

		expect(trigger.getAttribute("aria-label")).toBe("Город");
		expect(trigger.getAttribute("aria-describedby")).toBe("city-description");
		expect(trigger.getAttribute("title")).toBe("Выберите город");
		expect(trigger.getAttribute("aria-required")).toBe("true");
	});

	it("reflects aria-invalid on the root", async () => {
		const select = citySelect();
		const instance = create(select);
		const { root, trigger } = ui(select);

		expect(root.classList.contains("is-invalid")).toBe(false);

		select.setAttribute("aria-invalid", "true");
		await vi.waitFor(() => expect(root.classList.contains("is-invalid")).toBe(true));
		expect(trigger.getAttribute("aria-invalid")).toBe("true");

		select.setAttribute("aria-invalid", "false");
		await vi.waitFor(() => expect(root.classList.contains("is-invalid")).toBe(false));

		expect(instance.isOpen).toBe(false);
	});
});

describe("CustomSelect / mouse", () => {
	it("opens, closes on a second click and closes on outside click", () => {
		const select = citySelect();
		create(select);
		const { root, trigger, list } = ui(select);

		pointerClick(trigger);
		expect(root.classList.contains("is-open")).toBe(true);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(list.hidden).toBe(false);

		pointerClick(trigger);
		expect(root.classList.contains("is-open")).toBe(false);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(list.hidden).toBe(true);

		pointerClick(trigger);
		document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
		expect(root.classList.contains("is-open")).toBe(false);
		expect(select.value).toBe("");
	});

	it("selects an option with the mouse and syncs the native select", () => {
		const select = citySelect();
		create(select);
		const { root, trigger, value, options } = ui(select);
		const events = [];
		select.addEventListener("input", () => events.push("input"));
		select.addEventListener("change", () => events.push("change"));

		pointerClick(trigger);
		pointerClick(options()[1]);

		expect(select.value).toBe("moscow");
		expect(value.textContent).toBe("Москва");
		expect(value.classList.contains("is-selected")).toBe(true);
		expect(options()[1].getAttribute("aria-selected")).toBe("true");
		expect(options()[0].getAttribute("aria-selected")).toBe("false");
		expect(root.classList.contains("is-open")).toBe(false);
		expect(document.activeElement).toBe(trigger);
		expect(events).toEqual(["input", "change"]);
	});

	it("ignores clicks on a disabled option", () => {
		const select = citySelect();
		create(select);
		const { root, trigger, options } = ui(select);
		const onChange = vi.fn();
		select.addEventListener("change", onChange);

		pointerClick(trigger);
		pointerClick(options()[2]);

		expect(select.value).toBe("");
		expect(root.classList.contains("is-open")).toBe(true);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("does not fire change when the selected option is clicked again", () => {
		const select = citySelect();
		create(select);
		const { trigger, options } = ui(select);

		pointerClick(trigger);
		pointerClick(options()[1]);

		const onChange = vi.fn();
		select.addEventListener("change", onChange);

		pointerClick(trigger);
		pointerClick(options()[1]);

		expect(select.value).toBe("moscow");
		expect(onChange).not.toHaveBeenCalled();
		expect(ui(select).root.classList.contains("is-open")).toBe(false);
	});

	it("keeps only one dropdown open", () => {
		const first = citySelect("city");
		const second = citySelect("country");
		create(first);
		create(second);

		pointerClick(ui(first).trigger);
		expect(ui(first).root.classList.contains("is-open")).toBe(true);

		pointerClick(ui(second).trigger);
		expect(ui(first).root.classList.contains("is-open")).toBe(false);
		expect(ui(second).root.classList.contains("is-open")).toBe(true);
	});
});

describe("CustomSelect / keyboard", () => {
	it("opens with Enter, Space, ArrowDown and ArrowUp", () => {
		const select = citySelect();
		const instance = create(select);
		const { trigger } = ui(select);

		["Enter", " ", "ArrowDown", "ArrowUp"].forEach((key) => {
			press(trigger, key);
			expect(instance.isOpen).toBe(true);
			instance.close();
		});
	});

	it("activates the last enabled option when opened with ArrowUp", () => {
		const select = citySelect();
		const instance = create(select);
		const { trigger, options } = ui(select);

		press(trigger, "ArrowUp");

		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[3].id);
		expect(options()[3].classList.contains("is-active")).toBe(true);
		expect(instance.isOpen).toBe(true);
	});

	it("moves the active option and skips disabled ones", () => {
		const select = citySelect();
		create(select);
		const { trigger, options } = ui(select);

		press(trigger, "ArrowDown");
		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[0].id);

		press(trigger, "ArrowDown");
		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[1].id);

		// index 2 is disabled and has to be skipped
		press(trigger, "ArrowDown");
		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[3].id);

		press(trigger, "ArrowUp");
		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[1].id);
	});

	it("jumps to the first and last enabled option with Home and End", () => {
		const select = citySelect();
		create(select);
		const { trigger, options } = ui(select);

		press(trigger, "ArrowDown");
		press(trigger, "End");
		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[3].id);

		press(trigger, "Home");
		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[0].id);
	});

	it("selects the active option with Enter", () => {
		const select = citySelect();
		const instance = create(select);
		const { trigger } = ui(select);
		const onChange = vi.fn();
		select.addEventListener("change", onChange);

		trigger.focus();
		press(trigger, "Enter");
		press(trigger, "ArrowDown");
		press(trigger, "Enter");

		expect(select.value).toBe("moscow");
		expect(instance.isOpen).toBe(false);
		expect(document.activeElement).toBe(trigger);
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("selects the active option with Space", () => {
		const select = citySelect();
		create(select);
		const { trigger } = ui(select);

		press(trigger, " ");
		press(trigger, "ArrowDown");
		press(trigger, " ");

		expect(select.value).toBe("moscow");
	});

	it("closes on Escape, keeps the value and returns focus to the trigger", () => {
		const select = citySelect();
		const instance = create(select);
		const { trigger } = ui(select);

		trigger.focus();
		press(trigger, "Enter");
		press(trigger, "ArrowDown");
		press(trigger, "ArrowDown");
		press(trigger, "Escape");

		expect(instance.isOpen).toBe(false);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(trigger.hasAttribute("aria-activedescendant")).toBe(false);
		expect(document.activeElement).toBe(trigger);
		expect(select.value).toBe("");
	});

	it("closes on Tab without preventing the default", () => {
		const select = citySelect();
		const instance = create(select);
		const { trigger } = ui(select);

		press(trigger, "Enter");
		const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
		trigger.dispatchEvent(event);

		expect(instance.isOpen).toBe(false);
		expect(event.defaultPrevented).toBe(false);
	});

	it("moves the active option with typeahead", () => {
		const select = citySelect();
		create(select);
		const { trigger, options } = ui(select);

		press(trigger, "к");

		expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[3].id);
	});
});

describe("CustomSelect / native select as source of truth", () => {
	it("follows select.value", () => {
		const select = citySelect();
		create(select);
		const { value, options } = ui(select);

		select.value = "kazan";

		expect(value.textContent).toBe("Казань");
		expect(options()[3].getAttribute("aria-selected")).toBe("true");
		expect(options()[1].getAttribute("aria-selected")).toBe("false");
	});

	it("follows select.selectedIndex", () => {
		const select = citySelect();
		create(select);

		select.selectedIndex = 1;

		expect(ui(select).value.textContent).toBe("Москва");
	});

	it("follows option.selected", () => {
		const select = citySelect();
		create(select);

		select.options[3].selected = true;

		expect(ui(select).value.textContent).toBe("Казань");
		expect(ui(select).options()[3].classList.contains("is-selected")).toBe(true);
	});

	it("rebuilds after select.innerHTML is replaced", async () => {
		const select = citySelect();
		create(select);

		select.innerHTML = `
			<option value="1">One</option>
			<option value="2">Two</option>
		`;

		await vi.waitFor(() => expect(ui(select).options()).toHaveLength(2));
		expect(ui(select).options()[0].dataset.value).toBe("1");
		expect(ui(select).value.textContent).toBe("One");
	});

	it("survives append and remove", async () => {
		const select = citySelect();
		create(select);

		select.append(new Option("Сочи", "sochi"));
		await vi.waitFor(() => expect(ui(select).options()).toHaveLength(5));

		select.remove(1);
		await vi.waitFor(() => expect(ui(select).options()).toHaveLength(4));
		expect(ui(select).options().map((option) => option.dataset.value)).toEqual(["", "spb", "kazan", "sochi"]);
	});

	it("reacts to select.disabled", async () => {
		const select = citySelect();
		create(select);
		const { root, trigger } = ui(select);

		select.disabled = true;
		await vi.waitFor(() => expect(trigger.disabled).toBe(true));
		expect(root.classList.contains("is-disabled")).toBe(true);

		press(trigger, "Enter");
		expect(root.classList.contains("is-open")).toBe(false);

		select.disabled = false;
		await vi.waitFor(() => expect(trigger.disabled).toBe(false));
		expect(root.classList.contains("is-disabled")).toBe(false);

		press(trigger, "Enter");
		expect(root.classList.contains("is-open")).toBe(true);
	});

	it("keeps native validation and form submission working", () => {
		const select = mount(`
			<form>
				<select id="city" name="city" data-custom-select required>
					<option value="">Выберите город</option>
					<option value="moscow">Москва</option>
				</select>
			</form>
		`);
		create(select);
		const form = select.form;

		expect(form.checkValidity()).toBe(false);

		pointerClick(ui(select).trigger);
		pointerClick(ui(select).options()[1]);

		expect(form.checkValidity()).toBe(true);
		expect(new FormData(form).get("city")).toBe("moscow");
	});

	it("restores the initial selection on form reset", async () => {
		const select = mount(`
			<form>
				<select id="city" name="city" data-custom-select>
					<option value="">Выберите город</option>
					<option value="moscow" selected>Москва</option>
					<option value="kazan">Казань</option>
				</select>
			</form>
		`);
		create(select);

		pointerClick(ui(select).trigger);
		pointerClick(ui(select).options()[2]);
		expect(select.value).toBe("kazan");

		select.form.reset();

		await vi.waitFor(() => expect(ui(select).value.textContent).toBe("Москва"));
		expect(select.value).toBe("moscow");
		expect(ui(select).options()[1].getAttribute("aria-selected")).toBe("true");
	});
});

describe("CustomSelect / optgroup, empty, multiple", () => {
	it("renders optgroups as non-selectable groups", () => {
		const select = mount(`
			<select id="city" data-custom-select>
				<optgroup label="Россия">
					<option value="msk">Москва</option>
					<option value="spb">Санкт-Петербург</option>
				</optgroup>
				<optgroup label="Европа" disabled>
					<option value="berlin">Берлин</option>
				</optgroup>
			</select>
		`);
		create(select);
		const { list, options } = ui(select);
		const groups = list.querySelectorAll('[role="group"]');

		expect(groups).toHaveLength(2);
		expect(groups[0].getAttribute("aria-label")).toBe("Россия");
		expect(groups[0].querySelector(".custom-select__group-label").textContent).toBe("Россия");
		expect(groups[0].querySelectorAll('[role="option"]')).toHaveLength(2);
		expect(options()).toHaveLength(3);
		expect(options()[2].getAttribute("aria-disabled")).toBe("true");
	});

	it("renders an empty state for a select without options", () => {
		const select = mount(`<select id="city" data-custom-select></select>`);
		const instance = create(select);
		const { list, trigger } = ui(select);

		expect(list.querySelector(".custom-select__empty").textContent).toBe("Нет доступных вариантов");

		press(trigger, "Enter");
		expect(instance.isOpen).toBe(true);
		press(trigger, "ArrowDown");
		expect(trigger.hasAttribute("aria-activedescendant")).toBe(false);
	});

	it("supports multiple selection", () => {
		const select = mount(`
			<select id="city" data-custom-select multiple>
				<option value="msk" selected>Москва</option>
				<option value="kazan">Казань</option>
				<option value="perm" selected>Пермь</option>
			</select>
		`);
		const instance = create(select);
		const { list, trigger, value, options } = ui(select);

		expect(list.getAttribute("aria-multiselectable")).toBe("true");
		expect(value.textContent).toBe("Москва, Пермь");

		press(trigger, "ArrowDown");
		press(trigger, "ArrowDown");
		press(trigger, " ");

		expect(instance.isOpen).toBe(true);
		expect(select.selectedOptions).toHaveLength(3);
		expect(value.textContent).toBe("Москва, Казань, Пермь");
		expect(options()[1].getAttribute("aria-selected")).toBe("true");

		press(trigger, " ");
		expect(select.selectedOptions).toHaveLength(2);
		expect(value.textContent).toBe("Москва, Пермь");
	});

	it("accepts a custom formatSelected", () => {
		const select = mount(`
			<select id="city" data-custom-select multiple>
				<option value="msk" selected>Москва</option>
				<option value="perm" selected>Пермь</option>
			</select>
		`);
		create(select, { formatSelected: (labels) => `Выбрано: ${labels.length}` });

		expect(ui(select).value.textContent).toBe("Выбрано: 2");
	});
});

describe("CustomSelect / API and events", () => {
	it("exposes open, close, toggle, select and reset", () => {
		const select = citySelect();
		const instance = create(select);

		instance.open();
		expect(instance.isOpen).toBe(true);
		instance.close();
		expect(instance.isOpen).toBe(false);
		instance.toggle();
		expect(instance.isOpen).toBe(true);
		instance.toggle();
		expect(instance.isOpen).toBe(false);

		instance.select("kazan");
		expect(select.value).toBe("kazan");

		instance.reset();
		expect(select.value).toBe("");
		expect(ui(select).value.textContent).toBe("Выберите город");
	});

	it("ignores select() for a disabled option", () => {
		const select = citySelect();
		const instance = create(select);

		instance.select("spb");
		expect(select.value).toBe("");
	});

	it("re-renders on refresh()", () => {
		const select = citySelect();
		const instance = create(select);

		select.append(new Option("Сочи", "sochi"));
		instance.refresh();

		expect(ui(select).options()).toHaveLength(5);
	});

	it("dispatches custom-select DOM events", () => {
		const select = citySelect();
		create(select);
		const { root, trigger, options } = ui(select);
		const seen = [];

		["open", "close", "change"].forEach((name) => {
			root.addEventListener(`custom-select:${name}`, (event) => {
				seen.push([name, event.detail.value]);
			});
		});

		pointerClick(trigger);
		pointerClick(options()[1]);

		expect(seen).toEqual([
			["open", ""],
			["change", "moscow"],
			["close", "moscow"],
		]);
	});

	it("returns the same instance on repeated initialization", () => {
		const select = citySelect();
		const first = create(select);
		const second = new CustomSelect(select);

		expect(second).toBe(first);
		expect(select.closest(".custom-select").querySelectorAll(".custom-select__trigger")).toHaveLength(1);
		expect(CustomSelect.get(select)).toBe(first);
	});

	it("restores the DOM on destroy", () => {
		const select = citySelect();
		const instance = create(select);
		const root = select.closest(".custom-select");

		instance.destroy();

		expect(root.querySelector(".custom-select__trigger")).toBeNull();
		expect(document.querySelector('[role="listbox"]')).toBeNull();
		expect(select.classList.contains("custom-select__native")).toBe(false);
		expect(select.isConnected).toBe(true);
		expect(CustomSelect.get(select)).toBeUndefined();

		select.value = "moscow";
		expect(select.value).toBe("moscow");
	});

	it("unwraps the generated root on destroy", () => {
		const select = mount(`<select id="city" data-custom-select><option value="a">A</option></select>`);
		const instance = create(select);

		expect(select.parentElement.classList.contains("custom-select")).toBe(true);

		instance.destroy();

		expect(select.parentElement).toBe(document.body);
		expect(document.querySelector(".custom-select")).toBeNull();
	});

	it("reuses an existing .custom-select wrapper", () => {
		const select = mount(`
			<div class="custom-select custom-select--power">
				<label class="visually-hidden" for="city">Город</label>
				<select class="custom-select__native" id="city" data-custom-select>
					<option value="">Марка</option>
					<option value="bmw">BMW</option>
				</select>
			</div>
		`);
		create(select);
		const root = select.closest(".custom-select");

		expect(root.classList.contains("custom-select--power")).toBe(true);
		expect(document.querySelectorAll(".custom-select")).toHaveLength(1);
		expect(root.querySelector(".custom-select__trigger")).toBeTruthy();
	});

	it("initAll picks up every select[data-custom-select]", () => {
		mount(`<select id="a" data-custom-select><option value="1">A</option></select>`);
		mount(`<select id="b" data-custom-select><option value="2">B</option></select>`);
		mount(`<select id="c"><option value="3">C</option></select>`);

		const created = CustomSelect.initAll();
		instances.push(...created);

		expect(created).toHaveLength(2);
		expect(document.querySelectorAll(".custom-select__trigger")).toHaveLength(2);
	});

	it("moves the dropdown with appendTo", () => {
		const container = document.createElement("div");
		container.id = "portal";
		document.body.append(container);

		const select = citySelect();
		const instance = create(select, { appendTo: container });
		const list = container.querySelector('[role="listbox"]');

		expect(list).toBeTruthy();
		expect(list.classList.contains("is-detached")).toBe(true);
		expect(ui(select).trigger.getAttribute("aria-controls")).toBe(list.id);

		instance.open();
		list.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
		expect(instance.isOpen).toBe(true);

		container.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
		expect(instance.isOpen).toBe(false);
	});
});
