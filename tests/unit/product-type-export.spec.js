import { SphereClient } from 'sphere-node-sdk'
import test from 'tape'
import ProductTypeExport from '../../src'
import getSphereClientCredentials from '../../src/sphere-client-credentials'

let PROJECT_KEY

if (process.env.CI === 'true')
  PROJECT_KEY = process.env.SPHERE_PROJECT_KEY
else
  PROJECT_KEY = process.env.npm_config_projectkey

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

test(`getSphereClientCredentials
  should throw an error is projectKey is not defined`, (t) => {
  getSphereClientCredentials(undefined)
    .then(() => {
      t.fail('should not resolve')
      t.end()
    })
    .catch((err) => {
      const expectedMsg = 'Project Key is needed'
      t.ok(err, 'Error should exist')
      t.equal(err.message, expectedMsg, 'Error message should be present')
      t.end()
    })
})

test(`productType import module
  should be class`, (t) => {
  const expected = 'function'
  const actual = typeof ProductTypeExport

  t.equal(actual, expected)
  t.end()
})

test(`productType import module
  should create a sphere client`, (t) => {
  const exporter = new ProductTypeExport(options)
  const expected = SphereClient
  const actual = exporter.client.constructor

  t.equal(actual, expected)
  t.end()
})

test(`productType import module
  summaryReport should return no errors and no exported product-types
    if no product-types were exported`, (t) => {
  const exporter = new ProductTypeExport(options)
  const expected = {
    errors: [],
    exported: {
      productTypes: 0,
      attributes: 0,
    },
  }
  const actual = JSON.parse(exporter.summaryReport())

  t.deepEqual(actual, expected)
  t.end()
})

test(`productType import module
  should throw an error if the output folder is not given`, (t) => {
  const noConfigOptions = {
    ...options,
    config: undefined,
  }
  const createExporter = () => new ProductTypeExport(noConfigOptions)
  t.throws(createExporter)
  t.end()
})

test(`productType import module
  should use a comma as default delimiter`, (t) => {
  const exporter = new ProductTypeExport(options)

  t.equal(exporter.config.delimiter, ',')

  t.end()
})
