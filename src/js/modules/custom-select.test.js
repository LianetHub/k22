import { beforeEach, describe, expect, it } from "vitest";
import { CustomSelect } from "./custom-select.js";

function createSelectMarkup({
	id = "brand",
	options = [
		{ value: "", label: "Марка", disabled: true, selected: true },
		{ value: "bmw", label: "BMW" },
		{ value: "audi", label: "Audi" },
	],
} = {}) {
	const root = document.createElement("div");
	root.className = "custom-select";
	root.dataset.customSelect = "";

	const selected = options.find((item) => item.selected) || options[0];

	root.innerHTML = `
		<select class="custom-select__native" id="${id}" name="${id}">
			${options
				.map(
					(item) =>
						`<option value="${item.value}"${item.selected ? " selected" : ""}${item.disabled ? " disabled" : ""}>${item.label}</option>`
				)
				.join("")}
		</select>
		<button
			type="button"
			class="custom-select__trigger"
			aria-haspopup="listbox"
			aria-expanded="false"
			aria-controls="${id}-list">
			<span class="custom-select__value">${selected.label}</span>
		</button>
		<ul class="custom-select__list" id="${id}-list" role="listbox" hidden>
			${options
				.map(
					(item, index) => `
				<li
					class="custom-select__option${item.selected ? " is-selected" : ""}"
					role="option"
					id="${id}-option-${index}"
					data-value="${item.value}"
					aria-selected="${item.selected ? "true" : "false"}"
					${item.disabled ? 'aria-disabled="true"' : ""}>
					${item.label}
				</li>`
				)
				.join("")}
		</ul>
	`;

	document.body.appendChild(root);
	return root;
}

describe("CustomSelect", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		CustomSelect.openInstance = null;
	});

	it("opens and closes with aria-expanded", () => {
		const root = createSelectMarkup();
		const select = new CustomSelect(root);
		const trigger = root.querySelector(".custom-select__trigger");
		const list = root.querySelector(".custom-select__list");

		trigger.click();
		expect(root.classList.contains("is-open")).toBe(true);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(list.hidden).toBe(false);

		trigger.click();
		expect(root.classList.contains("is-open")).toBe(false);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(list.hidden).toBe(true);

		select.destroy();
	});

	it("selects an option and syncs native value", () => {
		const root = createSelectMarkup();
		const select = new CustomSelect(root);
		const trigger = root.querySelector(".custom-select__trigger");
		const native = root.querySelector(".custom-select__native");
		const valueEl = root.querySelector(".custom-select__value");
		const bmw = root.querySelector('[data-value="bmw"]');

		let changeCount = 0;
		native.addEventListener("change", () => {
			changeCount += 1;
		});

		trigger.click();
		bmw.click();

		expect(native.value).toBe("bmw");
		expect(valueEl.textContent).toBe("BMW");
		expect(valueEl.classList.contains("is-selected")).toBe(true);
		expect(bmw.classList.contains("is-selected")).toBe(true);
		expect(bmw.getAttribute("aria-selected")).toBe("true");
		expect(root.classList.contains("is-open")).toBe(false);
		expect(changeCount).toBe(1);

		select.destroy();
	});

	it("closes on Escape and restores focus to trigger", () => {
		const root = createSelectMarkup();
		const select = new CustomSelect(root);
		const trigger = root.querySelector(".custom-select__trigger");

		trigger.focus();
		trigger.click();
		expect(root.classList.contains("is-open")).toBe(true);

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(root.classList.contains("is-open")).toBe(false);
		expect(document.activeElement).toBe(trigger);

		select.destroy();
	});

	it("supports arrow navigation and Enter selection", () => {
		const root = createSelectMarkup();
		const select = new CustomSelect(root);
		const trigger = root.querySelector(".custom-select__trigger");
		const native = root.querySelector(".custom-select__native");

		trigger.focus();
		trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		expect(root.classList.contains("is-open")).toBe(true);

		trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

		expect(native.value).toBe("bmw");
		expect(root.classList.contains("is-open")).toBe(false);

		select.destroy();
	});

	it("keeps only one dropdown open", () => {
		const first = createSelectMarkup({ id: "first" });
		const second = createSelectMarkup({
			id: "second",
			options: [
				{ value: "", label: "Модель", disabled: true, selected: true },
				{ value: "m3", label: "M3" },
			],
		});

		const selectA = new CustomSelect(first);
		const selectB = new CustomSelect(second);

		first.querySelector(".custom-select__trigger").click();
		expect(first.classList.contains("is-open")).toBe(true);

		second.querySelector(".custom-select__trigger").click();
		expect(first.classList.contains("is-open")).toBe(false);
		expect(second.classList.contains("is-open")).toBe(true);

		selectA.destroy();
		selectB.destroy();
	});

	it("does not select disabled options", () => {
		const root = createSelectMarkup();
		const select = new CustomSelect(root);
		const trigger = root.querySelector(".custom-select__trigger");
		const native = root.querySelector(".custom-select__native");
		const placeholder = root.querySelector('[data-value=""]');

		trigger.click();
		placeholder.click();

		expect(native.value).toBe("");
		expect(root.classList.contains("is-open")).toBe(true);

		select.destroy();
	});

	it("disables trigger when native select is disabled", async () => {
		const root = createSelectMarkup();
		const select = new CustomSelect(root);
		const trigger = root.querySelector(".custom-select__trigger");
		const native = root.querySelector(".custom-select__native");

		native.setAttribute("disabled", "");
		await Promise.resolve();

		expect(trigger.disabled).toBe(true);
		expect(root.classList.contains("is-disabled")).toBe(true);

		select.destroy();
	});
});
