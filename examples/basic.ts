import { createPatch, definePatchContract, field } from 'api-patch-contract'

type User = {
  id: string
  name: string
  email: string
  profile: {
    city: string
    phone: string | null
  }
  createdAt: string
}

const contract = definePatchContract<User>()({
  name: field<string>({
    transform: value => value.trim(),
  }),
  profile: {
    city: true,
    phone: field<string | null>({
      emptyStringAsNull: true,
    }),
  },
})

const initialUser: User = {
  id: '1',
  name: 'Anna',
  email: 'anna@example.com',
  profile: {
    city: 'Riga',
    phone: '+100',
  },
  createdAt: '2026-01-01',
}

const currentUser: User = {
  ...initialUser,
  name: ' Anna Smith ',
  profile: {
    ...initialUser.profile,
    phone: '',
  },
}

const patch = createPatch(initialUser, currentUser, contract)

console.log(patch)
// {
//   name: 'Anna Smith',
//   profile: {
//     phone: null
//   }
// }
