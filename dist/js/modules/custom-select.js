/**
 * Accessible custom select driven by a native <select>.
 * The native element stays in the DOM and remains the source of truth for
 * value / name / form / required / validation / change / reset.
 *
 * Usage:
 *   new CustomSelect(select, options)
 *   CustomSelect.init(select, options)
 *   CustomSelect.initAll(scope, options)
 */

const ROOT_CLASS = "custom-select";
const NATIVE_CLASS = "custom-select__native";
const TRIGGER_CLASS = "custom-select__trigger";
const VALUE_CLASS = "custom-select__value";
const LIST_CLASS = "custom-select__list";
const OPTION_CLASS = "custom-select__option";
const GROUP_CLASS = "custom-select__group";
const GROUP_LABEL_CLASS = "custom-select__group-label";
const EMPTY_CLASS = "custom-select__empty";

const OPEN_CLASS = "is-open";
const OPEN_TOP_CLASS = "is-open-top";
const DETACHED_CLASS = "is-detached";
const SELECTED_CLASS = "is-selected";
const ACTIVE_CLASS = "is-active";
const DISABLED_CLASS = "is-disabled";
const FOCUSED_CLASS = "is-focused";
const INVALID_CLASS = "is-invalid";

const TYPEAHEAD_TIMEOUT = 500;
const MIRRORED_ATTRIBUTES = ["aria-describedby", "aria-errormessage", "title"];

const DEFAULTS = {
	appendTo: null,
	maxHeight: 300,
	searchable: false,
	emptyText: "Нет доступных вариантов",
	formatSelected: (labels) => labels.join(", "),
	triggerIcon: "icon-chevron-down",
};

let uid = 0;
let hooksInstalled = false;

/**
 * @param {string} base
 * @returns {string}
 */
function uniqueId(base) {
	let id = base;
	while (document.getElementById(id)) {
		uid += 1;
		id = `${base}-${uid}`;
	}
	return id;
}

/**
 * `select.value`, `select.selectedIndex` and `option.selected` change no
 * attribute and fire no event, so a MutationObserver cannot see them. The
 * prototype setters are wrapped once and forward to the original before asking
 * the owning instance to re-sync; elements without an instance are untouched.
 */
function installNativeHooks() {
	if (hooksInstalled) return;
	hooksInstalled = true;

	const instanceFor = (select) => {
		const instance = CustomSelect.instances.get(select);
		return instance && !instance._isSyncing ? instance : null;
	};

	const hook = (prototype, property, resolve) => {
		const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
		if (!descriptor?.set) return;

		Object.defineProperty(prototype, property, {
			...descriptor,
			set(value) {
				descriptor.set.call(this, value);
				resolve(this)?.syncFromNative();
			},
		});
	};

	hook(HTMLSelectElement.prototype, "value", instanceFor);
	hook(HTMLSelectElement.prototype, "selectedIndex", instanceFor);
	hook(HTMLOptionElement.prototype, "selected", (option) => {
		const select = option.closest("select");
		return select ? instanceFor(select) : null;
	});
}

export class CustomSelect {
	static instances = new WeakMap();
	static openInstance = null;
	static _documentBound = 0;

	/**
	 * @param {HTMLSelectElement} select
	 * @param {Partial<typeof DEFAULTS>} [options]
	 */
	constructor(select, options = {}) {
		if (!(select instanceof HTMLSelectElement)) {
			throw new TypeError("CustomSelect: expected a <select> element");
		}

		const existing = CustomSelect.instances.get(select);
		if (existing) {
			return existing;
		}

		this.native = select;
		this.options = { ...DEFAULTS, ...this._readDataOptions(), ...options };

		this.isOpen = false;
		this.activeIndex = -1;
		this.optionEls = [];
		this.typeaheadBuffer = "";
		this.typeaheadTimer = null;
		this._isSyncing = false;
		this._createdRoot = false;

		this._onTriggerPointerDown = this._onTriggerPointerDown.bind(this);
		this._onTriggerKeydown = this._onTriggerKeydown.bind(this);
		this._onTriggerFocus = this._onTriggerFocus.bind(this);
		this._onTriggerBlur = this._onTriggerBlur.bind(this);
		this._onListPointerDown = this._onListPointerDown.bind(this);
		this._onListClick = this._onListClick.bind(this);
		this._onNativeChange = this._onNativeChange.bind(this);
		this._onFormReset = this._onFormReset.bind(this);
		this._onViewportChange = this._onViewportChange.bind(this);
		this._onMutation = this._onMutation.bind(this);

		installNativeHooks();
		CustomSelect.instances.set(select, this);

		this.init();
	}

