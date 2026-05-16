# Recipes

## Send only changed profile fields

```ts
const contract = definePatchContract<User>()({
  name: true,
  profile: {
    city: true,
    phone: true,
  },
})

const patch = createPatch(initialUser, form, contract)

if (hasChanges(patch)) {
  await api.patch(`/users/${initialUser.id}`, patch)
}
```

## Clear a field with `null`

```ts
const contract = definePatchContract<UserForm>()({
  phone: field<string | null>({
    emptyStringAsNull: true,
  }),
})
```

When the user clears an input, the payload becomes:

```ts
{ phone: null }
```

## Trim strings before sending

```ts
const contract = definePatchContract<UserForm>()({
  name: field<string>({
    transform: value => value.trim(),
  }),
})
```

## Ignore empty optional fields

```ts
const contract = definePatchContract<ProductForm>()({
  description: field<string>({
    omitIf: 'empty-string',
  }),
})
```

## Compare tags as unordered values

```ts
const contract = definePatchContract<ArticleForm>()({
  tags: arrayAsSet<string>(),
})
```

```ts
createPatch(
  { tags: ['vue', 'typescript'] },
  { tags: ['typescript', 'vue'] },
  contract,
)

// {}
```

## Create item-level array patches

```ts
type Skill = {
  id: string
  title: string
  level: number
}

const skillContract = definePatchContract<Skill>()({
  title: true,
  level: true,
})

const userContract = definePatchContract<UserForm>()({
  skills: arrayById<Skill, 'id', 'items'>('id', {
    mode: 'items',
    itemContract: skillContract,
  }),
})
```

Result:

```ts
{
  skills: {
    added: [],
    updated: [{ id: 'vue', level: 5 }],
    removed: ['old-skill-id'],
  }
}
```

## Vue dirty button

```ts
const result = computed(() => createPatchResult(initialUser, form, contract))
```

```vue
<button :disabled="!result.hasChanges" @click="save">
  Save
</button>
```

## Fail fast when contract is outdated

```ts
createPatch(initial, current, contract, {
  strict: true,
})
```

If a field changed but is not covered by the contract, the function throws.
