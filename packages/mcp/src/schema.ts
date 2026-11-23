/**
 * The shapes the tools declare, as JSON Schema, and the check of a tool's arguments against its
 * shape (docs/PLAN.md items 6.2 and 6.4).
 *
 * A tool's arguments are checked before its handler runs, by the validator given to the MCP
 * library with each input shape (`argumentValidator`). The library turns a failed check into a
 * tool result marked as an error, never a protocol error; this validator's part is the text: it
 * names what is wrong and the valid values (the arguments a tool takes, the values an argument
 * may have, its bounds), so that an agent can correct its call from the result alone. The
 * library's own validator says only that a value "must be equal to one of the allowed values".
 *
 * The input shapes use a small part of JSON Schema, and this checks exactly that part; a test
 * holds every input shape to it. The output shapes are checked by the library's own validator.
 */

import type {
    JsonSchemaType,
    JsonSchemaValidator,
    JsonSchemaValidatorResult,
    jsonSchemaValidator,
} from '@modelcontextprotocol/server';

/** A JSON Schema type name. */
export type TypeName = 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean' | 'null';

/** The part of JSON Schema the tools' shapes are written in. */
export interface Schema {
    readonly type?: TypeName | readonly TypeName[];
    readonly description?: string;
    readonly properties?: Readonly<Record<string, Schema>>;
    readonly required?: readonly string[];
    readonly additionalProperties?: boolean | Schema;
    readonly items?: Schema;
    readonly enum?: readonly (string | number | boolean | null)[];
    readonly minimum?: number;
    readonly maximum?: number;
    readonly minItems?: number;
    readonly maxItems?: number;
    readonly minLength?: number;
    readonly default?: unknown;
}

/** The keywords an input shape may use: those `problems` checks, and the two it reads as words. */
export const INPUT_KEYWORDS: readonly string[] = [
    'type',
    'description',
    'properties',
    'required',
    'additionalProperties',
    'items',
    'enum',
    'minimum',
    'maximum',
    'minItems',
    'maxItems',
    'minLength',
    'default',
];

/** A shape as the MCP library takes it. */
export function jsonSchema(schema: Schema): JsonSchemaType {
    return schema;
}

function typeOfValue(value: unknown): TypeName {
    if (value === null) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return 'array';
    }
    switch (typeof value) {
        case 'string':
            return 'string';
        case 'boolean':
            return 'boolean';
        case 'number':
            return Number.isInteger(value) ? 'integer' : 'number';
        default:
            return 'object';
    }
}

const TYPE_WORDS: Readonly<Record<TypeName, string>> = {
    object: 'an object',
    array: 'a list',
    string: 'a text',
    integer: 'a whole number',
    number: 'a number',
    boolean: 'true or false',
    null: 'null',
};

function fitsType(value: unknown, type: TypeName): boolean {
    const actual = typeOfValue(value);
    return actual === type || (type === 'number' && actual === 'integer');
}

function shown(value: unknown): string {
    return JSON.stringify(value);
}

/**
 * What is wrong with a value for a shape, one sentence per problem, each naming the place
 * (`limit`, `codes[2]`) and what would be valid there; empty when nothing is.
 */
export function problems(schema: Schema, value: unknown, where = ''): string[] {
    const at = where === '' ? 'the arguments' : where;
    const types = schema.type === undefined ? [] : [schema.type].flat();
    if (types.length > 0 && !types.some((t) => fitsType(value, t))) {
        return [`${at}: ${shown(value)} is not ${types.map((t) => TYPE_WORDS[t]).join(' or ')}`];
    }
    const out: string[] = [];
    if (schema.enum !== undefined && !schema.enum.includes(value as string)) {
        out.push(
            `${at}: ${shown(value)} is not one of the valid values: ${schema.enum.map((v) => String(v)).join(', ')}`,
        );
    }
    if (typeof value === 'number') {
        const low = schema.minimum;
        const high = schema.maximum;
        if ((low !== undefined && value < low) || (high !== undefined && value > high)) {
            const range =
                low !== undefined && high !== undefined
                    ? `from ${String(low)} to ${String(high)}`
                    : low !== undefined
                      ? `${String(low)} or more`
                      : `${String(high)} or less`;
            out.push(`${at}: ${String(value)} is out of range; it must be ${range}`);
        }
    }
    if (typeof value === 'string' && schema.minLength !== undefined) {
        if (value.length < schema.minLength) {
            out.push(`${at}: must not be empty`);
        }
    }
    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) {
            out.push(`${at}: give at least ${String(schema.minItems)}`);
        }
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            out.push(
                `${at}: give at most ${String(schema.maxItems)} in one call (${String(value.length)} given); ask again for the rest`,
            );
        }
        if (schema.items !== undefined) {
            const items = schema.items;
            value.forEach((item, i) => {
                out.push(...problems(items, item, `${where}[${String(i)}]`));
            });
        }
    }
    if (typeOfValue(value) === 'object') {
        const record = value as Record<string, unknown>;
        const properties = schema.properties ?? {};
        const names = Object.keys(properties);
        for (const name of schema.required ?? []) {
            if (!(name in record)) {
                out.push(`${where === '' ? name : `${where}.${name}`}: missing; it is required`);
            }
        }
        for (const [name, item] of Object.entries(record)) {
            const inner = where === '' ? name : `${where}.${name}`;
            const property = properties[name];
            if (property !== undefined) {
                out.push(...problems(property, item, inner));
            } else if (schema.additionalProperties === false) {
                out.push(
                    `${inner}: no such argument; the arguments are ${names.length === 0 ? 'none' : names.join(', ')}`,
                );
            } else if (typeof schema.additionalProperties === 'object') {
                out.push(...problems(schema.additionalProperties, item, inner));
            }
        }
    }
    return out;
}

/**
 * The validator given to the MCP library with each input shape: the library's check, with
 * this module's text when it fails.
 */
export const argumentValidator: jsonSchemaValidator = {
    getValidator<T>(schema: JsonSchemaType): JsonSchemaValidator<T> {
        const shape = schema as Schema;
        return (input: unknown): JsonSchemaValidatorResult<T> => {
            const found = problems(shape, input);
            return found.length === 0
                ? { valid: true, data: input as T, errorMessage: undefined }
                : { valid: false, data: undefined, errorMessage: found.join('; ') };
        };
    },
};
