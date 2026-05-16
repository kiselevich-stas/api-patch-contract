import { describe, expect, it } from 'vitest'
import {
  PatchContractError,
  arrayAsSet,
  arrayById,
  arrayReplace,
  createPatch,
  createPatchResult,
  definePatchContract,
  field,
  getChangedPaths,
  getDirtyFields,
  hasChanges,
  isFieldChanged,
  type InferPatchPayload,
} from '../src/index'

type User = {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  profile: {
    city: string
    phone: string | null
  }
  tags: string[]
  skills: Array<{ id: string; title: string; level: number }>
  createdAt: string
}

const initialUser: User = {
  id: '1',
  email: 'anna@example.com',
  name: 'Anna',
  role: 'user',
  profile: {
    city: 'Riga',
    phone: null,
  },
  tags: ['vue', 'ts'],
  skills: [
    { id: 'vue', title: 'Vue', level: 4 },
    { id: 'ts', title: 'TypeScript', level: 3 },
  ],
  createdAt: '2026-01-01',
}

describe('createPatch', () => {
  it('creates a patch with only allowed changed fields', () => {
    const contract = definePatchContract<User>()({
      name: true,
      role: true,
      profile: {
        city: true,
        phone: true,
      },
    })

    const currentUser: User = {
      ...initialUser,
      id: '2',
      name: 'Anna Smith',
      profile: {
        ...initialUser.profile,
        city: 'Tallinn',
      },
    }

    const patch = createPatch(initialUser, currentUser, contract)

    expect(patch).toEqual({
      name: 'Anna Smith',
      profile: {
        city: 'Tallinn',
      },
    })
  })

  it('returns an empty object when nothing changed', () => {
    const contract = definePatchContract<User>()({
      name: true,
      profile: {
        city: true,
      },
    })

    expect(createPatch(initialUser, initialUser, contract)).toEqual({})
  })

  it('supports field transform and emptyStringAsNull', () => {
    type Form = {
      name: string
      phone: string | null
    }

    const contract = definePatchContract<Form>()({
      name: field<string>({
        transform: value => value.trim(),
      }),
      phone: field<string | null>({
        emptyStringAsNull: true,
      }),
    })

    const patch = createPatch(
      { name: 'Anna', phone: '+100' },
      { name: ' Anna Smith ', phone: '' },
      contract,
    )

    expect(patch).toEqual({
      name: 'Anna Smith',
      phone: null,
    })
  })

  it('supports custom comparator', () => {
    type Event = {
      startDate: Date
    }

    const contract = definePatchContract<Event>()({
      startDate: field<Date, string>({
        compare: (left, right) =>
            left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10),
        transform: value => value.toISOString(),
      }),
    })

    const firstPatch = createPatch(
        { startDate: new Date('2026-05-16T10:00:00Z') },
        { startDate: new Date('2026-05-16T22:00:00Z') },
        contract,
    )

    const secondPatch = createPatch(
        { startDate: new Date('2026-05-16T10:00:00Z') },
        { startDate: new Date('2026-05-17T10:00:00Z') },
        contract,
    )

    expect(firstPatch).toEqual({})
    expect(secondPatch).toEqual({ startDate: '2026-05-17T10:00:00.000Z' })
  })

  it('supports array replace strategy', () => {
    const contract = definePatchContract<User>()({
      tags: arrayReplace<string>(),
    })

    const patch = createPatch(
      initialUser,
      { ...initialUser, tags: ['vue', 'ts', 'nuxt'] },
      contract,
    )

    expect(patch).toEqual({ tags: ['vue', 'ts', 'nuxt'] })
  })

  it('supports array as set strategy and ignores order', () => {
    const contract = definePatchContract<User>()({
      tags: arrayAsSet<string>(),
    })

    expect(createPatch(initialUser, { ...initialUser, tags: ['ts', 'vue'] }, contract)).toEqual({})
    expect(createPatch(initialUser, { ...initialUser, tags: ['vue', 'node'] }, contract)).toEqual({
      tags: ['vue', 'node'],
    })
  })

  it('supports arrayById items strategy', () => {
    const skillContract = definePatchContract<User['skills'][number]>()({
      title: true,
      level: true,
    })

    const contract = definePatchContract<User>()({
      skills: arrayById<User['skills'][number], 'id', 'items'>('id', {
        mode: 'items',
        itemContract: skillContract,
      }),
    })

    const patch = createPatch(
      initialUser,
      {
        ...initialUser,
        skills: [
          { id: 'vue', title: 'Vue', level: 5 },
          { id: 'node', title: 'Node.js', level: 2 },
        ],
      },
      contract,
    )

    expect(patch).toEqual({
      skills: {
        added: [{ id: 'node', title: 'Node.js', level: 2 }],
        updated: [{ id: 'vue', level: 5 }],
        removed: ['ts'],
      },
    })
  })

  it('throws in strict mode when fields changed outside contract', () => {
    const contract = definePatchContract<User>()({
      name: true,
    })

    expect(() =>
      createPatch(
        initialUser,
        {
          ...initialUser,
          name: 'Anna Smith',
          email: 'new@example.com',
        },
        contract,
        { strict: true },
      ),
    ).toThrow(PatchContractError)
  })

  it('returns changed paths and dirty fields', () => {
    const contract = definePatchContract<User>()({
      name: true,
      profile: {
        city: true,
      },
    })

    const currentUser = {
      ...initialUser,
      name: 'Anna Smith',
      profile: {
        ...initialUser.profile,
        city: 'Tallinn',
      },
    }

    expect(getChangedPaths(initialUser, currentUser, contract)).toEqual(['name', 'profile.city'])
    expect(getDirtyFields(initialUser, currentUser, contract)).toEqual({
      name: true,
      profile: {
        city: true,
      },
    })
    expect(isFieldChanged(initialUser, currentUser, contract, 'profile.city')).toBe(true)
  })

  it('returns a rich patch result', () => {
    const contract = definePatchContract<User>()({
      name: true,
    })

    const result = createPatchResult(initialUser, { ...initialUser, name: 'Anna Smith' }, contract)

    expect(result).toEqual({
      patch: { name: 'Anna Smith' },
      changedPaths: ['name'],
      dirtyFields: { name: true },
      hasChanges: true,
    })
  })

  it('checks whether a patch has changes', () => {
    const contract = definePatchContract<User>()({
      name: true,
    })

    expect(hasChanges({ name: 'Anna Smith' })).toBe(true)
    expect(hasChanges({})).toBe(false)
    expect(hasChanges(initialUser, { ...initialUser, name: 'Anna Smith' }, contract)).toBe(true)
  })

  it('keeps payload inference from the contract', () => {
    const contract = definePatchContract<User>()({
      name: true,
      profile: {
        phone: field<string | null>({ emptyStringAsNull: true }),
      },
    })

    type Payload = InferPatchPayload<typeof contract>

    const payload: Payload = {
      name: 'Anna Smith',
      profile: {
        phone: '+100',
      },
    }

    expect(payload).toEqual({
      name: 'Anna Smith',
      profile: {
        phone: '+100',
      },
    })
  })
})