	/**
	 * @param {HTMLSelectElement} select
	 * @param {Partial<typeof DEFAULTS>} [options]
	 * @returns {CustomSelect}
	 */
	static init(select, options) {
		return new CustomSelect(select, options);
	}

	/**
	 * @param {ParentNode} [scope]
	 * @param {Partial<typeof DEFAULTS>} [options]
	 * @returns {CustomSelect[]}
	 */
	static initAll(scope = document, options) {
		return Array.from(scope.querySelectorAll("select[data-custom-select]")).map(
			(select) => new CustomSelect(select, options)
		);
	}

	/**
	 * @param {HTMLSelectElement} select
	 * @returns {CustomSelect | undefined}
	 */
	static get(select) {
		return CustomSelect.instances.get(select);
	}

	init() {
		this.render();
		this.renderOptions();
		this.bindEvents();
		this.bindDocumentEvents();
		this.bindNativeSelectEvents();
		this.syncFromNative();
		this.updateDisabled();
		this.updateValidity();
	}

	// render

	render() {
		const parent = this.native.parentElement;

		if (parent && parent.classList.contains(ROOT_CLASS)) {
			this.root = parent;
		} else {
			this.root = document.createElement("div");
			this.root.className = ROOT_CLASS;
			this._createdRoot = true;
			this.native.replaceWith(this.root);
			this.root.append(this.native);
		}

		this.native.classList.add(NATIVE_CLASS);

		const base = this.native.id || `custom-select-${(uid += 1)}`;
		this.baseId = base;

		this.trigger = document.createElement("button");
		this.trigger.type = "button";
		this.trigger.className = TRIGGER_CLASS;
		if (this.options.triggerIcon) {
			this.trigger.classList.add(this.options.triggerIcon);
		}
		this.trigger.id = uniqueId(`${base}-trigger`);
		this.trigger.setAttribute("aria-haspopup", "listbox");
		this.trigger.setAttribute("aria-expanded", "false");

		this.valueEl = document.createElement("span");
		this.valueEl.className = VALUE_CLASS;
		this.trigger.append(this.valueEl);

		this.list = document.createElement("div");
		this.list.className = LIST_CLASS;
		this.list.id = uniqueId(`${base}-listbox`);
		this.list.setAttribute("role", "listbox");
		this.list.tabIndex = -1;
		this.list.hidden = true;
		this.updateMultiple();
		if (this.options.maxHeight) {
			this.list.style.maxHeight = `${this.options.maxHeight}px`;
		}

		this.trigger.setAttribute("aria-controls", this.list.id);

		this.native.after(this.trigger);
		this.trigger.after(this.list);

		if (this.options.appendTo) {
			this.list.classList.add(DETACHED_CLASS);
			this.options.appendTo.append(this.list);
		}

		this.updateAccessibleName();
	}

