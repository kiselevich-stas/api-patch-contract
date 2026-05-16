/*
 * api-patch-contract
 * Type-safe PATCH payload builder for frontend forms and API contracts.
 */

export type Primitive = string | number | boolean | bigint | symbol | null | undefined
export type Path = string
export type PatchPath = string

type Simplify<T> = { [K in keyof T]: T[K] } & {}

declare const contractBrand: unique symbol

export type Comparator<T = unknown> = (initialValue: T, currentValue: T, context: CompareContext) => boolean

export type CompareContext = {
  path: string
}

export type TransformContext<T = unknown> = {
  path: string
  initialValue: T
  currentValue: T
}

export type OmitPreset =
  | 'undefined'
  | 'null'
  | 'empty-string'
  | 'empty-array'
  | 'empty-object'

export type OmitPredicate<T = unknown> = (value: T, context: { path: string }) => boolean

export type FieldOptions<T = unknown, Out = T> = {
  /** Custom equality check. Return true when values should be treated as equal. */
  compare?: Comparator<T>
  /** Transform the current value before it is placed into the PATCH payload. */
  transform?: (value: T, context: TransformContext<T>) => Out
  /** Convert empty string values to null before comparison and transformation. */
  emptyStringAsNull?: boolean
  /** Additional omit rules. By default, undefined is omitted because it is usually not a valid JSON PATCH value. */
  omitIf?: OmitPreset | OmitPreset[] | OmitPredicate<Out>
  /** Force undefined values into the resulting object. Defaults to false. */
  includeUndefined?: boolean
}

export type FieldRule<T = unknown, Out = T> = {
  readonly __apiPatchContractRule: 'field'
  readonly options: FieldOptions<T, Out>
}

export type ArrayReplaceOptions<TItem = unknown, OutItem = TItem> = {
  compare?: Comparator<ReadonlyArray<TItem>>
  transformItem?: (item: TItem, index: number) => OutItem
  omitIfEmpty?: boolean
}

export type ArrayAsSetOptions<TItem = unknown, OutItem = TItem> = {
  getKey?: keyof TItem | ((item: TItem) => PropertyKey)
  transformItem?: (item: TItem, index: number) => OutItem
  omitIfEmpty?: boolean
}

export type ArrayByIdPatch<TItem, IdKey extends keyof TItem> = {
  added: TItem[]
  updated: Array<Partial<TItem> & Pick<TItem, IdKey>>
  removed: Array<TItem[IdKey]>
}

export type ArrayByIdMode = 'replace' | 'items'

export type ArrayByIdOptions<
  TItem extends Record<PropertyKey, unknown> = Record<string, unknown>,
  Mode extends ArrayByIdMode = 'replace',
> = {
  mode?: Mode
  itemContract?: PatchContract<TItem>
  includeAdded?: boolean
  includeUpdated?: boolean
  includeRemoved?: boolean
  transformAddedItem?: (item: TItem, index: number) => TItem
}

export type ArrayRule<TArray = unknown, Out = unknown> =
  | {
      readonly __apiPatchContractRule: 'array-replace'
      readonly options: ArrayReplaceOptions<any, any>
      readonly __apiPatchContractInput?: TArray
      readonly __apiPatchContractOutput?: Out
    }
  | {
      readonly __apiPatchContractRule: 'array-as-set'
      readonly options: ArrayAsSetOptions<any, any>
      readonly __apiPatchContractInput?: TArray
      readonly __apiPatchContractOutput?: Out
    }
  | {
      readonly __apiPatchContractRule: 'array-by-id'
      readonly idKey: PropertyKey
      readonly options: ArrayByIdOptions<Record<PropertyKey, unknown>, ArrayByIdMode>
      readonly __apiPatchContractInput?: TArray
      readonly __apiPatchContractOutput?: Out
    }

export type ContractValue<T> =
  | true
  | FieldRule<T, unknown>
  | (T extends ReadonlyArray<unknown>
      ? ArrayRule<T, unknown>
      : T extends Date
        ? FieldRule<T, unknown> | true
        : T extends object
          ? PatchContract<T> | FieldRule<T, unknown>
          : never)

export type PatchContract<T> = {
  readonly [K in keyof T]?: ContractValue<T[K]>
}

type RuntimePatchContract = Record<string, any>

export type DefinedPatchContract<T, C extends PatchContract<T>> = C & {
  /** Type-only marker used by InferPatchPayload. It is not emitted at runtime. */
  readonly [contractBrand]?: T
}

