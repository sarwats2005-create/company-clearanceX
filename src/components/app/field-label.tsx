import type { ReactNode } from "react";

/** Gray "(اختياري)" after an optional field's label (PRD §8.5.5 rule 2). */
export function OptionalMark() {
    return <span className="ms-1 text-sm font-normal text-quaternary">(اختياري)</span>;
}

export function optionalLabel(label: ReactNode): ReactNode {
    return (
        <>
            {label}
            <OptionalMark />
        </>
    );
}