	updateAccessibleName() {
		const ariaLabel = this.native.getAttribute("aria-label");
		if (ariaLabel) {
			this.trigger.setAttribute("aria-label", ariaLabel);
		} else {
			this.trigger.removeAttribute("aria-label");
		}

		const labelIds = [];
		const ariaLabelledBy = this.native.getAttribute("aria-labelledby");

		if (ariaLabelledBy) {
			labelIds.push(ariaLabelledBy);
		} else {
			const label = this._findLabel();
			if (label) {
				if (!label.id) {
					label.id = uniqueId(`${this.baseId}-label`);
				}
				labelIds.push(label.id);
			}
		}

		if (labelIds.length) {
			// Trigger content is the current value; keeping its own id in the list
			// makes the accessible name read as "<label> <value>".
			this.trigger.setAttribute("aria-labelledby", `${labelIds.join(" ")} ${this.trigger.id}`);
		} else {
			this.trigger.removeAttribute("aria-labelledby");
		}

		MIRRORED_ATTRIBUTES.forEach((name) => {
			const value = this.native.getAttribute(name);
			if (value) {
				this.trigger.setAttribute(name, value);
			} else {
				this.trigger.removeAttribute(name);
			}
		});

		if (this.native.required) {
			this.trigger.setAttribute("aria-required", "true");
		} else {
			this.trigger.removeAttribute("aria-required");
		}
	}

	renderOptions() {
		const activeValue = this.optionEls[this.activeIndex]?.dataset.value ?? null;

		this.list.textContent = "";
		this.optionEls = [];

		Array.from(this.native.children).forEach((child) => {
			if (child instanceof HTMLOptGroupElement) {
				const group = document.createElement("div");
				group.className = GROUP_CLASS;
				group.setAttribute("role", "group");
				group.setAttribute("aria-label", child.label);

				const label = document.createElement("div");
				label.className = GROUP_LABEL_CLASS;
				label.textContent = child.label;
				label.setAttribute("aria-hidden", "true");
				group.append(label);

				Array.from(child.children).forEach((option) => {
					if (option instanceof HTMLOptionElement) {
						group.append(this.renderOption(option, child.disabled));
					}
				});

				this.list.append(group);
				return;
			}

			if (child instanceof HTMLOptionElement) {
				this.list.append(this.renderOption(child, false));
			}
		});

		if (!this.optionEls.length) {
			const empty = document.createElement("div");
			empty.className = EMPTY_CLASS;
			empty.textContent = this.options.emptyText;
			this.list.append(empty);
		}

		this.activeIndex = activeValue === null ? -1 : this.optionEls.findIndex((el) => el.dataset.value === activeValue);
		this.updateActiveOption();
	}

	/**
	 * @param {HTMLOptionElement} option
	 * @param {boolean} groupDisabled
	 * @returns {HTMLElement}
	 */
	renderOption(option, groupDisabled) {
		const index = this.optionEls.length;
		const el = document.createElement("div");
		const disabled = option.disabled || groupDisabled;

		el.className = OPTION_CLASS;
		el.id = uniqueId(`${this.baseId}-option-${index}`);
		el.setAttribute("role", "option");
		el.setAttribute("aria-selected", option.selected ? "true" : "false");
		el.dataset.value = option.value;
		el.dataset.index = String(option.index);
		el.textContent = option.text;

		if (disabled) {
			el.setAttribute("aria-disabled", "true");
			el.classList.add(DISABLED_CLASS);
		}
		if (option.selected) {
			el.classList.add(SELECTED_CLASS);
		}

		this.optionEls.push(el);
		return el;
	}

	// events

	bindEvents() {
		this.trigger.addEventListener("pointerdown", this._onTriggerPointerDown);
		this.trigger.addEventListener("keydown", this._onTriggerKeydown);
		this.trigger.addEventListener("focus", this._onTriggerFocus);
		this.trigger.addEventListener("blur", this._onTriggerBlur);
		this.list.addEventListener("pointerdown", this._onListPointerDown);
		this.list.addEventListener("click", this._onListClick);
	}

