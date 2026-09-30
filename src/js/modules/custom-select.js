/**
 * Accessible custom select (markup-first).
 * Requires: .custom-select > .custom-select__native + .custom-select__trigger + .custom-select__list > .custom-select__option
 */

const OPEN_CLASS = "is-open";
const OPEN_TOP_CLASS = "is-open-top";
const SELECTED_CLASS = "is-selected";
const DISABLED_CLASS = "is-disabled";
const VALUE_SELECTED_CLASS = "is-selected";

export class CustomSelect {
	static openInstance = null;

	/**
	 * @param {HTMLElement} root
	 */
	constructor(root) {
		this.root = root;
		this.native = root.querySelector(".custom-select__native");
		this.trigger = root.querySelector(".custom-select__trigger");
		this.valueEl = root.querySelector(".custom-select__value");
		this.list = root.querySelector(".custom-select__list");
		this.options = Array.from(root.querySelectorAll(".custom-select__option"));
		this.activeIndex = -1;
		this.initialValue = this.native ? this.native.value : "";
		this._onDocumentClick = this._onDocumentClick.bind(this);
		this._onDocumentKeydown = this._onDocumentKeydown.bind(this);

		if (!this.native || !this.trigger || !this.list) {
			return;
		}

		this._ensureIds();
		this._syncFromNative();
		this._bindEvents();
		this._observeNative();
	}

	get isOpen() {
		return this.root.classList.contains(OPEN_CLASS);
	}

	get enabledOptions() {
		return this.options.filter((option) => option.getAttribute("aria-disabled") !== "true");
	}

	open() {
		if (this.native.disabled || this.isOpen) return;

		if (CustomSelect.openInstance && CustomSelect.openInstance !== this) {
			CustomSelect.openInstance.close();
		}

		this.root.classList.add(OPEN_CLASS);
		this.list.hidden = false;
		this.trigger.setAttribute("aria-expanded", "true");
		CustomSelect.openInstance = this;

		this.root.classList.remove(OPEN_TOP_CLASS);
		const rect = this.list.getBoundingClientRect();
		if (rect.bottom > window.innerHeight) {
			this.root.classList.add(OPEN_TOP_CLASS);
		}

		const selected = this.options.find((option) => option.classList.contains(SELECTED_CLASS));
		this._setActiveOption(selected || this.enabledOptions[0] || null);
		this.trigger.focus();
	}

	close({ restoreFocus = false } = {}) {
		if (!this.isOpen) return;

		this.root.classList.remove(OPEN_CLASS, OPEN_TOP_CLASS);
		this.list.hidden = true;
		this.trigger.setAttribute("aria-expanded", "false");
		this.trigger.removeAttribute("aria-activedescendant");
		this.activeIndex = -1;

		if (CustomSelect.openInstance === this) {
			CustomSelect.openInstance = null;
		}

		if (restoreFocus) {
			this.trigger.focus();
		}
	}

	toggle() {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	/**
	 * @param {HTMLElement} option
	 * @param {{ emitChange?: boolean }} [params]
	 */
	selectOption(option, { emitChange = true } = {}) {
		if (!option || option.getAttribute("aria-disabled") === "true") return;

		const value = option.dataset.value ?? "";
		const label = option.textContent.trim();

		this.options.forEach((item) => {
			const isSelected = item === option;
			item.classList.toggle(SELECTED_CLASS, isSelected);
			item.setAttribute("aria-selected", isSelected ? "true" : "false");
		});

		if (this.valueEl) {
			this.valueEl.textContent = label;
			this.valueEl.classList.toggle(VALUE_SELECTED_CLASS, Boolean(value));
		}

		if (this.native.value !== value) {
			this.native.value = value;
			if (emitChange) {
				this.native.dispatchEvent(new Event("change", { bubbles: true }));
			}
		}

		this.close({ restoreFocus: true });
	}

	restoreInitialState() {
		this.native.value = this.initialValue;
		this._syncFromNative();
		this.native.dispatchEvent(new Event("change", { bubbles: true }));
	}

	destroy() {
		document.removeEventListener("click", this._onDocumentClick, true);
		document.removeEventListener("keydown", this._onDocumentKeydown, true);
		if (this._disabledObserver) this._disabledObserver.disconnect();
		if (this._optionsObserver) this._optionsObserver.disconnect();
		if (CustomSelect.openInstance === this) {
			CustomSelect.openInstance = null;
		}
	}

	_ensureIds() {
		if (!this.list.id) {
			this.list.id = `${this.native.id || "custom-select"}-list`;
		}
		if (!this.trigger.getAttribute("aria-controls")) {
			this.trigger.setAttribute("aria-controls", this.list.id);
		}
		this.trigger.setAttribute("aria-haspopup", "listbox");
		this.trigger.setAttribute("aria-expanded", "false");
		this.list.setAttribute("role", "listbox");

		this.options.forEach((option, index) => {
			if (!option.id) {
				option.id = `${this.list.id}-option-${index}`;
			}
			option.setAttribute("role", "option");
			if (!option.hasAttribute("aria-selected")) {
				option.setAttribute("aria-selected", "false");
			}
		});
	}

	_bindEvents() {
		this.trigger.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.toggle();
		});

