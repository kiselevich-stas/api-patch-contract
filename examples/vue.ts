import { computed, reactive } from 'vue'
import { createPatchResult, definePatchContract } from 'api-patch-contract'

type User = {
  id: string
  name: string
  profile: {
    city: string
    phone: string | null
  }
}

const userFromApi: User = {
  id: '1',
  name: 'Anna',
  profile: {
    city: 'Riga',
    phone: null,
  },
}

const initialUser = structuredClone(userFromApi)
const form = reactive(structuredClone(userFromApi))

const contract = definePatchContract<User>()({
  name: true,
  profile: {
    city: true,
    phone: true,
  },
})

const patchResult = computed(() => createPatchResult(initialUser, form, contract))

async function save() {
  if (!patchResult.value.hasChanges) return

  await fetch(`/api/users/${form.id}`, {
    method: 'PATCH',
    body: JSON.stringify(patchResult.value.patch),
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

void save