	bindDocumentEvents() {
		if (CustomSelect._documentBound === 0) {
			CustomSelect._onDocumentPointerDown = (event) => {
				const instance = CustomSelect.openInstance;
				if (!instance) return;
				if (instance.root.contains(event.target) || instance.list.contains(event.target)) return;
				instance.close();
			};

			CustomSelect._onDocumentKeydown = (event) => {
				if (event.key !== "Escape") return;
				const instance = CustomSelect.openInstance;
				if (!instance) return;
				event.preventDefault();
				instance.close({ restoreFocus: true });
			};

			document.addEventListener("pointerdown", CustomSelect._onDocumentPointerDown, true);
			document.addEventListener("keydown", CustomSelect._onDocumentKeydown, true);
		}

		CustomSelect._documentBound += 1;
	}

	unbindDocumentEvents() {
		CustomSelect._documentBound -= 1;

		if (CustomSelect._documentBound <= 0) {
			CustomSelect._documentBound = 0;
			document.removeEventListener("pointerdown", CustomSelect._onDocumentPointerDown, true);
			document.removeEventListener("keydown", CustomSelect._onDocumentKeydown, true);
		}
	}

	bindNativeSelectEvents() {
		this.native.addEventListener("change", this._onNativeChange);

		this.form = this.native.form;
		if (this.form) {
			this.form.addEventListener("reset", this._onFormReset);
		}

		this.observer = new MutationObserver(this._onMutation);
		this.observer.observe(this.native, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
		});
	}

	// state

	open() {
		if (this.isOpen || this.native.disabled) return;

		if (CustomSelect.openInstance && CustomSelect.openInstance !== this) {
			CustomSelect.openInstance.close();
		}

		this.isOpen = true;
		this.list.hidden = false;
		this.root.classList.add(OPEN_CLASS);
		this.trigger.setAttribute("aria-expanded", "true");
		CustomSelect.openInstance = this;

		const selected = this.optionEls.find((el) => el.classList.contains(SELECTED_CLASS));
		const fallback = this.enabledOptions[0] || null;
		this.activeIndex = this.optionEls.indexOf(
			selected && !selected.classList.contains(DISABLED_CLASS) ? selected : fallback
		);
		this.updateActiveOption();

		this.updatePosition();
		window.addEventListener("scroll", this._onViewportChange, true);
		window.addEventListener("resize", this._onViewportChange);

		this.emit("open");
	}

	/**
	 * @param {{ restoreFocus?: boolean }} [params]
	 */
	close({ restoreFocus = false } = {}) {
		if (!this.isOpen) return;

		this.isOpen = false;
		this.list.hidden = true;
		this.root.classList.remove(OPEN_CLASS, OPEN_TOP_CLASS);
		this.trigger.setAttribute("aria-expanded", "false");
		this.trigger.removeAttribute("aria-activedescendant");
		this.activeIndex = -1;
		this.updateActiveOption();
		this._resetTypeahead();

		if (CustomSelect.openInstance === this) {
			CustomSelect.openInstance = null;
		}

		window.removeEventListener("scroll", this._onViewportChange, true);
		window.removeEventListener("resize", this._onViewportChange);

		if (restoreFocus) {
			this.trigger.focus();
		}

		this.emit("close");
	}

	toggle() {
		if (this.isOpen) {
			this.close({ restoreFocus: true });
		} else {
			this.open();
		}
	}

	/**
	 * @param {string} value
	 */
	select(value) {
		const option = this.optionEls.find((el) => el.dataset.value === value);
		if (option) {
			this.selectOption(option);
		}
	}

	reset() {
		this._mutateNative(() => {
			Array.from(this.native.options).forEach((option) => {
				option.selected = option.defaultSelected;
			});
		});
		this.syncFromNative();
	}

	refresh() {
		this.updateAccessibleName();
		this.renderOptions();
		this.syncFromNative();
		this.updateDisabled();
		this.updateValidity();
	}

	destroy() {
		this.close();
		this.observer?.disconnect();
		this.unbindDocumentEvents();

		this.trigger.removeEventListener("pointerdown", this._onTriggerPointerDown);
		this.trigger.removeEventListener("keydown", this._onTriggerKeydown);
		this.trigger.removeEventListener("focus", this._onTriggerFocus);
		this.trigger.removeEventListener("blur", this._onTriggerBlur);
		this.list.removeEventListener("pointerdown", this._onListPointerDown);
		this.list.removeEventListener("click", this._onListClick);
		this.native.removeEventListener("change", this._onNativeChange);
		this.form?.removeEventListener("reset", this._onFormReset);
		this._resetTypeahead();

		this.trigger.remove();
		this.list.remove();
		this.native.classList.remove(NATIVE_CLASS);
		this.root.classList.remove(OPEN_CLASS, OPEN_TOP_CLASS, DISABLED_CLASS, FOCUSED_CLASS, INVALID_CLASS);

		if (this._createdRoot) {
			this.root.replaceWith(this.native);
		}

		CustomSelect.instances.delete(this.native);
	}

	/**
	 * @param {HTMLElement} option
	 */
	selectOption(option) {
		if (!option || option.classList.contains(DISABLED_CLASS)) return;

		const nativeOption = this.native.options[Number(option.dataset.index)];
		if (!nativeOption) return;

		const previousValue = this._currentValue();

		this._mutateNative(() => {
			if (this.native.multiple) {
				nativeOption.selected = !nativeOption.selected;
			} else {
				this.native.selectedIndex = nativeOption.index;
			}
		});

		this.syncFromNative();

		if (this._currentValue() !== previousValue) {
			this.native.dispatchEvent(new Event("input", { bubbles: true }));
			this.native.dispatchEvent(new Event("change", { bubbles: true }));
			this.emit("change");
		}

		if (this.native.multiple) {
			this.activeIndex = this.optionEls.indexOf(option);
			this.updateActiveOption();
		} else {
			this.close({ restoreFocus: true });
		}
	}

	/**
	 * Applies a write to the native select without letting the observer or the
	 * patched accessors react to our own change.
	 *
	 * @param {() => void} mutate
	 */
	_mutateNative(mutate) {
		this._isSyncing = true;
		mutate();
		this.observer?.takeRecords();
		this._isSyncing = false;
	}

	syncFromNative() {
		const valueLabels = [];
		let placeholder = "";

		this.optionEls.forEach((el) => {
			const nativeOption = this.native.options[Number(el.dataset.index)];
			const isSelected = Boolean(nativeOption?.selected);

			el.setAttribute("aria-selected", isSelected ? "true" : "false");
			el.classList.toggle(SELECTED_CLASS, isSelected);

			if (!isSelected) return;

			if (nativeOption.value) {
				valueLabels.push(el.textContent);
			} else if (!placeholder) {
				placeholder = el.textContent;
			}
		});

		const hasValue = valueLabels.length > 0;

		this.valueEl.textContent = hasValue
			? this.options.formatSelected(valueLabels)
			: placeholder || this.optionEls[0]?.textContent || "";
		this.valueEl.classList.toggle(SELECTED_CLASS, hasValue);
	}

	updateActiveOption() {
		this.optionEls.forEach((el, index) => {
			el.classList.toggle(ACTIVE_CLASS, index === this.activeIndex);
		});

		const active = this.optionEls[this.activeIndex];

		if (active && this.isOpen) {
			this.trigger.setAttribute("aria-activedescendant", active.id);
			if (typeof active.scrollIntoView === "function") {
				active.scrollIntoView({ block: "nearest" });
			}
		} else {
			this.trigger.removeAttribute("aria-activedescendant");
		}
	}

	updateMultiple() {
		if (this.native.multiple) {
			this.list.setAttribute("aria-multiselectable", "true");
		} else {
			this.list.removeAttribute("aria-multiselectable");
		}
	}

	updateDisabled() {
		const disabled = this.native.disabled;
		this.trigger.disabled = disabled;
		this.root.classList.toggle(DISABLED_CLASS, disabled);
		if (disabled) {
			this.close();
		}
	}

	updateValidity() {
		const invalid = this.native.getAttribute("aria-invalid");

		if (invalid && invalid !== "false") {
			this.trigger.setAttribute("aria-invalid", invalid);
			this.root.classList.add(INVALID_CLASS);
		} else {
			this.trigger.removeAttribute("aria-invalid");
			this.root.classList.remove(INVALID_CLASS);
		}
	}

	updatePosition() {
		this.root.classList.remove(OPEN_TOP_CLASS);

		const triggerRect = this.trigger.getBoundingClientRect();

		if (this.list.classList.contains(DETACHED_CLASS)) {
			this.list.style.left = `${triggerRect.left}px`;
			this.list.style.width = `${triggerRect.width}px`;
			this.list.style.top = `${triggerRect.bottom}px`;
		}

		const listHeight = this.list.offsetHeight || this.options.maxHeight;
		const spaceBelow = window.innerHeight - triggerRect.bottom;

		if (spaceBelow < listHeight && triggerRect.top > spaceBelow) {
			this.root.classList.add(OPEN_TOP_CLASS);

			if (this.list.classList.contains(DETACHED_CLASS)) {
				this.list.style.top = `${Math.max(0, triggerRect.top - listHeight)}px`;
			}
		}
	}

	/**
	 * @param {"open" | "close" | "change"} name
	 */
	emit(name) {
		this.root.dispatchEvent(
			new CustomEvent(`custom-select:${name}`, {
				bubbles: true,
				detail: { instance: this, select: this.native, value: this.native.value },
			})
		);
	}

	get enabledOptions() {
		return this.optionEls.filter((el) => !el.classList.contains(DISABLED_CLASS));
	}

	// handlers

	/**
	 * @param {PointerEvent} event
	 */
	_onTriggerPointerDown(event) {
		if (event.button !== undefined && event.button !== 0) return;
		event.preventDefault();
		this.trigger.focus();
		this.toggle();
	}

	/**
	 * @param {PointerEvent} event
	 */
	_onListPointerDown(event) {
		// Keep focus on the trigger so the option click is not preceded by a blur.
		// Touch is excluded, otherwise the dropdown could not be panned.
		if (event.pointerType === "touch") return;
		event.preventDefault();
	}

	/**
	 * @param {MouseEvent} event
	 */
	_onListClick(event) {
		const option = event.target.closest(`.${OPTION_CLASS}`);
		if (!option || !this.list.contains(option)) return;
		this.selectOption(option);
	}

	_onTriggerFocus() {
		this.root.classList.add(FOCUSED_CLASS);
	}

	_onTriggerBlur() {
		this.root.classList.remove(FOCUSED_CLASS);
	}

	_onNativeChange() {
		if (this._isSyncing) return;
		this.syncFromNative();
	}

	_onFormReset() {
		// The reset event fires before the control values are restored.
		setTimeout(() => this.syncFromNative(), 0);
	}

	_onViewportChange() {
		if (this.isOpen) {
			this.updatePosition();
		}
	}

	/**
	 * @param {MutationRecord[]} records
	 */
	_onMutation(records) {
		if (this._isSyncing) return;

		let needsRefresh = false;

		records.forEach((record) => {
			if (record.target !== this.native) {
				needsRefresh = true;
				return;
			}

			if (record.type !== "attributes") {
				needsRefresh = true;
				return;
			}

			switch (record.attributeName) {
				case "disabled":
					this.updateDisabled();
					break;
				case "aria-invalid":
					this.updateValidity();
					break;
				case "required":
				case "aria-label":
				case "aria-labelledby":
				case "aria-describedby":
				case "aria-errormessage":
				case "title":
					this.updateAccessibleName();
					break;
				case "multiple":
					this.updateMultiple();
					needsRefresh = true;
					break;
				case "class":
					break;
				default:
					needsRefresh = true;
			}
		});

		if (needsRefresh) {
			this.refresh();
		}
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	_onTriggerKeydown(event) {
		const { key } = event;

		if (key === "Tab") {
			this.close();
			return;
		}

		if (key === "Escape") {
			if (this.isOpen) {
				event.preventDefault();
				this.close({ restoreFocus: true });
			}
			return;
		}

		if (key === "ArrowDown" || key === "ArrowUp") {
			event.preventDefault();

			if (!this.isOpen) {
				this.open();
				if (key === "ArrowUp") {
					this._setActiveIndex(this.optionEls.indexOf(this.enabledOptions.at(-1) || null));
				}
				return;
			}

			this._moveActive(key === "ArrowDown" ? 1 : -1);
			return;
		}

		if (key === "Home" && this.isOpen) {
			event.preventDefault();
			this._setActiveIndex(this.optionEls.indexOf(this.enabledOptions[0] || null));
			return;
		}

		if (key === "End" && this.isOpen) {
			event.preventDefault();
			this._setActiveIndex(this.optionEls.indexOf(this.enabledOptions.at(-1) || null));
			return;
		}

		if (key === "Enter" || key === " " || key === "Spacebar") {
			event.preventDefault();

			if (!this.isOpen) {
				this.open();
				return;
			}

			this.selectOption(this.optionEls[this.activeIndex]);
			return;
		}

		if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
			this.handleTypeahead(key);
		}
	}

	/**
	 * @param {string} char
	 */
	handleTypeahead(char) {
		if (!this.isOpen) {
			this.open();
		}

		this.typeaheadBuffer += char.toLowerCase();

		if (this.typeaheadTimer) {
			clearTimeout(this.typeaheadTimer);
		}
		this.typeaheadTimer = setTimeout(() => this._resetTypeahead(), TYPEAHEAD_TIMEOUT);

		const enabled = this.enabledOptions;
		const match = enabled.find((el) => el.textContent.toLowerCase().startsWith(this.typeaheadBuffer));

		if (match) {
			this._setActiveIndex(this.optionEls.indexOf(match));
		}
	}

	_resetTypeahead() {
		this.typeaheadBuffer = "";
		if (this.typeaheadTimer) {
			clearTimeout(this.typeaheadTimer);
			this.typeaheadTimer = null;
		}
	}

	/**
	 * @param {number} index
	 */
	_setActiveIndex(index) {
		if (index < 0) return;
		this.activeIndex = index;
		this.updateActiveOption();
	}

	/**
	 * @param {number} delta
	 */
	_moveActive(delta) {
		const enabled = this.enabledOptions;
		if (!enabled.length) return;

		const current = this.optionEls[this.activeIndex];
		let index = enabled.indexOf(current);

		if (index === -1) {
			index = delta > 0 ? -1 : 0;
		}

		const next = enabled[(index + delta + enabled.length) % enabled.length];
		this._setActiveIndex(this.optionEls.indexOf(next));
	}

	/**
	 * @returns {string}
	 */
	_currentValue() {
		if (!this.native.multiple) {
			return this.native.value;
		}
		return Array.from(this.native.selectedOptions)
			.map((option) => option.value)
			.join("\u0000");
	}

	/**
	 * @returns {HTMLLabelElement | null}
	 */
	_findLabel() {
		if (this.native.labels?.length) {
			return this.native.labels[0];
		}
		return this.native.closest("label");
	}

	/**
	 * @returns {Partial<typeof DEFAULTS>}
	 */
	_readDataOptions() {
		const data = {};
		const { maxHeight, emptyText, triggerIcon, appendTo } = this.native.dataset;

		if (maxHeight) data.maxHeight = Number(maxHeight);
		if (emptyText) data.emptyText = emptyText;
		if (triggerIcon !== undefined) data.triggerIcon = triggerIcon;
		if (appendTo) data.appendTo = document.querySelector(appendTo);

		return data;
	}
}

/**
 * @param {ParentNode} [scope]
 * @param {Partial<typeof DEFAULTS>} [options]
 * @returns {CustomSelect[]}
 */
export function initCustomSelects(scope, options) {
	return CustomSelect.initAll(scope, options);
}

if (typeof document !== "undefined" && !import.meta.env?.VITEST) {
	const boot = () => CustomSelect.initAll();
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot);
	} else {
		boot();
	}
}
