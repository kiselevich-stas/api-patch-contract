# api-patch-contract

> Type-safe PATCH payload builder for frontend forms and API contracts.

`api-patch-contract` helps you safely create API `PATCH` payloads from changed form/state data.

It is not just another object diff library. It answers a more practical question:

> “Which changed fields am I allowed to send to my backend contract?”

```ts
const patch = createPatch(initialUser, currentUser, userPatchContract)

// {
//   name: 'Anna Smith',
//   profile: {
//     city: 'Tallinn'
//   }
// }
```

## Why?

In real frontend apps, edit forms usually contain more data than the backend accepts.

```ts
type User = {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  profile: {
    city: string
    phone: string | null
  }
  createdAt: string
}
```

But your API may only accept this:

```ts
type UpdateUserPayload = {
  name?: string
  role?: 'admin' | 'user'
  profile?: {
    city?: string
    phone?: string | null
  }
}
```

Without a helper, you often end up writing fragile code:

```ts
const payload: UpdateUserPayload = {}

if (form.name !== initial.name) {
  payload.name = form.name
}

if (form.profile.city !== initial.profile.city) {
  payload.profile ??= {}
  payload.profile.city = form.profile.city
}
```

`api-patch-contract` replaces that boilerplate with a typed contract.

---

## Features

- Type-safe patch contracts
- Sends only changed fields
- Prevents accidental fields from being sent
- Nested object support
- `null` / `undefined` semantics
- Field transforms
- Custom comparators
- Dirty paths
- Dirty field tree
- Strict mode for contract drift detection
- Array strategies:
  - replace array
  - compare array as set
  - diff array items by id
- Zero runtime dependencies
- Framework agnostic: works with Vue, Nuxt, React, Next, Svelte, Node.js

---

## Installation

```bash
npm install api-patch-contract
```

```bash
pnpm add api-patch-contract
```

```bash
yarn add api-patch-contract
```

---

## Quick start

```ts
import { createPatch, definePatchContract } from 'api-patch-contract'

type User = {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  profile: {
    city: string
    phone: string | null
  }
  createdAt: string
}

const userPatchContract = definePatchContract<User>()({
  name: true,
  role: true,
  profile: {
    city: true,
    phone: true,
  },
})

const initialUser: User = {
  id: '1',
  email: 'anna@example.com',
  name: 'Anna',
  role: 'user',
  profile: {
    city: 'Riga',
    phone: null,
  },
  createdAt: '2026-01-01',
}

const currentUser: User = {
  ...initialUser,
  name: 'Anna Smith',
  profile: {
    ...initialUser.profile,
    city: 'Tallinn',
  },
}

const patch = createPatch(initialUser, currentUser, userPatchContract)

// patch:
// {
//   name: 'Anna Smith',
//   profile: {
//     city: 'Tallinn'
//   }
// }
```

Fields not included in the contract are ignored.

So `id`, `email`, and `createdAt` will never be sent by this contract.

---

## Type inference

You can infer the payload type directly from a contract.

```ts
import type { InferPatchPayload } from 'api-patch-contract'

type UserPatchPayload = InferPatchPayload<typeof userPatchContract>

const payload: UserPatchPayload = {
  name: 'Anna Smith',
  profile: {
    phone: null,
  },
}
```

Trying to send a field that is not part of the contract will fail at compile time:

```ts
const invalidPayload: UserPatchPayload = {
  // @ts-expect-error id is not allowed by the contract
  id: '1',
}
```

---

## Field transforms

Use `field()` when you need normalization or transformation before sending the payload.

```ts
import { field } from 'api-patch-contract'

const contract = definePatchContract<UserForm>()({
  name: field<string>({
    transform: value => value.trim(),
  }),
})
```

```ts
const patch = createPatch(
  { name: 'Anna' },
  { name: ' Anna Smith ' },
  contract,
)

// { name: 'Anna Smith' }
```

---

## Empty string as null

This is useful when a backend treats `null` as “clear this field”.

```ts
const contract = definePatchContract<UserForm>()({
  phone: field<string | null>({
    emptyStringAsNull: true,
  }),
})
```

```ts
const patch = createPatch(
  { phone: '+100' },
  { phone: '' },
  contract,
)

// { phone: null }
```

---

## Custom comparator

Use custom comparators for dates, rounded numbers, case-insensitive values, or domain-specific equality.

```ts
const contract = definePatchContract<EventForm>()({
  startDate: field<Date, string>({
    compare: (initial, current) => initial.toDateString() === current.toDateString(),
    transform: value => value.toISOString(),
  }),
})
```

---

## Omitting values

By default, `undefined` is omitted from the resulting payload.

You can define extra omit rules:

```ts
const contract = definePatchContract<ProductForm>()({
  description: field<string>({
    omitIf: 'empty-string',
  }),

  tags: field<string[]>({
    omitIf: ['empty-array'],
  }),
})
```

Supported presets:

```ts
type OmitPreset =
  | 'undefined'
  | 'null'
  | 'empty-string'
  | 'empty-array'
  | 'empty-object'
```

You can also pass a function:

```ts
const contract = definePatchContract<ProductForm>()({
  price: field<number>({
    omitIf: value => value < 0,
  }),
})
```

---

## Changed paths

```ts
import { getChangedPaths } from 'api-patch-contract'

const paths = getChangedPaths(initialUser, currentUser, userPatchContract)

// ['name', 'profile.city']
```

---

## Dirty fields

```ts
import { getDirtyFields } from 'api-patch-contract'

const dirty = getDirtyFields(initialUser, currentUser, userPatchContract)

// {
//   name: true,
//   profile: {
//     city: true
//   }
// }
```