type ContractSource<C> = C extends { readonly [contractBrand]?: infer Source } ? Source : never

export type InferPatchPayload<C> = C extends { readonly [contractBrand]?: infer Source }
  ? C extends PatchContract<Source>
    ? PayloadFromContract<Source, C>
    : never
  : never

type PayloadFromContract<T, C> = Simplify<{
  [K in Extract<keyof C, keyof T>]?: C[K] extends true
    ? T[K]
    : C[K] extends FieldRule<unknown, infer Out>
      ? Out
      : C[K] extends ArrayRule<unknown, infer Out>
        ? Out
        : C[K] extends PatchContract<T[K]>
          ? PayloadFromContract<T[K], C[K]>
          : never
}>

export type CreatePatchOptions = {
  /** Throw when data changed outside the contract. Useful to catch accidental API-contract drift. */
  strict?: boolean
  /** Omit undefined from the resulting payload. Defaults to true. */
  omitUndefined?: boolean
}

export type PatchResult<Payload> = {
  patch: Payload
  changedPaths: string[]
  dirtyFields: DirtyFields
  hasChanges: boolean
}

export interface DirtyFields {
  [key: string]: true | DirtyFields
}

export class PatchContractError extends Error {
  override readonly name = 'PatchContractError'
  readonly uncoveredPaths: string[]

  constructor(uncoveredPaths: string[]) {
    super(
      `Detected changed fields outside the patch contract: ${uncoveredPaths.join(', ')}`,
    )
    this.uncoveredPaths = uncoveredPaths
  }
}

export function definePatchContract<T>() {
  return function define<C extends PatchContract<T>>(contract: C): DefinedPatchContract<T, C> {
    return contract as DefinedPatchContract<T, C>
  }
}

export function field<T = unknown, Out = T>(options: FieldOptions<T, Out> = {}): FieldRule<T, Out> {
  return {
    __apiPatchContractRule: 'field',
    options,
  }
}

export function arrayReplace<TItem = unknown, OutItem = TItem>(
  options: ArrayReplaceOptions<TItem, OutItem> = {},
): ArrayRule<ReadonlyArray<TItem>, OutItem[]> {
  return {
    __apiPatchContractRule: 'array-replace',
    options: options as ArrayReplaceOptions<TItem, unknown>,
  } as ArrayRule<ReadonlyArray<TItem>, OutItem[]>
}

export function arrayAsSet<TItem = unknown, OutItem = TItem>(
  options: ArrayAsSetOptions<TItem, OutItem> = {},
): ArrayRule<ReadonlyArray<TItem>, OutItem[]> {
  return {
    __apiPatchContractRule: 'array-as-set',
    options: options as ArrayAsSetOptions<TItem, unknown>,
  } as ArrayRule<ReadonlyArray<TItem>, OutItem[]>
}

export function arrayById<
  TItem extends Record<PropertyKey, unknown>,
  IdKey extends keyof TItem,
  Mode extends ArrayByIdMode = 'replace',
>(
  idKey: IdKey,
  options: ArrayByIdOptions<TItem, Mode> = {},
): ArrayRule<ReadonlyArray<TItem>, Mode extends 'items' ? ArrayByIdPatch<TItem, IdKey> : TItem[]> {
  return {
    __apiPatchContractRule: 'array-by-id',
    idKey,
    options: options as ArrayByIdOptions<Record<PropertyKey, unknown>, ArrayByIdMode>,
  } as ArrayRule<ReadonlyArray<TItem>, Mode extends 'items' ? ArrayByIdPatch<TItem, IdKey> : TItem[]>
}

export function createPatch<T, C extends PatchContract<T>>(
  initialData: T,
  currentData: T,
  contract: DefinedPatchContract<T, C> | C,
  options: CreatePatchOptions = {},
): InferPatchPayload<DefinedPatchContract<T, C>> {
  if (options.strict) {
    const uncoveredPaths = getUncoveredChangedPaths(initialData, currentData, contract)

    if (uncoveredPaths.length > 0) {
      throw new PatchContractError(uncoveredPaths)
    }
  }

  return buildPatch(initialData, currentData, contract as RuntimePatchContract, '', {
    omitUndefined: options.omitUndefined ?? true,
  }) as InferPatchPayload<DefinedPatchContract<T, C>>
}

