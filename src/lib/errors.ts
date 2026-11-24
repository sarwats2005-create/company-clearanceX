/** A business-rule failure with an Arabic message for the owner, optionally tied to a form field. */
export class DomainError extends Error {
    constructor(
        message: string,
        public readonly field?: string,
    ) {
        super(message);
        this.name = "DomainError";
    }
}
