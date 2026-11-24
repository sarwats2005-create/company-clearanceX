const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params are typed by people too; a non-uuid must be a 404, not a database error. */
export const isUuid = (v: string | null | undefined): v is string => !!v && UUID.test(v);
