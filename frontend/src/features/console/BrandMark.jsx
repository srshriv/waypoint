export function BrandMark({ size = 36 }) {
	return <span className="brand-mark" style={{ "--brand-mark-size": `${size}px` }} aria-hidden="true" />;
}
