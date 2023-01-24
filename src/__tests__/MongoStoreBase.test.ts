/* eslint-env jest */

import { MongoClient } from 'mongodb'
import { nanoid } from 'nanoid'
import { MongoStoreBase } from '../MongoStoreBase'

let store
let client

const SID = 'test-1234'

const SAMPLE_DATA = {
  cookie: {
    originalMaxAge: 12345,
    httpOnly: false,
    expires: '2020-03-21T03:19:30.868Z' as unknown as Date,
    path: '/',
    maxAge: 50000,
  },
}

beforeAll(async () => {
  client = await MongoClient.connect(process.env['MONGO_URI'], {})
})

beforeEach(async () => {
  store = new MongoStoreBase({
    client,
    dbName: 'express-session',
    collection: nanoid(),
    ttlMs: 10000,
  })

  await store.set(SID, SAMPLE_DATA)
})

afterAll(async () => {
  await client.close()
})

describe('SqliteStoreBase', () => {
  it('should get a session', async () => {
    const data = await store.get(SID)

    expect(data).toMatchObject(SAMPLE_DATA)
  })

  it('should destroy a session', async () => {
    await store.destroy(SID)
    const data = await store.get(SID)
    expect(data).toBe(null)
  })

  it('should get all sessions', async () => {
    await store.set('test2', SAMPLE_DATA)
    const data = await store.all()
    expect(data.length).toBe(2)
    expect(data[0]).toMatchObject(SAMPLE_DATA)
  })

  it('should get the session count', async () => {
    await store.set('test2', SAMPLE_DATA)
    const data = await store.length()
    expect(data).toBe(2)
  })

  it('should clear all sessions', async () => {
    await store.clear()
    const data = await store.length()
    expect(data).toBe(0)
  })

  it('should touch a session', async () => {
    const testData = {
      cookie: {
        originalMaxAge: 4567,
        httpOnly: true,
        expires: '2020-03-22T03:19:30.868Z' as unknown as Date,
        path: '/',
        maxAge: 60000,
      },
    }

    await store.touch(SID, testData)
    const data = await store.get(SID)

    expect(data).toMatchObject(testData)
  })

  it('should handle expired sessions', async () => {
    const s = new MongoStoreBase({
      client,
      dbName: 'express-session',
      collection: nanoid(),
      ttlMs: 0,
    })

    await s.set(SID, SAMPLE_DATA)

    expect(await s.get(SID)).toBe(null)
    expect(await s.length()).toBe(0)
    expect(await s.removeExpiredSessions())
  })
})
