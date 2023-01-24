/* eslint-env jest */
/* eslint handle-callback-err: "warn" */

import * as session from 'express-session'
import { MongoClient } from 'mongodb'
import { nanoid } from 'nanoid'
import mongoStoreFactory from '../MongoStore'

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

const MongoStore = mongoStoreFactory(session)

beforeAll(async () => {
  client = await MongoClient.connect(process.env['MONGO_URI'], {})
})

beforeEach((done) => {
  // @ts-ignore
  store = new MongoStore({
    client,
    dbName: 'express-session',
    collection: nanoid(),
    ttlMs: 10000,
  })

  store.set(SID, SAMPLE_DATA, (err) => {
    done()
  })
})

afterEach(() => {
  clearInterval(store.cleanupTimer)
})

afterAll(async () => {
  await client.close()
})

describe('MongoStore', () => {
  it('should get a session', (done) => {
    store.get(SID, (err, data) => {
      expect(data).toMatchObject(SAMPLE_DATA)
      done()
    })
  })

  it('should destroy a session', (done) => {
    store.destroy(SID, () => {
      store.get(SID, (data) => {
        expect(data).toBe(null)
        done()
      })
    })
  })

  it('should get all sessions', (done) => {
    store.set('test2', SAMPLE_DATA, () => {
      store.all((err, data) => {
        expect(data.length).toBe(2)
        expect(data[0]).toMatchObject(SAMPLE_DATA)
        done()
      })
    })
  })

  it('should get the session count', (done) => {
    store.set('test2', SAMPLE_DATA, () => {
      store.length((err, data) => {
        expect(data).toBe(2)
        done()
      })
    })
  })

  it('should clear all sessions', (done) => {
    store.clear(() => {
      store.length((err, data) => {
        expect(data).toBe(0)
        done()
      })
    })
  })

  it('should touch a session', (done) => {
    const testData = {
      cookie: {
        originalMaxAge: 4567,
        httpOnly: true,
        expires: '2020-03-22T03:19:30.868Z' as unknown as Date,
        path: '/',
        maxAge: 60000,
      },
    }

    store.touch(SID, testData, () => {
      store.get(SID, (err, data) => {
        expect(data).toMatchObject(testData)
        done()
      })
    })
  })

  it('should handle expired sessions', (done) => {
    const s = new MongoStore({
      client,
      dbName: 'express-session',
      collection: nanoid(),
      ttlMs: 0,
    })

    clearInterval(s.cleanupTimer)

    s.set(SID, SAMPLE_DATA, () => {
      s.get(SID, (data) => {
        expect(data).toBe(null)

        s.length((err, count) => {
          expect(count).toBe(0)
          done()
        })
      })
    })
  })
})
