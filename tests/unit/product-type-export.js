import { expect } from 'chai'
import ProductTypeExport from '../../src'
import { SphereClient } from 'sphere-node-sdk'

const PROJECT_KEY = 'sphere-node-product-type-import'

describe('product-type import module', () => {
  const options = {
    sphereClientConfig: {
      config: {
        project_key: PROJECT_KEY,
        client_id: '*********',
        client_secret: '*********',
      },
      rest: {
        config: {},
        GET: (endpoint, callback) => {
          callback(null, { statusCode: 200 }, { results: [] })
        },
        POST: (endpoint, payload, callback) => {
          callback(null, { statusCode: 200 })
        },
        PUT: () => {},
        DELETE: () => (/* endpoint, callback */) => {},
        PAGED: () => (/* endpoint, callback */) => {},
        _preRequest: () => {},
        _doRequest: () => {},
      },
    },
    config: {
      outputFolder: 'sample/folder',
    },
  }

  it('should be class', () => {
    const expected = 'function'
    const actual = typeof ProductTypeExport

    expect(actual).to.equal(expected)
  })

  it('should create a sphere client', () => {
    const exporter = new ProductTypeExport(options)
    const expected = SphereClient
    const actual = exporter.client.constructor

    expect(actual).to.equal(expected)
  })

  it(`summaryReport should return no errors and no exported product-types
    if no product-types were exported`, () => {
    const exporter = new ProductTypeExport(options)
    const expected = { errors: [], exported: { productTypes: 0, attributes: 0 } }
    const actual = JSON.parse(exporter.summaryReport())

    expect(actual).to.deep.equal(expected)
  })

  it('should throw an error if the output folder is not fiven', () => {
    const noConfigOptions = {
      ...options,
      config: undefined,
    }
    const createExporter = () => new ProductTypeExport(noConfigOptions)
    expect(createExporter).to.throw()
  })
})
