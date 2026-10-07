/**
 * Field ⇄ control wiring. <Field> creates ids (via `$props.id()`, hydration-safe) for the label,
 * hint and error and exposes them via context; Input/Select/Textarea/Checkbox pick them up so
 * `aria-describedby` and `aria-invalid` are always correct without manual plumbing.
 */
import { getContext, setContext } from 'svelte';

export interface FieldContext {
	readonly id: string;
	readonly describedBy: string | undefined;
	readonly invalid: boolean;
	readonly required: boolean;
}

const KEY = Symbol('field');
export const setFieldContext = (ctx: FieldContext) => setContext(KEY, ctx);
export const getFieldContext = () => getContext<FieldContext | undefined>(KEY);
