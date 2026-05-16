# API documentation

This document contains a more detailed API reference for `api-patch-contract`.

## `definePatchContract<T>()(contract)`

Creates a type-safe contract that describes which fields may be included in the generated PATCH payload.

```ts
const contract = definePatchContract<User>()({
  name: true,
  profile: {
    city: true,
  },
})
```

A contract is intentionally explicit. Fields that are not listed are not sent.

## `true`

The simplest contract rule.

```ts
const contract = definePatchContract<User>()({
  name: true,
})
```

If `name` changed, it is sent as-is.

## `field(options)`

Use `field()` when a property needs custom behavior.

```ts
field({
  compare: (initial, current) => boolean,
  transform: value => value,
  emptyStringAsNull: true,
  omitIf: 'empty-string',
})
```

### `compare`

Custom equality check. Return `true` when values should be treated as equal.

```ts
field<Date, string>({
  compare: (a, b) => a.toDateString() === b.toDateString(),
  transform: value => value.toISOString(),
})
```

### `transform`

Transforms the current value before it is inserted into the patch payload.

```ts
field<string>({
  transform: value => value.trim(),
})
```

### `emptyStringAsNull`

Converts `''` to `null` before comparison and transformation.

Useful when a backend treats `null` as field clearing.

### `omitIf`

Omits a value from the payload after transformation.

```ts
field<string>({
  omitIf: 'empty-string',
})
```

Supported presets:

- `undefined`
- `null`
- `empty-string`
- `empty-array`
- `empty-object`

Custom predicate:

```ts
field<number>({
  omitIf: value => value < 0,
})
```

## `arrayReplace(options?)`

Sends the entire array if it changed.

```ts
arrayReplace<Image>()
```

Useful when the backend accepts a full array replacement.

## `arrayAsSet(options?)`

Compares arrays without taking order into account.

```ts
arrayAsSet<string>()
```

For arrays of objects:

```ts
arrayAsSet<Category>({
  getKey: 'id',
})
```

## `arrayById(idKey, options)`

Diffs arrays of objects by id.

```ts
arrayById<Item, 'id', 'items'>('id', {
  mode: 'items',
  itemContract,
})
```

Output shape:

```ts
{
  added: Item[]
  updated: Array<Partial<Item> & Pick<Item, 'id'>>
  removed: Array<Item['id']>
}
```

Use this when your backend supports item-level array updates.

## `createPatch(initial, current, contract, options?)`

Creates the payload object.

```ts
const patch = createPatch(initial, current, contract)
```

### Options

```ts
type CreatePatchOptions = {
  strict?: boolean
  omitUndefined?: boolean
}
```

### `strict`

Throws `PatchContractError` if data changed outside the contract.

This is useful in complex forms where accidental changes should be noticed.

### `omitUndefined`

Defaults to `true`.

`undefined` is omitted because most JSON APIs do not treat it as a meaningful value.

Use `null` when you want to explicitly clear a value.

## `createPatchResult(initial, current, contract, options?)`

Returns a full result object:

```ts
{
  patch,
  changedPaths,
  dirtyFields,
  hasChanges,
}
```

## `getChangedPaths(initial, current, contract)`

Returns paths that changed and are included in the contract.

```ts
['name', 'profile.city']
```

## `getDirtyFields(initial, current, contract)`

Returns a nested dirty-field tree.

```ts
{
  name: true,
  profile: {
    city: true,
  },
}
```

## `hasChanges(...)`

Supports two forms:

```ts
hasChanges(patch)
hasChanges(initial, current, contract)
```

## `isFieldChanged(initial, current, contract, path)`

Checks whether a single path changed.

```ts
isFieldChanged(initial, current, contract, 'profile.city')
```