		this.trigger.addEventListener("keydown", (event) => this._onTriggerKeydown(event));

		this.list.addEventListener("click", (event) => {
			const option = event.target.closest(".custom-select__option");
			if (!option || !this.list.contains(option)) return;
			event.preventDefault();
			event.stopPropagation();
			this.selectOption(option);
		});

		this.native.addEventListener("change", () => this._syncFromNative());

		const form = this.native.closest("form");
		if (form) {
			form.addEventListener("reset", () => {
				queueMicrotask(() => this.restoreInitialState());
			});
		}

		document.addEventListener("click", this._onDocumentClick, true);
		document.addEventListener("keydown", this._onDocumentKeydown, true);
	}

	_observeNative() {
		this._disabledObserver = new MutationObserver(() => {
			const disabled = this.native.disabled;
			this.trigger.disabled = disabled;
			this.root.classList.toggle(DISABLED_CLASS, disabled);
			if (disabled) this.close();
		});

		this._disabledObserver.observe(this.native, {
			attributes: true,
			attributeFilter: ["disabled"],
		});

		this.root.classList.toggle(DISABLED_CLASS, this.native.disabled);
		this.trigger.disabled = this.native.disabled;

		this._optionsObserver = new MutationObserver(() => {
			this.options = Array.from(this.root.querySelectorAll(".custom-select__option"));
			this._ensureIds();
			this._syncFromNative();
		});

		this._optionsObserver.observe(this.native, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["disabled", "selected", "value"],
		});
	}

	_syncFromNative() {
		const value = this.native.value;
		const selectedOption =
			this.options.find((option) => (option.dataset.value ?? "") === value) ||
			this.options.find((option) => option.classList.contains(SELECTED_CLASS)) ||
			this.options[0];

		this.options.forEach((option) => {
			const isSelected = option === selectedOption;
			option.classList.toggle(SELECTED_CLASS, isSelected);
			option.setAttribute("aria-selected", isSelected ? "true" : "false");
		});

		if (this.valueEl && selectedOption) {
			this.valueEl.textContent = selectedOption.textContent.trim();
			this.valueEl.classList.toggle(VALUE_SELECTED_CLASS, Boolean(selectedOption.dataset.value));
		}
	}

	/**
	 * @param {HTMLElement | null} option
	 */
	_setActiveOption(option) {
		if (!option) {
			this.activeIndex = -1;
			this.trigger.removeAttribute("aria-activedescendant");
			return;
		}

		this.activeIndex = this.options.indexOf(option);
		this.trigger.setAttribute("aria-activedescendant", option.id);
		if (typeof option.scrollIntoView === "function") {
			option.scrollIntoView({ block: "nearest" });
		}
	}

	/**
	 * @param {number} delta
	 */
	_moveActive(delta) {
		const enabled = this.enabledOptions;
		if (!enabled.length) return;

		const current = this.options[this.activeIndex];
		let index = enabled.indexOf(current);
		if (index === -1) {
			index = delta > 0 ? -1 : 0;
		}

		const next = enabled[(index + delta + enabled.length) % enabled.length];
		this._setActiveOption(next);
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	_onTriggerKeydown(event) {
		const { key } = event;

		if (key === "ArrowDown" || key === "ArrowUp") {
			event.preventDefault();
			if (!this.isOpen) {
				this.open();
				if (key === "ArrowUp") {
					const enabled = this.enabledOptions;
					this._setActiveOption(enabled[enabled.length - 1] || null);
				}
				return;
			}
			this._moveActive(key === "ArrowDown" ? 1 : -1);
			return;
		}

		if (key === "Home" && this.isOpen) {
			event.preventDefault();
			this._setActiveOption(this.enabledOptions[0] || null);
			return;
		}

		if (key === "End" && this.isOpen) {
			event.preventDefault();
			const enabled = this.enabledOptions;
			this._setActiveOption(enabled[enabled.length - 1] || null);
			return;
		}

		if ((key === "Enter" || key === " ") && this.isOpen) {
			event.preventDefault();
			const active = this.options[this.activeIndex];
			if (active) this.selectOption(active);
			return;
		}

		if ((key === "Enter" || key === " ") && !this.isOpen) {
			event.preventDefault();
			this.open();
			return;
		}

		if (key === "Escape" && this.isOpen) {
			event.preventDefault();
			this.close({ restoreFocus: true });
			return;
		}

		if (key === "Tab" && this.isOpen) {
			this.close();
		}
	}

	/**
	 * @param {MouseEvent} event
	 */
	_onDocumentClick(event) {
		if (!this.isOpen) return;
		if (this.root.contains(event.target)) return;
		this.close();
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	_onDocumentKeydown(event) {
		if (event.key === "Escape" && this.isOpen) {
			this.close({ restoreFocus: true });
		}
	}
}

/**
 * @param {ParentNode} [scope]
 * @returns {CustomSelect[]}
 */
export function initCustomSelects(scope = document) {
	return Array.from(scope.querySelectorAll("[data-custom-select], .custom-select")).map(
		(element) => new CustomSelect(element)
	);
}

if (typeof document !== "undefined" && !import.meta.env?.VITEST) {
	const boot = () => initCustomSelects();
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot);
	} else {
		boot();
	}
}