export function createPatchResult<T, C extends PatchContract<T>>(
  initialData: T,
  currentData: T,
  contract: DefinedPatchContract<T, C> | C,
  options: CreatePatchOptions = {},
): PatchResult<InferPatchPayload<DefinedPatchContract<T, C>>> {
  const patch = createPatch(initialData, currentData, contract, options)
  const changedPaths = getChangedPaths(initialData, currentData, contract)

  return {
    patch,
    changedPaths,
    dirtyFields: getDirtyFields(initialData, currentData, contract),
    hasChanges: !isEmptyObject(patch as Record<string, unknown>),
  }
}

export function getChangedPaths<T, C extends PatchContract<T>>(
  initialData: T,
  currentData: T,
  contract: DefinedPatchContract<T, C> | C,
): string[] {
  const paths: string[] = []
  collectChangedPaths(initialData, currentData, contract as RuntimePatchContract, '', paths)
  return paths
}

export function getDirtyFields<T, C extends PatchContract<T>>(
  initialData: T,
  currentData: T,
  contract: DefinedPatchContract<T, C> | C,
): DirtyFields {
  const paths = getChangedPaths(initialData, currentData, contract)
  const dirtyFields: DirtyFields = {}

  for (const path of paths) {
    setPath(dirtyFields, path.split('.'), true)
  }

  return dirtyFields
}

export function getUncoveredChangedPaths<T, C extends PatchContract<T>>(
  initialData: T,
  currentData: T,
  contract: DefinedPatchContract<T, C> | C,
): string[] {
  const allChangedPaths: string[] = []
  collectAllChangedLeafPaths(initialData, currentData, '', allChangedPaths)

  const coveredChangedPaths = getChangedPaths(initialData, currentData, contract)

  return allChangedPaths.filter(
    path => !coveredChangedPaths.some(coveredPath => isPathCoveredBy(path, coveredPath)),
  )
}

export function hasChanges(patch: unknown): boolean
export function hasChanges<T, C extends PatchContract<T>>(
  initialData: T,
  currentData: T,
  contract: DefinedPatchContract<T, C> | C,
): boolean
export function hasChanges(...args: unknown[]): boolean {
  if (args.length === 1) {
    return !isEmptyPatch(args[0])
  }

  if (args.length === 3) {
    return getChangedPaths(args[0], args[1], args[2] as RuntimePatchContract).length > 0
  }

  throw new TypeError('hasChanges expects either a patch object or initial/current/contract arguments.')
}

export function isFieldChanged<T, C extends PatchContract<T>>(
  initialData: T,
  currentData: T,
  contract: DefinedPatchContract<T, C> | C,
  path: string,
): boolean {
  return getChangedPaths(initialData, currentData, contract).includes(path)
}

function buildPatch(
  initialValue: unknown,
  currentValue: unknown,
  contract: RuntimePatchContract,
  basePath: string,
  options: Required<Pick<CreatePatchOptions, 'omitUndefined'>>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  for (const key of Object.keys(contract)) {
    const rule = contract[key]

    if (!rule) continue

    const path = joinPath(basePath, key)
    const initialFieldValue = readProperty(initialValue, key)
    const currentFieldValue = readProperty(currentValue, key)
    const nextValue = resolvePatchValue(initialFieldValue, currentFieldValue, rule, path, options)

    if (nextValue.shouldInclude) {
      patch[key] = nextValue.value
    }
  }

  return patch
}

function resolvePatchValue(
  initialValue: unknown,
  currentValue: unknown,
  rule: ContractValue<unknown>,
  path: string,
  options: Required<Pick<CreatePatchOptions, 'omitUndefined'>>,
): { shouldInclude: true; value: unknown } | { shouldInclude: false } {
  if (rule === true) {
    if (deepEqual(initialValue, currentValue)) return { shouldInclude: false }
    if (currentValue === undefined && options.omitUndefined) return { shouldInclude: false }
    return { shouldInclude: true, value: currentValue }
  }

  if (isFieldRule(rule)) {
    return resolveFieldPatchValue(initialValue, currentValue, rule, path, options)
  }

  if (isArrayRule(rule)) {
    return resolveArrayPatchValue(initialValue, currentValue, rule, path)
  }

  if (isPlainObject(rule)) {
    const nestedPatch = buildPatch(initialValue, currentValue, rule as RuntimePatchContract, path, options)
    if (isEmptyObject(nestedPatch)) return { shouldInclude: false }
    return { shouldInclude: true, value: nestedPatch }
  }

  return { shouldInclude: false }
}

