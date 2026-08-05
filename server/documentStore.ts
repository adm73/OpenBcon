import { Collection, MongoClient } from 'mongodb'
import { environment } from './config'

export type DynamicStateScope = 'platform' | 'workspace' | 'user'

export type DynamicStateDocument = {
  scope: DynamicStateScope
  ownerId: string
  key: string
  value: unknown
  updatedAt: Date
}

export type DynamicStateFilter = {
  scopes: DynamicStateScope[]
  ownerIds: string[]
  keys: string[]
}

export type DocumentStore = {
  findState(filter: DynamicStateFilter): Promise<DynamicStateDocument[]>
  findStateValue(scope: DynamicStateScope, ownerId: string, key: string): Promise<unknown | null>
  upsertState(document: DynamicStateDocument): Promise<void>
  deleteState(scope: DynamicStateScope, ownerId: string, key: string): Promise<void>
}

type MongoStateDocument = DynamicStateDocument & { _id?: string }

function createMongoDocumentStore(
  databaseName: string,
  mongodbUrl = environment.MONGODB_URL,
): DocumentStore {
  const client = new MongoClient(mongodbUrl)
  let collectionPromise: Promise<Collection<MongoStateDocument>> | undefined

  async function getCollection() {
    collectionPromise ??= client.connect().then(async () => {
      const collection = client
        .db(databaseName)
        .collection<MongoStateDocument>('dynamic_state')
      await collection.createIndex(
        { scope: 1, ownerId: 1, key: 1 },
        { unique: true, name: 'dynamic_state_identity_idx' },
      )
      return collection
    })
    return collectionPromise
  }

  return {
    async findState(filter) {
      const collection = await getCollection()
      return collection
        .find({
          scope: { $in: filter.scopes },
          ownerId: { $in: filter.ownerIds },
          key: { $in: filter.keys },
        })
        .sort({ updatedAt: 1 })
        .toArray()
    },
    async findStateValue(scope, ownerId, key) {
      const collection = await getCollection()
      const document = await collection.findOne({ scope, ownerId, key })
      return document?.value ?? null
    },
    async upsertState(document) {
      const collection = await getCollection()
      await collection.updateOne(
        { scope: document.scope, ownerId: document.ownerId, key: document.key },
        { $set: document },
        { upsert: true },
      )
    },
    async deleteState(scope, ownerId, key) {
      const collection = await getCollection()
      await collection.deleteOne({ scope, ownerId, key })
    },
  }
}

export function createInMemoryDocumentStore(): DocumentStore {
  const documents = new Map<string, DynamicStateDocument>()
  const identity = (scope: string, ownerId: string, key: string) =>
    `${scope}:${ownerId}:${key}`

  return {
    async findState(filter) {
      return [...documents.values()]
        .filter(
          (document) =>
            filter.scopes.includes(document.scope) &&
            filter.ownerIds.includes(document.ownerId) &&
            filter.keys.includes(document.key),
        )
        .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
    },
    async findStateValue(scope, ownerId, key) {
      return documents.get(identity(scope, ownerId, key))?.value ?? null
    },
    async upsertState(document) {
      documents.set(identity(document.scope, document.ownerId, document.key), document)
    },
    async deleteState(scope, ownerId, key) {
      documents.delete(identity(scope, ownerId, key))
    },
  }
}

export function createDocumentStore(
  databaseName = environment.MONGODB_DATABASE_TEST ?? environment.MONGODB_DATABASE,
): DocumentStore {
  return createMongoDocumentStore(databaseName)
}
