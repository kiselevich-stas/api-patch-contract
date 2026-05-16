import { definePatchContract, type InferPatchPayload } from '../src/index'

type User = {
  id: string
  name: string
  profile: {
    city: string
  }
}

const contract = definePatchContract<User>()({
  name: true,
  profile: {
    city: true,
  },
})

type Payload = InferPatchPayload<typeof contract>

const validPayload: Payload = {
  name: 'Anna',
  profile: {
    city: 'Riga',
  },
}

validPayload

const invalidPayload: Payload = {
  // @ts-expect-error id is not included in the contract
  id: '1',
}

invalidPayload

const invalidContract = definePatchContract<User>()({
  // @ts-expect-error unknown fields cannot be defined in a contract
  unknown: true,
})

invalidContract