function resolveFieldPatchValue(
  initialValue: unknown,
  currentValue: unknown,
  rule: FieldRule<unknown, unknown>,
  path: string,
  options: Required<Pick<CreatePatchOptions, 'omitUndefined'>>,
): { shouldInclude: true; value: unknown } | { shouldInclude: false } {
  const fieldOptions = rule.options
  const normalizedInitial = normalizeFieldValue(initialValue, fieldOptions)
  const normalizedCurrent = normalizeFieldValue(currentValue, fieldOptions)
  const isEqual = fieldOptions.compare
    ? fieldOptions.compare(normalizedInitial, normalizedCurrent, { path })
    : deepEqual(normalizedInitial, normalizedCurrent)

  if (isEqual) return { shouldInclude: false }

  const transformed = fieldOptions.transform
    ? fieldOptions.transform(normalizedCurrent, {
        path,
        initialValue: normalizedInitial,
        currentValue: normalizedCurrent,
      })
    : normalizedCurrent

  if (transformed === undefined && options.omitUndefined && !fieldOptions.includeUndefined) {
    return { shouldInclude: false }
  }

  if (shouldOmitValue(transformed, fieldOptions.omitIf, path)) {
    return { shouldInclude: false }
  }

  return { shouldInclude: true, value: transformed }
}

function resolveArrayPatchValue(
  initialValue: unknown,
  currentValue: unknown,
  rule: ArrayRule<unknown, unknown>,
  path: string,
): { shouldInclude: true; value: unknown } | { shouldInclude: false } {
  const initialArray = Array.isArray(initialValue) ? initialValue : []
  const currentArray = Array.isArray(currentValue) ? currentValue : []

  if (rule.__apiPatchContractRule === 'array-replace') {
    const options = rule.options
    const isEqual = options.compare
      ? options.compare(initialArray, currentArray, { path })
      : deepEqual(initialArray, currentArray)

    if (isEqual) return { shouldInclude: false }
    if (options.omitIfEmpty && currentArray.length === 0) return { shouldInclude: false }

    const value = options.transformItem
      ? currentArray.map((item, index) => options.transformItem?.(item, index))
      : currentArray

    return { shouldInclude: true, value }
  }

  if (rule.__apiPatchContractRule === 'array-as-set') {
    const options = rule.options
    const initialKeys = initialArray.map(item => toStableKey(resolveArraySetKey(item, options.getKey)))
    const currentKeys = currentArray.map(item => toStableKey(resolveArraySetKey(item, options.getKey)))

    const isEqual = sameMultiset(initialKeys, currentKeys)

    if (isEqual) return { shouldInclude: false }
    if (options.omitIfEmpty && currentArray.length === 0) return { shouldInclude: false }

    const value = options.transformItem
      ? currentArray.map((item, index) => options.transformItem?.(item, index))
      : currentArray

    return { shouldInclude: true, value }
  }

  if (rule.__apiPatchContractRule === 'array-by-id') {
    return resolveArrayByIdPatchValue(initialArray, currentArray, rule, path)
  }

  return { shouldInclude: false }
}

function resolveArrayByIdPatchValue(
  initialArray: unknown[],
  currentArray: unknown[],
  rule: Extract<ArrayRule<unknown, unknown>, { __apiPatchContractRule: 'array-by-id' }>,
  path: string,
): { shouldInclude: true; value: unknown } | { shouldInclude: false } {
  const options = {
    mode: 'replace' as ArrayByIdMode,
    includeAdded: true,
    includeUpdated: true,
    includeRemoved: true,
    ...rule.options,
  }

  if (options.mode === 'replace') {
    const initialIds = initialArray.map(item => getItemId(item, rule.idKey))
    const currentIds = currentArray.map(item => getItemId(item, rule.idKey))

    if (sameOrderedArray(initialIds, currentIds) && deepEqual(initialArray, currentArray)) {
      return { shouldInclude: false }
    }

    return { shouldInclude: true, value: currentArray }
  }

  const initialById = indexArrayById(initialArray, rule.idKey)
  const currentById = indexArrayById(currentArray, rule.idKey)
  const added: unknown[] = []
  const updated: unknown[] = []
  const removed: unknown[] = []

  for (const item of currentArray) {
    const id = getItemId(item, rule.idKey)
    const normalizedId = toStableKey(id)

    if (!initialById.has(normalizedId)) {
      if (options.includeAdded) {
        added.push(options.transformAddedItem ? options.transformAddedItem(item as Record<PropertyKey, unknown>, added.length) : item)
      }
      continue
    }

    const initialItem = initialById.get(normalizedId)

    if (options.includeUpdated && !deepEqual(initialItem, item)) {
      const itemPatch = options.itemContract
        ? buildPatch(initialItem, item, options.itemContract, `${path}.${String(id)}`, { omitUndefined: true })
        : createDeepPatch(initialItem, item)

      if (!isEmptyObject(itemPatch)) {
        updated.push({ [rule.idKey]: id, ...itemPatch })
      }
    }
  }

  for (const item of initialArray) {
    const id = getItemId(item, rule.idKey)
    const normalizedId = toStableKey(id)

    if (!currentById.has(normalizedId) && options.includeRemoved) {
      removed.push(id)
    }
  }

  if (added.length === 0 && updated.length === 0 && removed.length === 0) {
    return { shouldInclude: false }
  }

  return {
    shouldInclude: true,
    value: {
      added,
      updated,
      removed,
    },
  }
}