Useful for UI:

```ts
const result = createPatchResult(initialUser, currentUser, userPatchContract)

if (result.hasChanges) {
  await api.patch('/users/1', result.patch)
}
```

---

## Strict mode

Strict mode throws when data changed outside the contract.

This helps catch contract drift and accidental frontend/backend mismatch.

```ts
const patch = createPatch(initialUser, currentUser, userPatchContract, {
  strict: true,
})
```

Example:

```ts
const contract = definePatchContract<User>()({
  name: true,
})

createPatch(
  initialUser,
  {
    ...initialUser,
    name: 'Anna Smith',
    email: 'new@example.com',
  },
  contract,
  { strict: true },
)

// throws PatchContractError:
// Detected changed fields outside the patch contract: email
```

---

# Array strategies

Arrays are hard. Different APIs expect different semantics.

`api-patch-contract` gives you explicit strategies.

## `arrayReplace()`

Send the whole array when it changes.

```ts
import { arrayReplace } from 'api-patch-contract'

const contract = definePatchContract<ProductForm>()({
  images: arrayReplace<Image>(),
})
```

```ts
// if images changed:
// {
//   images: [...currentImages]
// }
```

## `arrayAsSet()`

Compare array values as a set. Order does not matter.

```ts
import { arrayAsSet } from 'api-patch-contract'

const contract = definePatchContract<ProductForm>()({
  tags: arrayAsSet<string>(),
})
```

```ts
createPatch(
  { tags: ['vue', 'ts'] },
  { tags: ['ts', 'vue'] },
  contract,
)

// {}
```

You can compare object arrays by key:

```ts
const contract = definePatchContract<ProductForm>()({
  categories: arrayAsSet<Category>({
    getKey: 'id',
  }),
})
```

## `arrayById()`

Create item-level array patches by id.

```ts
import { arrayById } from 'api-patch-contract'

type Skill = {
  id: string
  title: string
  level: number
}

const skillContract = definePatchContract<Skill>()({
  title: true,
  level: true,
})

const contract = definePatchContract<UserForm>()({
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
    added: [{ id: 'node', title: 'Node.js', level: 2 }],
    updated: [{ id: 'vue', level: 5 }],
    removed: ['ts']
  }
}
```

---

# API reference

## `definePatchContract<T>()(contract)`

Defines a type-safe patch contract.

```ts
const contract = definePatchContract<User>()({
  name: true,
})
```

## `createPatch(initial, current, contract, options?)`

Creates a PATCH payload.

```ts
const patch = createPatch(initial, current, contract)
```

Options:

```ts
type CreatePatchOptions = {
  strict?: boolean
  omitUndefined?: boolean
}
```

## `createPatchResult(initial, current, contract, options?)`

Returns patch + metadata.

```ts
const result = createPatchResult(initial, current, contract)

result.patch
result.changedPaths
result.dirtyFields
result.hasChanges
```

## `getChangedPaths(initial, current, contract)`

Returns changed paths covered by the contract.

## `getDirtyFields(initial, current, contract)`

Returns a nested dirty-field tree.

## `hasChanges(patch)`

Checks whether a patch is non-empty.

```ts
hasChanges({}) // false
hasChanges({ name: 'Anna' }) // true
```

## `hasChanges(initial, current, contract)`

Checks whether there are contract-covered changes.

## `isFieldChanged(initial, current, contract, path)`

Checks a single changed path.

```ts
isFieldChanged(initial, current, contract, 'profile.city')
```

---

# Vue example

```ts
import { computed, reactive } from 'vue'
import { createPatchResult, definePatchContract } from 'api-patch-contract'

const initialUser = structuredClone(userFromApi)

const form = reactive(structuredClone(userFromApi))

const contract = definePatchContract<User>()({
  name: true,
  profile: {
    city: true,
    phone: true,
  },
})

const patchResult = computed(() =>
  createPatchResult(initialUser, form, contract),
)

async function save() {
  if (!patchResult.value.hasChanges) return

  await $fetch(`/api/users/${form.id}`, {
    method: 'PATCH',
    body: patchResult.value.patch,
  })
}
```

---

# React example

```tsx
import { useMemo, useState } from 'react'
import { createPatchResult, definePatchContract } from 'api-patch-contract'

const contract = definePatchContract<User>()({
  name: true,
  profile: {
    city: true,
  },
})

function UserForm({ user }: { user: User }) {
  const [form, setForm] = useState(user)

  const patchResult = useMemo(
    () => createPatchResult(user, form, contract),
    [user, form],
  )

  return (
    <button disabled={!patchResult.hasChanges}>
      Save
    </button>
  )
}
```

---

# Design goals

## This package should be

- small
- predictable
- strongly typed
- framework-independent
- explicit about API contracts
- safe by default

## This package should not be

- a full form library
- a validation library
- a backend schema framework
- a JSON Patch RFC implementation
- a replacement for Zod, Valibot, VeeValidate, React Hook Form, etc.

---

# How it differs from object diff libraries

Generic diff libraries usually answer:

> What changed?

`api-patch-contract` answers:

> What changed and is allowed to be sent to this API endpoint?

That is the key difference.

---

# Recommended project scripts

```bash
npm run typecheck
npm run test
npm run build
npm run check
```

---

# Contributing

Issues and pull requests are welcome.

Good first contribution ideas:

- Add more recipes
- Add array strategy examples
- Improve type inference tests
- Add framework-specific examples
- Add benchmark tests

---

# License

MIT
