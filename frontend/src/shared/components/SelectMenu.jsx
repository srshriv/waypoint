import { useEffect, useId, useRef, useState } from "react";
import { MaterialIcon } from "./MaterialIcon.jsx";

export function SelectMenu({ ariaLabel, className = "", disabled = false, onChange, options, value }) {
    const [open, setOpen] = useState(false);
    const reference = useRef(null);
    const optionReferences = useRef([]);
    const listId = useId();
    const selected = options.find((option) => String(option.value) === String(value)) || options[0];
    const selectedIndex = Math.max(0, options.findIndex((option) => String(option.value) === String(value)));
    const openAndFocus = (index = selectedIndex) => {
        setOpen(true);
        requestAnimationFrame(() => optionReferences.current[index]?.focus());
    };
    const closeAndFocusTrigger = () => {
        setOpen(false);
        reference.current?.querySelector('[role="combobox"]')?.focus();
    };
    useEffect(() => {
        if (!open) return undefined;
        const closeOutside = (event) => { if (!reference.current?.contains(event.target)) setOpen(false); };
        const closeOnEscape = (event) => { if (event.key === "Escape") closeAndFocusTrigger(); };
        document.addEventListener("pointerdown", closeOutside);
        document.addEventListener("keydown", closeOnEscape);
        return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeOnEscape); };
    }, [open]);
    return <div className={`select-menu ${className}`} ref={reference}>
        <button
            aria-controls={listId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={ariaLabel}
            disabled={disabled}
            role="combobox"
            type="button"
            onClick={() => { if (open) setOpen(false); else openAndFocus(); }}
            onKeyDown={(event) => {
                if (["ArrowDown", "Enter", " "].includes(event.key)) { event.preventDefault(); openAndFocus(); }
                else if (event.key === "ArrowUp") { event.preventDefault(); openAndFocus(options.length - 1); }
            }}
        >
            <span>{selected?.label}</span>
            <MaterialIcon className="select-menu-arrow" size={19}>{open ? "arrow_drop_up" : "arrow_drop_down"}</MaterialIcon>
        </button>
        {open && <div
            aria-label={ariaLabel}
            className="select-menu-options"
            id={listId}
            role="listbox"
            onKeyDown={(event) => {
                const currentIndex = optionReferences.current.indexOf(document.activeElement);
                if (event.key === "ArrowDown") { event.preventDefault(); optionReferences.current[(currentIndex + 1) % options.length]?.focus(); }
                else if (event.key === "ArrowUp") { event.preventDefault(); optionReferences.current[(currentIndex - 1 + options.length) % options.length]?.focus(); }
                else if (event.key === "Home") { event.preventDefault(); optionReferences.current[0]?.focus(); }
                else if (event.key === "End") { event.preventDefault(); optionReferences.current[options.length - 1]?.focus(); }
                else if (event.key === "Tab") setOpen(false);
            }}
        >
            {options.map((option, index) => <button
                aria-selected={String(option.value) === String(value)}
                key={option.value}
                ref={(node) => { optionReferences.current[index] = node; }}
                role="option"
                type="button"
                onClick={() => { onChange(option.value); closeAndFocusTrigger(); }}
            >
                <span>{option.label}</span>
                {String(option.value) === String(value) && <MaterialIcon size={18}>check</MaterialIcon>}
            </button>)}
        </div>}
    </div>;
}