function collectChangedPaths(
  initialValue: unknown,
  currentValue: unknown,
  contract: RuntimePatchContract,
  basePath: string,
  paths: string[],
): void {
  for (const key of Object.keys(contract)) {
    const rule = contract[key]
    if (!rule) continue

    const path = joinPath(basePath, key)
    const initialFieldValue = readProperty(initialValue, key)
    const currentFieldValue = readProperty(currentValue, key)

    if (rule === true) {
      if (!deepEqual(initialFieldValue, currentFieldValue)) paths.push(path)
      continue
    }

    if (isFieldRule(rule)) {
      const normalizedInitial = normalizeFieldValue(initialFieldValue, rule.options)
      const normalizedCurrent = normalizeFieldValue(currentFieldValue, rule.options)
      const isEqual = rule.options.compare
        ? rule.options.compare(normalizedInitial, normalizedCurrent, { path })
        : deepEqual(normalizedInitial, normalizedCurrent)

      if (!isEqual) paths.push(path)
      continue
    }

    if (isArrayRule(rule)) {
      const patchValue = resolveArrayPatchValue(initialFieldValue, currentFieldValue, rule, path)
      if (patchValue.shouldInclude) paths.push(path)
      continue
    }

    if (isPlainObject(rule)) {
      collectChangedPaths(
        initialFieldValue,
        currentFieldValue,
        rule as RuntimePatchContract,
        path,
        paths,
      )
    }
  }
}

function collectAllChangedLeafPaths(
  initialValue: unknown,
  currentValue: unknown,
  basePath: string,
  paths: string[],
): void {
  if (deepEqual(initialValue, currentValue)) return

  if (
    !isPlainObject(initialValue) ||
    !isPlainObject(currentValue) ||
    initialValue instanceof Date ||
    currentValue instanceof Date
  ) {
    paths.push(basePath || '<root>')
    return
  }

  const keys = new Set([...Object.keys(initialValue), ...Object.keys(currentValue)])

  for (const key of keys) {
    collectAllChangedLeafPaths(
      readProperty(initialValue, key),
      readProperty(currentValue, key),
      joinPath(basePath, key),
      paths,
    )
  }
}

function createDeepPatch(initialValue: unknown, currentValue: unknown): Record<string, unknown> {
  if (!isPlainObject(initialValue) || !isPlainObject(currentValue)) {
    return deepEqual(initialValue, currentValue) ? {} : { value: currentValue }
  }

  const patch: Record<string, unknown> = {}
  const keys = new Set([...Object.keys(initialValue), ...Object.keys(currentValue)])

  for (const key of keys) {
    const initialFieldValue = readProperty(initialValue, key)
    const currentFieldValue = readProperty(currentValue, key)

    if (deepEqual(initialFieldValue, currentFieldValue)) continue

    if (isPlainObject(initialFieldValue) && isPlainObject(currentFieldValue)) {
      const nestedPatch = createDeepPatch(initialFieldValue, currentFieldValue)
      if (!isEmptyObject(nestedPatch)) patch[key] = nestedPatch
    } else {
      patch[key] = currentFieldValue
    }
  }

  return patch
}

function normalizeFieldValue(value: unknown, options: FieldOptions<unknown, unknown>): unknown {
  if (options.emptyStringAsNull && value === '') return null
  return value
}

