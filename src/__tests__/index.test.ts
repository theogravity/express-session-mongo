/* eslint-env jest */

describe('index', () => {
  it('includes the lib', () => {
    const store = require('../index').mongoStoreFactory
    expect(store).toBeDefined()
  })
})
