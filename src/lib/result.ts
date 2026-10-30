export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export type Result<T, K extends string = string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<K>; message?: string };

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function fail<K extends string>(errors: FieldErrors<K>, message?: string): { ok: false; errors: FieldErrors<K>; message?: string } {
  return { ok: false, errors, message };
}