function shouldOmitValue(value: unknown, omitIf: FieldOptions['omitIf'], path: string): boolean {
  if (!omitIf) return false

  if (typeof omitIf === 'function') {
    return omitIf(value, { path })
  }

  const presets = Array.isArray(omitIf) ? omitIf : [omitIf]

  return presets.some(preset => {
    if (preset === 'undefined') return value === undefined
    if (preset === 'null') return value === null
    if (preset === 'empty-string') return value === ''
    if (preset === 'empty-array') return Array.isArray(value) && value.length === 0
    if (preset === 'empty-object') return isPlainObject(value) && Object.keys(value).length === 0
    return false
  })
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime()
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false

    for (let index = 0; index < left.length; index += 1) {
      if (!deepEqual(left[index], right[index])) return false
    }

    return true
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)

    if (leftKeys.length !== rightKeys.length) return false

    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) return false
      if (!deepEqual(left[key], right[key])) return false
    }

    return true
  }

  return false
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  return Object.prototype.toString.call(value) === '[object Object]'
}

function isFieldRule(value: unknown): value is FieldRule<unknown, unknown> {
  return isPlainObject(value) && value.__apiPatchContractRule === 'field'
}

function isArrayRule(value: unknown): value is ArrayRule<unknown, unknown> {
  return (
    isPlainObject(value) &&
    (value.__apiPatchContractRule === 'array-replace' ||
      value.__apiPatchContractRule === 'array-as-set' ||
      value.__apiPatchContractRule === 'array-by-id')
  )
}

function readProperty(source: unknown, key: string): unknown {
  if (source === null || source === undefined) return undefined
  if (typeof source !== 'object') return undefined
  return (source as Record<string, unknown>)[key]
}

function joinPath(basePath: string, key: string): string {
  return basePath ? `${basePath}.${key}` : key
}

function setPath(target: DirtyFields, segments: string[], value: true): void {
  const [head, ...tail] = segments
  if (!head) return

  if (tail.length === 0) {
    target[head] = value
    return
  }

  const next = target[head]
  if (!next || next === true) {
    target[head] = {}
  }

  setPath(target[head] as DirtyFields, tail, value)
}

function isEmptyObject(value: Record<string, unknown>): boolean {
  return Object.keys(value).length === 0
}

function isEmptyPatch(value: unknown): boolean {
  if (!isPlainObject(value)) return !value
  return Object.keys(value).length === 0
}

function resolveArraySetKey<TItem>(item: TItem, getKey: ArrayAsSetOptions<TItem>['getKey']): unknown {
  if (!getKey) return item
  if (typeof getKey === 'function') return getKey(item)
  return (item as Record<PropertyKey, unknown>)[getKey]
}

function sameMultiset(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  const counts = new Map<string, number>()

  for (const value of left) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  for (const value of right) {
    const count = counts.get(value)
    if (!count) return false

    if (count === 1) counts.delete(value)
    else counts.set(value, count - 1)
  }

  return counts.size === 0
}

function sameOrderedArray(left: unknown[], right: unknown[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => Object.is(value, right[index]))
}

function indexArrayById(items: unknown[], idKey: PropertyKey): Map<string, unknown> {
  const map = new Map<string, unknown>()

  for (const item of items) {
    map.set(toStableKey(getItemId(item, idKey)), item)
  }

  return map
}

function getItemId(item: unknown, idKey: PropertyKey): unknown {
  if (item === null || typeof item !== 'object') {
    throw new TypeError(`arrayById expected every item to be an object with "${String(idKey)}".`)
  }

  const id = (item as Record<PropertyKey, unknown>)[idKey]

  if (id === undefined || id === null) {
    throw new TypeError(`arrayById item is missing required id key "${String(idKey)}".`)
  }

  return id
}

function toStableKey(value: unknown): string {
  if (typeof value === 'string') return `string:${value}`
  if (typeof value === 'number') return `number:${value}`
  if (typeof value === 'boolean') return `boolean:${value}`
  if (typeof value === 'bigint') return `bigint:${value.toString()}`
  if (value instanceof Date) return `date:${value.toISOString()}`

  return `json:${stableStringify(value)}`
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function isPathCoveredBy(path: string, coveredPath: string): boolean {
  return path === coveredPath || path.startsWith(`${coveredPath}.`)
}

// This export is useful for advanced users who want to annotate contract variables manually.
export type { ContractSource }
